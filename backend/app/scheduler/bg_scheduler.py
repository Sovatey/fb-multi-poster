import os
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.storage_service import StorageService
from app.services.fb_publisher import FacebookPublisher
from app.services.yt_publisher import YouTubePublisher
from app.utils.logger import get_logger

logger = get_logger("scheduler")
scheduler = AsyncIOScheduler()

# Dependency instances
storage_service = StorageService()
publisher = FacebookPublisher()
yt_publisher = YouTubePublisher()

async def process_scheduled_posts():
    """
    Checks scheduled.json for any posts that are due to be published.
    Publishes them and moves them to history.
    """
    logger.debug("Checking for scheduled posts...")
    scheduled_posts = storage_service.get_scheduled()
    if not scheduled_posts:
        return
        
    now = datetime.now(timezone.utc)
    config = storage_service.get_config()
    pages_lookup = {p["name"].strip(): p for p in config.get("pages", [])}
    yt_lookup = {y["name"].strip(): y for y in config.get("youtubeChannels", [])}
    
    posts_to_process = []
    remaining_posts = []
    
    for post in scheduled_posts:
        post_time_str = post.get("timestamp")
        post_status = post.get("status", "pending")
        
        if post_status != "pending":
            remaining_posts.append(post)
            continue
            
        try:
            # Parse scheduled time
            post_time = datetime.fromisoformat(post_time_str.replace("Z", "+00:00"))
            if post_time <= now:
                posts_to_process.append(post)
            else:
                remaining_posts.append(post)
        except Exception as e:
            logger.error(f"Error parsing date {post_time_str} for post {post.get('id')}: {e}")
            post["status"] = "failed"
            post["error"] = f"Invalid timestamp: {str(e)}"
            storage_service.add_history_entry({
                "id": post.get("id"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "videoPath": post.get("videoPath"),
                "thumbnailPath": post.get("thumbnailPath"),
                "title": post.get("title"),
                "caption": post.get("caption"),
                "pages": [{"name": p, "status": "failed", "postId": None, "error": "Invalid schedule time"} for p in post.get("pages", [])],
                "executionTimeMs": 0
            })
            # Do not keep in scheduled if corrupt
            
    if not posts_to_process:
        return
        
    # Update scheduled posts list immediately to prevent double execution
    # Set to processing in memory
    for post in posts_to_process:
        post["status"] = "processing"
    
    temp_scheduled = remaining_posts + posts_to_process
    storage_service.save_scheduled(temp_scheduled)
    
    for post in posts_to_process:
        logger.info(f"Processing scheduled post {post.get('id')} scheduled for {post.get('timestamp')}")
        
        video_path_rel = post.get("videoPath") # e.g. /static/videos/filename.mp4
        # Resolve to local system path
        filename = os.path.basename(video_path_rel)
        local_video_path = os.path.join(storage_service.videos_dir, filename)
        
        title = post.get("title", "")
        caption = post.get("caption", "")
        selected_pages = post.get("pages", [])
        post_type = post.get("postType", "video") # "video" or "reel"
        page_customizations = post.get("pageCustomizations")
        
        # Track start execution time
        start_time = datetime.now()
        
        results = []
        
        for page_name in selected_pages:
            page_name_clean = page_name.strip()
            page_info = pages_lookup.get(page_name_clean)
            yt_info = yt_lookup.get(page_name_clean)
            
            if not page_info and not yt_info:
                results.append({
                    "name": page_name,
                    "pageId": None,
                    "status": "failed",
                    "postId": None,
                    "error": f"Destination '{page_name}' not found in configuration."
                })
                continue
                
            # Resolve page-specific custom content if configured
            custom_info = page_customizations.get(page_name) if page_customizations else None
            page_title = custom_info.get("title", title) if custom_info else title
            page_caption = custom_info.get("caption", caption) if custom_info else caption
            raw_post_type = custom_info.get("postType", post_type) if (custom_info and custom_info.get("postType")) else post_type
            if raw_post_type == "fb_reel_yt_video":
                page_post_type = "reel" if page_info else "video"
            else:
                page_post_type = raw_post_type
            
            if page_info:
                page_id = page_info["pageId"]
                token = page_info["accessToken"]
                try:
                    if page_post_type == "reel":
                        res = await publisher.publish_reel(
                            page_id=page_id,
                            access_token=token,
                            video_path=local_video_path,
                            caption=page_caption
                        )
                    else:
                        res = await publisher.publish_video(
                            page_id=page_id,
                            access_token=token,
                            video_path=local_video_path,
                            title=page_title,
                            caption=page_caption
                        )
                        
                    if res.get("success"):
                        results.append({
                            "name": page_name,
                            "pageId": page_id,
                            "status": "success",
                            "postId": res.get("postId"),
                            "error": None
                        })
                    else:
                        results.append({
                            "name": page_name,
                            "pageId": page_id,
                            "status": "failed",
                            "postId": None,
                            "error": res.get("error")
                        })
                except Exception as e:
                    logger.error(f"Error publishing scheduled post to Facebook page {page_name}: {e}")
                    results.append({
                        "name": page_name,
                        "pageId": page_id,
                        "status": "failed",
                        "postId": None,
                        "error": str(e)
                    })
            elif yt_info:
                settings = storage_service.get_settings()
                client_id = settings.get("googleClientId")
                client_secret = settings.get("googleClientSecret")
                refresh_token = yt_info.get("refreshToken")
                channel_id = yt_info.get("channelId")
                
                if not client_id or not client_secret or not refresh_token:
                    results.append({
                        "name": page_name,
                        "pageId": channel_id,
                        "status": "failed",
                        "postId": None,
                        "error": "Google Client ID/Secret or Channel refresh token is missing."
                    })
                    continue
                    
                try:
                    logger.info(f"Publishing scheduled post to YouTube Channel '{page_name}' ({page_post_type})...")
                    yt_caption = page_caption
                    if page_post_type in ("reel", "short") and "#Shorts" not in yt_caption:
                        yt_caption = f"{yt_caption}\n\n#Shorts".strip()
                        
                    res = await yt_publisher.publish_video(
                        client_id=client_id,
                        client_secret=client_secret,
                        refresh_token=refresh_token,
                        video_path=local_video_path,
                        title=page_title,
                        caption=yt_caption,
                        privacy_status="public"
                    )
                    
                    if res.get("success"):
                        results.append({
                            "name": page_name,
                            "pageId": channel_id,
                            "status": "success",
                            "postId": res.get("postId"),
                            "error": None
                        })
                    else:
                        results.append({
                            "name": page_name,
                            "pageId": channel_id,
                            "status": "failed",
                            "postId": None,
                            "error": res.get("error")
                        })
                except Exception as e:
                    logger.error(f"Error publishing scheduled post to YouTube Channel {page_name}: {e}")
                    results.append({
                        "name": page_name,
                        "pageId": channel_id,
                        "status": "failed",
                        "postId": None,
                        "error": str(e)
                    })
                
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Save to history
        history_entry = {
            "id": post.get("id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "videoPath": post.get("videoPath"),
            "thumbnailPath": post.get("thumbnailPath"),
            "title": title,
            "caption": caption,
            "pages": results,
            "executionTimeMs": execution_time_ms,
            "pageCustomizations": page_customizations
        }
        storage_service.add_history_entry(history_entry)
        
        # Remove from scheduled queue
        current_scheduled = storage_service.get_scheduled()
        updated_scheduled = [s for s in current_scheduled if s.get("id") != post.get("id")]
        storage_service.save_scheduled(updated_scheduled)
        
        # Auto-delete video and thumbnail if enabled (default True)
        settings = storage_service.get_settings()
        auto_delete = settings.get("autoDeleteAfterPublish", True)
        if auto_delete and any(r.get("status") == "success" for r in results):
            storage_service.delete_media(filename)
            logger.info(f"Auto-deleted scheduled video '{filename}' after publishing.")

        logger.info(f"Finished scheduled post {post.get('id')} processing. Moved to history.")

def start_scheduler():
    try:
        if not scheduler.running:
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                logger.info("No active running event loop for APScheduler. Skipping inline scheduler startup (use run_scheduler.py for background tasks).")
                return

            scheduler.add_job(process_scheduled_posts, "interval", minutes=1, id="check_scheduled")
            scheduler.start()
            logger.info("APScheduler started successfully.")
    except Exception as e:
        logger.warning(f"Could not start inline APScheduler: {e}")

def shutdown_scheduler():
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("APScheduler shutdown successfully.")
    except Exception as e:
        logger.warning(f"Error shutting down scheduler: {e}")


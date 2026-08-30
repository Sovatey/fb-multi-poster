import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import PublishRequest, ScheduleRequest
from app.services.storage_service import StorageService
from app.services.fb_publisher import FacebookPublisher
from app.services.yt_publisher import YouTubePublisher
from app.utils.logger import get_logger

logger = get_logger("router.publish")
router = APIRouter()

def get_storage():
    return StorageService()

def get_publisher():
    return FacebookPublisher()

def get_yt_publisher():
    return YouTubePublisher()

@router.post("/publish")
async def publish_post(
    payload: PublishRequest,
    storage: StorageService = Depends(get_storage),
    publisher: FacebookPublisher = Depends(get_publisher),
    yt_publisher: YouTubePublisher = Depends(get_yt_publisher)
):
    video_filename = payload.videoFilename
    local_video_path = os.path.join(storage.videos_dir, video_filename)
    
    if not os.path.exists(local_video_path):
        raise HTTPException(status_code=404, detail="Video file not found in storage.")
        
    config = storage.get_config()
    pages_lookup = {p["name"].strip(): p for p in config.get("pages", [])}
    yt_lookup = {y["name"].strip(): y for y in config.get("youtubeChannels", [])}
    
    results = []
    start_time = datetime.now()
    
    for page_name in payload.pages:
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
        custom_info = payload.pageCustomizations.get(page_name) if payload.pageCustomizations else None
        page_title = custom_info.get("title", payload.title) if custom_info else payload.title
        page_caption = custom_info.get("caption", payload.caption) if custom_info else payload.caption
        raw_post_type = custom_info.get("postType", payload.postType) if (custom_info and custom_info.get("postType")) else payload.postType
        if raw_post_type == "fb_reel_yt_video":
            page_post_type = "reel" if page_info else "video"
        else:
            page_post_type = raw_post_type
        
        if page_info:
            page_id = page_info["pageId"]
            token = page_info["accessToken"]
            try:
                logger.info(f"Publishing to {page_name} ({page_post_type})...")
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
                logger.error(f"Error publishing to Facebook page {page_name}: {e}")
                results.append({
                    "name": page_name,
                    "pageId": page_id,
                    "status": "failed",
                    "postId": None,
                    "error": str(e)
                })
        elif yt_info:
            settings = storage.get_settings()
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
                logger.info(f"Publishing to YouTube Channel '{page_name}' ({page_post_type})...")
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
                logger.error(f"Error publishing to YouTube Channel {page_name}: {e}")
                results.append({
                    "name": page_name,
                    "pageId": channel_id,
                    "status": "failed",
                    "postId": None,
                    "error": str(e)
                })
                
    execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    
    # Generate relative thumbnail URL
    name_without_ext, _ = os.path.splitext(video_filename)
    thumbnail_name = f"{name_without_ext}.jpg"
    thumbnail_path = os.path.join(storage.thumbnails_dir, thumbnail_name)
    thumbnail_url = f"/static/thumbnails/{thumbnail_name}" if os.path.exists(thumbnail_path) else None
    
    # Save entry to history
    history_entry = {
        "id": f"pub_{uuid.uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "videoPath": f"/static/videos/{video_filename}",
        "thumbnailPath": thumbnail_url,
        "title": payload.title,
        "caption": payload.caption,
        "pages": results,
        "executionTimeMs": execution_time_ms,
        "pageCustomizations": payload.pageCustomizations
    }
    
    storage.add_history_entry(history_entry)
    
    return {"success": True, "results": results, "history": history_entry}

@router.post("/schedule")
def schedule_post(
    payload: ScheduleRequest,
    storage: StorageService = Depends(get_storage)
):
    video_filename = payload.videoFilename
    local_video_path = os.path.join(storage.videos_dir, video_filename)
    
    if not os.path.exists(local_video_path):
        raise HTTPException(status_code=404, detail="Video file not found in storage.")
        
    name_without_ext, _ = os.path.splitext(video_filename)
    thumbnail_name = f"{name_without_ext}.jpg"
    thumbnail_path = os.path.join(storage.thumbnails_dir, thumbnail_name)
    thumbnail_url = f"/static/thumbnails/{thumbnail_name}" if os.path.exists(thumbnail_path) else None
    
    scheduled_entry = {
        "id": f"sched_{uuid.uuid4().hex[:12]}",
        "timestamp": payload.timestamp,
        "videoPath": f"/static/videos/{video_filename}",
        "thumbnailPath": thumbnail_url,
        "title": payload.title,
        "caption": payload.caption,
        "pages": payload.pages,
        "timezone": payload.timezone,
        "postType": payload.postType,
        "status": "pending",
        "pageCustomizations": payload.pageCustomizations
    }
    
    storage.add_scheduled_entry(scheduled_entry)
    return {"success": True, "message": "Post scheduled successfully", "entry": scheduled_entry}

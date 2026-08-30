import os
import httpx
from typing import Dict, Any, Optional
from app.utils.logger import get_logger

logger = get_logger("yt_publisher")

class YouTubePublisher:
    def __init__(self):
        self.token_url = "https://oauth2.googleapis.com/token"
        self.upload_init_url = "https://www.googleapis.com/upload/youtube/v3/videos"
        self.channels_url = "https://www.googleapis.com/youtube/v3/channels"

    async def refresh_access_token(self, client_id: str, client_secret: str, refresh_token: str) -> str:
        """Refreshes and returns a new Google OAuth access token."""
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.token_url, data=data, timeout=15.0)
            if response.status_code != 200:
                logger.error(f"Google Token Refresh failed: {response.text}")
                raise Exception(f"Failed to refresh Google access token: {response.text}")
            
            res_data = response.json()
            access_token = res_data.get("access_token")
            if not access_token:
                raise Exception("No access_token returned from Google OAuth token refresh.")
            return access_token

    async def get_channel_info(self, access_token: str) -> Dict[str, Any]:
        """Fetches the linked YouTube channel name and profile image."""
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        params = {
            "part": "snippet",
            "mine": "true"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(self.channels_url, headers=headers, params=params, timeout=15.0)
            if response.status_code != 200:
                raise Exception(f"Failed to fetch YouTube channel details: {response.text}")
            
            items = response.json().get("items", [])
            if not items:
                raise Exception("No YouTube channel items found for authenticated user.")
            
            snippet = items[0].get("snippet", {})
            title = snippet.get("title", "Unknown Channel")
            thumbnails = snippet.get("thumbnails", {})
            avatar_url = thumbnails.get("default", {}).get("url")
            
            return {
                "name": title,
                "avatarUrl": avatar_url,
                "channelId": items[0].get("id")
            }

    async def publish_video(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        video_path: str,
        title: str,
        caption: str,
        privacy_status: str = "public"
    ) -> Dict[str, Any]:
        """
        Publishes a video to YouTube using standard Google Resumable Media protocol.
        Correctly streams large files asynchronously chunk by chunk.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")
            
        file_size = os.path.getsize(video_path)
        logger.info(f"Initiating YouTube Resumable upload for {video_path} (Size: {file_size} bytes)")
        
        # 1. Get a fresh access token
        try:
            access_token = await self.refresh_access_token(client_id, client_secret, refresh_token)
        except Exception as e:
            logger.error(f"YouTube publishing failed during token refresh: {e}")
            return {"success": False, "error": f"Authentication refresh failed: {str(e)}"}
            
        # 2. Initialize Resumable Session
        init_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": str(file_size),
            "X-Upload-Content-Type": "video/*"
        }
        
        init_params = {
            "uploadType": "resumable",
            "part": "snippet,status"
        }
        
        # Category 22 is "People & Blogs"
        metadata = {
            "snippet": {
                "title": title or os.path.basename(video_path),
                "description": caption,
                "categoryId": "22"
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.upload_init_url,
                    headers=init_headers,
                    params=init_params,
                    json=metadata,
                    timeout=30.0
                )
                if response.status_code not in (200, 201):
                    logger.error(f"YouTube Upload Init failed: {response.text}")
                    return {"success": False, "error": f"YouTube API Initialization failed: {response.text}"}
                
                upload_url = response.headers.get("Location")
                if not upload_url:
                    return {"success": False, "error": "No Location header returned from YouTube Upload Init."}
            except Exception as e:
                logger.error(f"Exception during YouTube Init: {e}")
                return {"success": False, "error": f"Init session exception: {str(e)}"}
                
            # 3. Stream Upload Video Data
            upload_headers = {
                "Content-Length": str(file_size),
                "Content-Type": "video/*"
            }
            
            logger.info(f"Uploading video stream to YouTube Location URL...")
            try:
                import aiofiles
                async def file_chunk_generator():
                    async with aiofiles.open(video_path, "rb") as f:
                        while chunk := await f.read(10 * 1024 * 1024): # 10MB chunk
                            yield chunk
                            
                response = await client.put(
                    upload_url,
                    headers=upload_headers,
                    content=file_chunk_generator(),
                    timeout=None # Unlimited timeout for large video uploads
                )
                
                if response.status_code in (200, 201):
                    res_data = response.json()
                    video_id = res_data.get("id")
                    logger.info(f"Successfully published YouTube Video. ID: {video_id}")
                    return {"success": True, "postId": video_id}
                else:
                    logger.error(f"YouTube Video Upload data transfer failed: {response.text}")
                    return {"success": False, "error": f"Upload failed: {response.text}"}
            except Exception as e:
                logger.error(f"YouTube Video Upload exception: {e}")
                return {"success": False, "error": f"Data transfer exception: {str(e)}"}

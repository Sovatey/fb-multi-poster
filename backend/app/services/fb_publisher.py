import os
import httpx
from typing import Dict, Any, Optional
from app.utils.logger import get_logger

logger = get_logger("fb_publisher")

class FacebookPublisher:
    def __init__(self):
        self.api_version = "v19.0"
        self.base_url = "https://graph.facebook.com"

    async def test_connection(self, page_id: str, access_token: str) -> Dict[str, Any]:
        """
        Tests the page access token and page ID.
        Returns:
            {"status": "connected", "message": "Connected", "name": "..."}
            {"status": "expired", "message": "Token Expired", "name": None}
            {"status": "invalid_id", "message": "Invalid Page ID", "name": None}
        """
        if not page_id or not access_token:
            return {"status": "disconnected", "message": "Missing Page ID or Token", "name": None}
            
        url = f"{self.base_url}/{self.api_version}/{page_id}"
        params = {
            "fields": "name,id,access_token",
            "access_token": access_token
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=15.0)
                res_data = response.json()
                
                if response.status_code == 200:
                    name = res_data.get("name", "Unknown Page")
                    return {"status": "connected", "message": "Connected", "name": name}
                
                # Parse error
                error = res_data.get("error", {})
                error_msg = error.get("message", "").lower()
                error_code = error.get("code")
                error_subcode = error.get("error_subcode")
                
                logger.warning(f"Facebook connection test failed for {page_id}: {res_data}")
                
                if "invalid page" in error_msg or error_code == 803 or error_code == 100:
                    return {"status": "invalid_id", "message": "Invalid Page ID", "name": None}
                elif "expired" in error_msg or "token" in error_msg or error_code == 190:
                    return {"status": "expired", "message": "Token Expired", "name": None}
                else:
                    return {"status": "disconnected", "message": error.get("message", "Validation failed"), "name": None}
                    
            except Exception as e:
                logger.error(f"Network error testing connection to Facebook: {e}")
                return {"status": "disconnected", "message": f"Connection timed out / Network error: {str(e)}", "name": None}

    async def get_page_info(self, page_id: str, access_token: str) -> Optional[Dict[str, Any]]:
        """Retrieves page info like profile picture or cover metadata."""
        url = f"{self.base_url}/{self.api_version}/{page_id}"
        params = {
            "fields": "name,picture",
            "access_token": access_token
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, timeout=15.0)
                if response.status_code == 200:
                    return response.json()
            except Exception as e:
                logger.error(f"Failed to fetch page info for {page_id}: {e}")
        return None

    async def publish_video(
        self, 
        page_id: str, 
        access_token: str, 
        video_path: str, 
        title: str, 
        caption: str
    ) -> Dict[str, Any]:
        """
        Publishes a video to Facebook Page using chunked upload protocol.
        This handles large video uploads (up to 10GB) reliably.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")
            
        file_size = os.path.getsize(video_path)
        chunk_size = 10 * 1024 * 1024  # 10MB chunk size
        
        logger.info(f"Starting chunked video upload for {video_path} (Size: {file_size} bytes) to Page {page_id}")
        
        async with httpx.AsyncClient() as client:
            # PHASE 1: START
            start_url = f"{self.base_url}/{self.api_version}/{page_id}/videos"
            start_data = {
                "upload_phase": "start",
                "access_token": access_token,
                "file_size": str(file_size)
            }
            
            try:
                response = await client.post(start_url, data=start_data, timeout=30.0)
                if response.status_code != 200:
                    logger.error(f"Video Upload Phase 1 (start) failed: {response.text}")
                    return {"success": False, "error": f"Initialization failed: {response.text}"}
                
                res_data = response.json()
                upload_session_id = res_data.get("upload_session_id")
                video_id = res_data.get("video_id")
                start_offset = int(res_data.get("start_offset", 0))
                end_offset = int(res_data.get("end_offset", 0))
                
                if not upload_session_id:
                    return {"success": False, "error": "No upload_session_id returned from Facebook"}
                    
            except Exception as e:
                logger.error(f"Exception during Phase 1 (start): {e}")
                return {"success": False, "error": f"Start phase error: {str(e)}"}
                
            # PHASE 2: TRANSFER CHUNKS
            try:
                with open(video_path, "rb") as f:
                    while start_offset < file_size:
                        f.seek(start_offset)
                        chunk_bytes = f.read(chunk_size)
                        
                        logger.info(f"Uploading chunk: offset {start_offset} of {file_size}")
                        
                        transfer_url = f"{self.base_url}/{self.api_version}/{page_id}/videos"
                        transfer_data = {
                            "upload_phase": "transfer",
                            "access_token": access_token,
                            "upload_session_id": upload_session_id,
                            "start_offset": str(start_offset)
                        }
                        
                        files = {
                            "video_file_chunk": ("chunk.mp4", chunk_bytes, "application/octet-stream")
                        }
                        
                        # Upload chunk with higher timeout for large networks
                        response = await client.post(transfer_url, data=transfer_data, files=files, timeout=60.0)
                        
                        if response.status_code != 200:
                            logger.error(f"Video Upload Phase 2 (transfer) failed at offset {start_offset}: {response.text}")
                            return {"success": False, "error": f"Chunk upload failed: {response.text}"}
                            
                        res_data = response.json()
                        start_offset = int(res_data.get("start_offset", 0))
                        end_offset = int(res_data.get("end_offset", 0))
                        
            except Exception as e:
                logger.error(f"Exception during Phase 2 (transfer): {e}")
                return {"success": False, "error": f"Transfer phase error: {str(e)}"}
                
            # PHASE 3: FINISH
            finish_url = f"{self.base_url}/{self.api_version}/{page_id}/videos"
            finish_data = {
                "upload_phase": "finish",
                "access_token": access_token,
                "upload_session_id": upload_session_id,
                "title": title,
                "description": caption
            }
            
            try:
                response = await client.post(finish_url, data=finish_data, timeout=30.0)
                res_data = response.json()
                
                if response.status_code == 200 and res_data.get("success"):
                    post_id = res_data.get("video_id") or video_id
                    logger.info(f"Successfully published video {video_path} to Facebook Page {page_id}. Post ID: {post_id}")
                    return {"success": True, "postId": post_id}
                else:
                    logger.error(f"Video Upload Phase 3 (finish) failed: {response.text}")
                    return {"success": False, "error": f"Completion failed: {response.text}"}
                    
            except Exception as e:
                logger.error(f"Exception during Phase 3 (finish): {e}")
                return {"success": False, "error": f"Finish phase error: {str(e)}"}

    async def publish_reel(
        self, 
        page_id: str, 
        access_token: str, 
        video_path: str, 
        caption: str
    ) -> Dict[str, Any]:
        """
        Publishes a Reel to Facebook Page.
        Uses the Page Reels API: Initialize -> Upload -> Publish
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")
            
        file_size = os.path.getsize(video_path)
        logger.info(f"Starting Reel upload for {video_path} (Size: {file_size}) to Page {page_id}")
        
        async with httpx.AsyncClient() as client:
            # 1. Initialize Reel
            init_url = f"{self.base_url}/{self.api_version}/{page_id}/video_reels"
            params = {
                "upload_phase": "START",
                "access_token": access_token
            }
            
            try:
                response = await client.post(init_url, params=params, timeout=30.0)
                if response.status_code != 200:
                    logger.error(f"Reel Initialize failed: {response.text}")
                    return {"success": False, "error": f"Reel Init failed: {response.text}"}
                
                res_data = response.json()
                video_id = res_data.get("video_id")
                upload_url = res_data.get("upload_url")
                if not video_id:
                    return {"success": False, "error": "No video_id returned from Reel Initialize"}
            except Exception as e:
                logger.error(f"Reel Init Exception: {e}")
                return {"success": False, "error": f"Reel Init Exception: {str(e)}"}
                
            # 2. Upload Video
            headers = {
                "Authorization": f"OAuth {access_token}"
            }
            
            try:
                if upload_url:
                    headers.update({
                        "offset": "0",
                        "file_size": str(file_size),
                        "X-Entity-Length": str(file_size),
                        "Content-Length": str(file_size),
                        "Content-Type": "application/octet-stream"
                    })
                    import aiofiles
                    async def file_chunk_generator():
                        async with aiofiles.open(video_path, "rb") as f:
                            while chunk := await f.read(10 * 1024 * 1024): # 10MB chunk size
                                yield chunk
                    response = await client.post(upload_url, headers=headers, content=file_chunk_generator(), timeout=None)
                else:
                    fallback_url = f"{self.base_url}/{self.api_version}/{video_id}"
                    with open(video_path, "rb") as f:
                        files = {
                            "video_file": ("video.mp4", f, "video/mp4")
                        }
                        response = await client.post(fallback_url, headers=headers, files=files, timeout=120.0)
                
                if response.status_code != 200:
                    logger.error(f"Reel File Upload failed: {response.text}")
                    return {"success": False, "error": f"Reel Upload failed: {response.text}"}
            except Exception as e:
                logger.error(f"Reel Upload Exception: {e}")
                return {"success": False, "error": f"Reel Upload Exception: {str(e)}"}
                
            # 3. Publish Reel
            publish_url = f"{self.base_url}/{self.api_version}/{page_id}/video_reels"
            publish_data = {
                "upload_phase": "FINISH",
                "access_token": access_token,
                "video_id": video_id,
                "video_state": "PUBLISHED",
                "description": caption
            }
            
            try:
                response = await client.post(publish_url, data=publish_data, timeout=30.0)
                res_data = response.json()
                
                if response.status_code == 200 and res_data.get("success"):
                    logger.info(f"Successfully published Reel to Page {page_id}. Video ID: {video_id}")
                    return {"success": True, "postId": video_id}
                else:
                    logger.error(f"Reel Publish finish failed: {response.text}")
                    # Reels processing takes time, sometimes finish says success is false if still processing.
                    # We check if it returns a success or error message.
                    # As a fallback, we can treat it as pending/success if we successfully uploaded.
                    return {"success": False, "error": f"Reel publish finish failed: {response.text}"}
            except Exception as e:
                logger.error(f"Reel Publish Exception: {e}")
                return {"success": False, "error": f"Reel Publish Exception: {str(e)}"}

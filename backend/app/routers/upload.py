import os
import uuid
import shutil
from fastapi import APIRouter, File, HTTPException, Depends, Request
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException
from app.models.schemas import DownloadRequest, PublishRequest
from app.services.storage_service import StorageService
from app.services.thumbnail_service import ThumbnailService
from app.services.downloader_service import DownloaderService
from app.routers.publish import publish_post, get_publisher, get_yt_publisher
from app.services.fb_publisher import FacebookPublisher
from app.services.yt_publisher import YouTubePublisher
from app.utils.logger import get_logger

logger = get_logger("router.upload")
router = APIRouter()

def get_storage():
    return StorageService()

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}

@router.post("/upload")
async def upload_video(
    request: Request, 
    storage: StorageService = Depends(get_storage)
):
    # Read settings to validate size
    settings = storage.get_settings()
    max_size_mb = settings.get("maxVideoSizeMb", 20480)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    # 1. Content-Length check (fast path)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            length = int(content_length)
            if length > max_size_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum allowed size of {max_size_mb}MB"
                )
        except ValueError:
            pass

    # 2. Overriding Starlette's max_part_size (default 1MB) during parsing
    try:
        form = await request.form(
            max_part_size=max_size_bytes,
            max_files=1000,
            max_fields=1000
        )
    except MultiPartException as exc:
        logger.warning(f"Multipart parse error: {exc}")
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {max_size_mb}MB"
        )
    except Exception as exc:
        logger.error(f"Error parsing upload: {exc}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing upload payload: {str(exc)}"
        )

    # 3. Retrieve the file from form
    file = form.get("file")
    if not file or not isinstance(file, UploadFile):
        raise HTTPException(
            status_code=422,
            detail="Missing 'file' field in multipart form data"
        )

    # Validate extension
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}"
        )
        
    # Save file temporarily to inspect size if not content-length header
    filename = f"{uuid.uuid4()}{ext}"
    target_video_path = os.path.join(storage.videos_dir, filename)
    
    total_written = 0
    try:
        with open(target_video_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024): # 1MB chunks
                total_written += len(chunk)
                if total_written > max_size_bytes:
                    # Exceeded limit
                    buffer.close()
                    os.remove(target_video_path)
                    raise HTTPException(
                        status_code=413, 
                        detail=f"File exceeds maximum allowed size of {max_size_mb}MB"
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        if os.path.exists(target_video_path):
            os.remove(target_video_path)
        raise HTTPException(status_code=500, detail=f"Failed to save video upload: {str(e)}")
        
    # Generate thumbnail
    thumbnail_name = f"{os.path.splitext(filename)[0]}.jpg"
    target_thumb_path = os.path.join(storage.thumbnails_dir, thumbnail_name)
    
    thumb_success = ThumbnailService.generate_thumbnail(target_video_path, target_thumb_path)
    
    return {
        "success": True,
        "filename": filename,
        "originalName": file.filename,
        "videoUrl": f"/static/videos/{filename}",
        "thumbnailUrl": f"/static/thumbnails/{thumbnail_name}" if thumb_success else None,
        "sizeBytes": total_written
    }

@router.get("/media")
def get_media_library(storage: StorageService = Depends(get_storage)):
    return storage.get_media_library()

@router.delete("/media/{filename}")
def delete_media_item(filename: str, storage: StorageService = Depends(get_storage)):
    success = storage.delete_media(filename)
    if not success:
        raise HTTPException(status_code=404, detail="Media file not found")
    return {"success": True, "message": "Media deleted successfully"}

@router.post("/upload/download-url")
async def download_video_from_url(
    payload: DownloadRequest,
    storage: StorageService = Depends(get_storage),
    publisher: FacebookPublisher = Depends(get_publisher),
    yt_publisher: YouTubePublisher = Depends(get_yt_publisher)
):
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="Please provide a valid video URL.")
        
    try:
        download_result = DownloaderService.download_video_from_url(payload.url.strip(), storage)
    except Exception as exc:
        logger.error(f"URL download failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

    publish_result = None
    if payload.autoPublish and payload.pages:
        pub_title = payload.title.strip() if (payload.title and payload.title.strip()) else download_result.get("title", "")
        pub_caption = payload.caption.strip() if (payload.caption and payload.caption.strip()) else download_result.get("description", "")
        
        pub_payload = PublishRequest(
            videoFilename=download_result["filename"],
            title=pub_title,
            caption=pub_caption,
            pages=payload.pages,
            postType=payload.postType,
            pageCustomizations=payload.pageCustomizations
        )
        
        try:
            publish_result = await publish_post(
                payload=pub_payload,
                storage=storage,
                publisher=publisher,
                yt_publisher=yt_publisher
            )
        except Exception as pub_err:
            logger.error(f"Auto-publish failed after download: {pub_err}", exc_info=True)
            publish_result = {"success": False, "error": str(pub_err)}

    return {
        "success": True,
        "filename": download_result["filename"],
        "originalName": download_result["originalName"],
        "title": download_result["title"],
        "videoUrl": download_result["videoUrl"],
        "thumbnailUrl": download_result["thumbnailUrl"],
        "sizeBytes": download_result["sizeBytes"],
        "autoPublished": bool(payload.autoPublish and payload.pages),
        "publishResults": publish_result
    }

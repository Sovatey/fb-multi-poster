import os
import uuid
import shutil
import httpx
from typing import Dict, Any, Optional
from app.services.storage_service import StorageService
from app.services.thumbnail_service import ThumbnailService
from app.utils.logger import get_logger

logger = get_logger("downloader_service")

class DownloaderService:
    @staticmethod
    def _get_ffmpeg_executable() -> Optional[str]:
        """Locates ffmpeg executable from PATH, imageio_ffmpeg, or environment."""
        # 1. System PATH check
        ffmpeg_in_path = shutil.which("ffmpeg")
        if ffmpeg_in_path and os.path.exists(ffmpeg_in_path):
            return ffmpeg_in_path

        # 2. Try imageio_ffmpeg static binary
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and os.path.exists(exe):
                logger.info(f"Using imageio_ffmpeg binary: {exe}")
                return exe
        except Exception as e:
            logger.warning(f"Could not load imageio_ffmpeg binary: {e}")

        return None

    @staticmethod
    def download_video_from_url(url: str, storage: StorageService) -> Dict[str, Any]:
        """
        Downloads video from Facebook, YouTube, TikTok or other platforms at maximum available quality (4K / Full HD).
        Saves video to storage.videos_dir and generates/saves thumbnail to storage.thumbnails_dir.
        """
        import yt_dlp

        unique_id = str(uuid.uuid4())
        output_template = os.path.join(storage.videos_dir, f"{unique_id}.%(ext)s")
        ffmpeg_exe = DownloaderService._get_ffmpeg_executable()

        base_opts = {
            'outtmpl': output_template,
            'writethumbnail': True,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }

        if ffmpeg_exe:
            base_opts['ffmpeg_location'] = ffmpeg_exe

        # Format attempts: Primary tries 4K/Full HD combined stream, Fallback tries single pre-merged stream
        format_strategies = [
            # Strategy 1: Highest quality 4K / Full HD format requiring merge
            {
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
                'merge_output_format': 'mp4',
            },
            # Strategy 2: Single file highest quality (no ffmpeg merge required)
            {
                'format': 'best[ext=mp4]/best/b',
            }
        ]

        # If ffmpeg is not available, jump directly to Strategy 2 (single stream)
        if not ffmpeg_exe:
            logger.warning("FFmpeg executable not detected. Defaulting to single-stream video download.")
            format_strategies = [format_strategies[1]]

        last_error = None
        info = None

        for strategy in format_strategies:
            ydl_opts = {**base_opts, **strategy}
            try:
                logger.info(f"Attempting download from URL: {url} with format: {strategy.get('format')}")
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    if info:
                        break
            except Exception as exc:
                err_str = str(exc)
                logger.warning(f"Download attempt failed with strategy {strategy}: {err_str}")
                last_error = exc
                if "ffmpeg is not installed" in err_str or "merging of multiple formats" in err_str:
                    logger.info("Retrying with single-stream format fallback...")
                    continue
                else:
                    # Non-ffmpeg errors (e.g. invalid URL) don't need retry
                    break

        if not info:
            raise Exception(f"Video download failed: {str(last_error or 'Unknown error')}")

        # Retrieve extracted metadata
        title = info.get('title') or info.get('fulltitle') or "Downloaded Video"
        description = info.get('description') or ""
        thumbnail_url = info.get('thumbnail') or ""
        
        # Determine actual saved filename
        requested_downloads = info.get('requested_downloads')
        saved_filepath = None
        
        if requested_downloads and len(requested_downloads) > 0:
            saved_filepath = requested_downloads[0].get('filepath')
        
        if not saved_filepath or not os.path.exists(saved_filepath):
            # Check files matching unique_id in videos_dir
            for f in os.listdir(storage.videos_dir):
                if f.startswith(unique_id):
                    saved_filepath = os.path.join(storage.videos_dir, f)
                    break
                    
        if not saved_filepath or not os.path.exists(saved_filepath):
            raise Exception("Video download completed but output file could not be found.")

        filename = os.path.basename(saved_filepath)
        name_without_ext, _ = os.path.splitext(filename)
        
        # Handle thumbnail generation / extraction
        thumb_filename = f"{name_without_ext}.jpg"
        target_thumb_path = os.path.join(storage.thumbnails_dir, thumb_filename)
        thumb_created = False

        # 1. Try downloaded thumbnail from yt-dlp if available
        possible_thumb_extensions = ['.jpg', '.webp', '.png', '.jpeg']
        for ext in possible_thumb_extensions:
            thumb_candidate = os.path.join(storage.videos_dir, f"{name_without_ext}{ext}")
            if os.path.exists(thumb_candidate):
                try:
                    from PIL import Image
                    with Image.open(thumb_candidate) as img:
                        img.convert('RGB').save(target_thumb_path, 'JPEG')
                    thumb_created = True
                    os.remove(thumb_candidate)
                    break
                except Exception as thumb_err:
                    logger.warning(f"Failed to process downloaded thumbnail image: {thumb_err}")

        # 2. Try fetching online thumbnail URL if present
        if not thumb_created and thumbnail_url:
            try:
                with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                    resp = client.get(thumbnail_url)
                    if resp.status_code == 200:
                        with open(target_thumb_path, "wb") as f:
                            f.write(resp.content)
                        thumb_created = True
            except Exception as err:
                logger.warning(f"Could not fetch thumbnail URL directly: {err}")

        # 3. Fallback to FFmpeg thumbnail generator
        if not thumb_created:
            thumb_created = ThumbnailService.generate_thumbnail(saved_filepath, target_thumb_path)

        size_bytes = os.path.getsize(saved_filepath)

        logger.info(f"Video download successful: {filename} ({size_bytes} bytes), Title: {title}")

        return {
            "success": True,
            "filename": filename,
            "originalName": title,
            "title": title,
            "description": description,
            "videoUrl": f"/static/videos/{filename}",
            "thumbnailUrl": f"/static/thumbnails/{thumb_filename}" if thumb_created else None,
            "sizeBytes": size_bytes
        }

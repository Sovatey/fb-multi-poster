import os
import subprocess
from app.utils.logger import get_logger

logger = get_logger("thumbnail_service")

class ThumbnailService:
    @staticmethod
    def generate_thumbnail(video_path: str, thumbnail_path: str) -> bool:
        """
        Generates a thumbnail for a video.
        First tries ffmpeg, and if that fails or is missing, falls back to Pillow.
        """
        # Ensure directory exists
        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
        
        # 1. Try ffmpeg
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-ss", "00:00:01",
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                thumbnail_path
            ]
            # Run with short timeout
            result = subprocess.run(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                timeout=10, 
                text=True
            )
            if result.returncode == 0 and os.path.exists(thumbnail_path):
                logger.info(f"Successfully generated thumbnail using ffmpeg for {video_path}")
                return True
            else:
                logger.warning(f"ffmpeg failed to generate thumbnail: {result.stderr}")
        except Exception as e:
            logger.warning(f"ffmpeg not available or failed: {e}")
            
        # 2. Fallback to Pillow
        try:
            from PIL import Image, ImageDraw
            # Create a 640x360 image with a gradient-like dark background
            width, height = 640, 360
            img = Image.new("RGB", (width, height), color=(18, 18, 24))
            draw = ImageDraw.Draw(img)
            
            # Draw a sleek border and background shapes for design
            draw.rectangle([(10, 10), (width - 10, height - 10)], outline=(63, 63, 70), width=2)
            draw.polygon([(0, height), (width, height), (width // 2, height // 2)], fill=(30, 30, 40))
            
            # Text layout
            filename = os.path.basename(video_path)
            title_text = "FB MULTI POSTER"
            subtitle_text = filename if len(filename) < 40 else f"{filename[:37]}..."
            
            # Draw text (using default font since it works anywhere without loading external fonts)
            draw.text((30, 40), title_text, fill=(168, 85, 247)) # Purple highlight
            draw.text((30, 80), subtitle_text, fill=(255, 255, 255))
            draw.text((30, 120), "Preview Unavailable (Auto-generated)", fill=(113, 113, 122))
            
            img.save(thumbnail_path, "JPEG")
            logger.info(f"Successfully generated fallback thumbnail using Pillow for {video_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to generate fallback thumbnail using Pillow: {e}")
            return False

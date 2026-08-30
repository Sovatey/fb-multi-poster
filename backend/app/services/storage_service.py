import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.utils.file_utils import atomic_write_json, read_json_file, get_video_duration
from app.utils.logger import get_logger

logger = get_logger("storage_service")

class StorageService:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.storage_dir = os.path.join(self.base_dir, "storage")
        
        # Core files (always kept in local storage for stability)
        self.config_path = os.path.join(self.storage_dir, "config.json")
        self.history_path = os.path.join(self.storage_dir, "history.json")
        self.scheduled_path = os.path.join(self.storage_dir, "scheduled.json")
        
        # Ensure base storage directory and config exist before reading
        os.makedirs(self.storage_dir, exist_ok=True)
        if not os.path.exists(self.config_path):
            self._write_default_config()
            
        # Read storageDir setting from config
        config = read_json_file(self.config_path, {})
        custom_media_dir = config.get("settings", {}).get("storageDir")
        
        if custom_media_dir:
            self.media_base_dir = custom_media_dir
        else:
            self.media_base_dir = self.storage_dir
            
        # Core folders (redirected if custom storageDir is specified)
        self.videos_dir = os.path.join(self.media_base_dir, "videos")
        self.thumbnails_dir = os.path.join(self.media_base_dir, "thumbnails")
        self.logs_dir = os.path.join(self.media_base_dir, "logs")
        
        # Ensure media directories exist
        os.makedirs(self.videos_dir, exist_ok=True)
        os.makedirs(self.thumbnails_dir, exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Configure and clean custom temp directory on the configured storage drive
        self.temp_dir = os.path.join(self.media_base_dir, "temp")
        os.makedirs(self.temp_dir, exist_ok=True)
        
        try:
            for f in os.listdir(self.temp_dir):
                file_path = os.path.join(self.temp_dir, f)
                if os.path.isfile(file_path):
                    os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to clean temp directory: {e}")
            
        import tempfile
        tempfile.tempdir = self.temp_dir
        logger.info(f"Redirected Python tempfile directory to: {self.temp_dir}")

    def _write_default_config(self):
        default_config = {
            "pages": [
                { "name": "NT Video", "pageId": "", "accessToken": "", "status": "disconnected" },
                { "name": "Midnight Tales", "pageId": "", "accessToken": "", "status": "disconnected" },
                { "name": "StoryVerse", "pageId": "", "accessToken": "", "status": "disconnected" }
            ],
            "settings": {
                "maxVideoSizeMb": 20480,
                "openaiApiKey": "",
                "openaiBaseUrl": "https://api.openai.com/v1",
                "openaiModel": "gpt-4o-mini",
                "storageDir": ""
            },
            "templates": {
                "captions": [],
                "hashtags": []
            }
        }
        atomic_write_json(self.config_path, default_config)

    # Config Methods
    def get_config(self) -> Dict[str, Any]:
        return read_json_file(self.config_path, {})

    def save_config(self, config: Dict[str, Any]) -> None:
        atomic_write_json(self.config_path, config)

    def get_settings(self) -> Dict[str, Any]:
        config = self.get_config()
        return config.get("settings", {})

    def save_settings(self, settings: Dict[str, Any]) -> None:
        config = self.get_config()
        config["settings"] = settings
        self.save_config(config)

    def get_pages(self) -> List[Dict[str, Any]]:
        config = self.get_config()
        return config.get("pages", [])

    def save_pages(self, pages: List[Dict[str, Any]]) -> None:
        config = self.get_config()
        config["pages"] = pages
        self.save_config(config)

    # History Methods
    def get_history(self) -> List[Dict[str, Any]]:
        return read_json_file(self.history_path, [])

    def save_history(self, history: List[Dict[str, Any]]) -> None:
        atomic_write_json(self.history_path, history)

    def add_history_entry(self, entry: Dict[str, Any]) -> None:
        history = self.get_history()
        history.insert(0, entry) # Prepend newest
        self.save_history(history)

    def delete_history_entry(self, entry_id: str) -> bool:
        history = self.get_history()
        updated = [h for h in history if h.get("id") != entry_id]
        if len(updated) != len(history):
            self.save_history(updated)
            return True
        return False

    # Scheduled Methods
    def get_scheduled(self) -> List[Dict[str, Any]]:
        return read_json_file(self.scheduled_path, [])

    def save_scheduled(self, scheduled: List[Dict[str, Any]]) -> None:
        atomic_write_json(self.scheduled_path, scheduled)

    def add_scheduled_entry(self, entry: Dict[str, Any]) -> None:
        scheduled = self.get_scheduled()
        scheduled.append(entry)
        self.save_scheduled(scheduled)

    def update_scheduled_entry(self, entry_id: str, updated_entry: Dict[str, Any]) -> bool:
        scheduled = self.get_scheduled()
        for idx, item in enumerate(scheduled):
            if item.get("id") == entry_id:
                scheduled[idx] = updated_entry
                self.save_scheduled(scheduled)
                return True
        return False

    def delete_scheduled_entry(self, entry_id: str) -> bool:
        scheduled = self.get_scheduled()
        updated = [s for s in scheduled if s.get("id") != entry_id]
        if len(updated) != len(scheduled):
            self.save_scheduled(updated)
            return True
        return False

    # Media Library Methods
    def get_media_library(self) -> List[Dict[str, Any]]:
        media_list = []
        if not os.path.exists(self.videos_dir):
            return []
        
        for filename in os.listdir(self.videos_dir):
            video_path = os.path.join(self.videos_dir, filename)
            if not os.path.isfile(video_path):
                continue
            
            # Extract basic stats
            file_stats = os.stat(video_path)
            size_bytes = file_stats.st_size
            upload_date = datetime.fromtimestamp(file_stats.st_ctime).isoformat()
            
            # Look for thumbnail
            name_without_ext, _ = os.path.splitext(filename)
            thumbnail_name = f"{name_without_ext}.jpg"
            thumbnail_path = os.path.join(self.thumbnails_dir, thumbnail_name)
            
            thumbnail_url = f"/static/thumbnails/{thumbnail_name}" if os.path.exists(thumbnail_path) else None
            
            # Read duration if stored, else calculate
            duration = get_video_duration(video_path)
            
            media_list.append({
                "id": filename,
                "filename": filename,
                "videoPath": f"/static/videos/{filename}",
                "thumbnailPath": thumbnail_url,
                "duration": duration,
                "sizeBytes": size_bytes,
                "uploadDate": upload_date
            })
            
        # Sort by upload date descending
        media_list.sort(key=lambda x: x["uploadDate"], reverse=True)
        return media_list

    def delete_media(self, filename: str) -> bool:
        video_path = os.path.join(self.videos_dir, filename)
        name_without_ext, _ = os.path.splitext(filename)
        thumbnail_path = os.path.join(self.thumbnails_dir, f"{name_without_ext}.jpg")
        
        deleted = False
        if os.path.exists(video_path):
            os.remove(video_path)
            deleted = True
        if os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)
            deleted = True
        return deleted

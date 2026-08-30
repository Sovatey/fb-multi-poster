import os
import json
import tempfile
import subprocess
import shutil
from typing import Dict, Any, Union
from app.utils.logger import get_logger

logger = get_logger("file_utils")

def atomic_write_json(file_path: str, data: Union[Dict[str, Any], list]) -> None:
    """Writes data to a temporary file first, then renames it to target path for atomic safety."""
    temp_dir = os.path.dirname(file_path)
    os.makedirs(temp_dir, exist_ok=True)
    
    fd, temp_path = tempfile.mkstemp(dir=temp_dir, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        # atomic replacement
        shutil.move(temp_path, file_path)
    except Exception as e:
        logger.error(f"Error saving file atomic write to {file_path}: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e

def read_json_file(file_path: str, default_value: Any = None) -> Any:
    """Reads a JSON file safely, returns default if missing or corrupted."""
    if not os.path.exists(file_path):
        return default_value
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading JSON file {file_path}: {e}")
        return default_value

def get_directory_size(directory: str) -> int:
    """Returns the total size of files in a directory in bytes."""
    total_size = 0
    if not os.path.exists(directory):
        return 0
    for dirpath, _, filenames in os.walk(directory):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

def get_video_duration(video_path: str) -> float:
    """
    Attempts to get the duration of a video using ffprobe.
    Falls back to 0.0 if not found or fails.
    """
    try:
        # Try running ffprobe
        cmd = [
            "ffprobe", 
            "-v", "error", 
            "-show_entries", "format=duration", 
            "-of", "default=noprint_wrappers=1:nokey=1", 
            video_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"Failed to get video duration using ffprobe for {video_path}: {e}")
        # Try a quick fallback using other tools or just return 0.0
        return 0.0

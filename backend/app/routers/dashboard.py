import os
import re
from collections import Counter
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from app.services.storage_service import StorageService
from app.utils.file_utils import get_directory_size
from app.utils.logger import get_logger

logger = get_logger("router.dashboard")
router = APIRouter()

def get_storage():
    return StorageService()

@router.get("/dashboard/stats")
def get_dashboard_stats(storage: StorageService = Depends(get_storage)):
    history = storage.get_history()
    scheduled = storage.get_scheduled()
    config = storage.get_config()
    
    # Calculate Page-level metrics
    total_posts = 0
    successful_posts = 0
    failed_posts = 0
    
    for entry in history:
        pages = entry.get("pages", [])
        total_posts += len(pages)
        for p in pages:
            if p.get("status") == "success":
                successful_posts += 1
            else:
                failed_posts += 1
                
    scheduled_posts = sum(len(s.get("pages", [])) for s in scheduled)
    
    # Storage metrics
    videos_bytes = get_directory_size(storage.videos_dir)
    thumbnails_bytes = get_directory_size(storage.thumbnails_dir)
    total_bytes = videos_bytes + thumbnails_bytes
    
    settings = config.get("settings", {})
    max_size_mb = settings.get("maxVideoSizeMb", 10240)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    storage_usage = {
        "videosBytes": videos_bytes,
        "thumbnailsBytes": thumbnails_bytes,
        "totalBytes": total_bytes,
        "maxSizeBytes": max_size_bytes,
        "percentUsed": round((total_bytes / max_size_bytes) * 100, 2) if max_size_bytes > 0 else 0
    }
    
    # Pages Connection Status
    pages_status = []
    for page in config.get("pages", []):
        pages_status.append({
            "name": page.get("name"),
            "pageId": page.get("pageId"),
            "status": page.get("status", "disconnected")
        })
        
    # Most used page & hashtags calculation
    all_target_pages = []
    all_hashtags = []
    
    for entry in history:
        # Collect pages
        for p in entry.get("pages", []):
            all_target_pages.append(p.get("name"))
            
        # Collect hashtags from caption
        caption = entry.get("caption", "")
        tags = re.findall(r"#\w+", caption)
        all_hashtags.extend([t.lower() for t in tags])
        
    most_used_page = "None"
    if all_target_pages:
        most_used_page = Counter(all_target_pages).most_common(1)[0][0]
        
    most_used_hashtags = []
    if all_hashtags:
        most_used_hashtags = [tag for tag, count in Counter(all_hashtags).most_common(5)]
        
    # Trends grouping (last 7 days, last 4 weeks, last 6 months)
    # 1. Daily Posts (Last 7 Days)
    daily_posts = []
    today = datetime.now().date()
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        date_str = target_date.strftime("%Y-%m-%d")
        
        count = 0
        for entry in history:
            try:
                entry_date = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")).date()
                if entry_date == target_date:
                    count += sum(1 for p in entry.get("pages", []))
            except Exception:
                pass
        daily_posts.append({"date": date_str, "posts": count})
        
    # 2. Weekly Posts (Last 4 Weeks)
    weekly_posts = []
    for i in range(3, -1, -1):
        start_date = today - timedelta(days=today.weekday() + (i * 7)) # Start of week (Monday)
        end_date = start_date + timedelta(days=6)
        week_label = f"Wk {start_date.strftime('%d %b')}"
        
        count = 0
        for entry in history:
            try:
                entry_date = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")).date()
                if start_date <= entry_date <= end_date:
                    count += sum(1 for p in entry.get("pages", []))
            except Exception:
                pass
        weekly_posts.append({"week": week_label, "posts": count})
        
    # 3. Monthly Posts (Last 6 Months)
    monthly_posts = []
    # Simplified month labels
    for i in range(5, -1, -1):
        # Approximate mid-month points
        target_month_date = today - timedelta(days=i * 30)
        month_label = target_month_date.strftime("%b %Y")
        
        count = 0
        for entry in history:
            try:
                entry_date = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")).date()
                if entry_date.year == target_month_date.year and entry_date.month == target_month_date.month:
                    count += sum(1 for p in entry.get("pages", []))
            except Exception:
                pass
        monthly_posts.append({"month": month_label, "posts": count})

    success_rate = 100.0
    total_attempts = successful_posts + failed_posts
    if total_attempts > 0:
        success_rate = round((successful_posts / total_attempts) * 100, 1)

    return {
        "cards": {
            "totalPosts": total_posts,
            "successfulPosts": successful_posts,
            "failedPosts": failed_posts,
            "scheduledPosts": scheduled_posts,
            "successRate": success_rate
        },
        "storage": storage_usage,
        "pagesStatus": pages_status,
        "mostUsedPage": most_used_page,
        "mostUsedHashtags": most_used_hashtags,
        "trends": {
            "daily": daily_posts,
            "weekly": weekly_posts,
            "monthly": monthly_posts
        },
        "recentActivity": history[:5]
    }

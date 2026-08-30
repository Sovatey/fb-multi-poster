import asyncio
import sys
import os

# Ensure backend folder is in path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from app.scheduler.bg_scheduler import process_scheduled_posts

if __name__ == "__main__":
    print("Running scheduled post check...")
    asyncio.run(process_scheduled_posts())
    print("Finished checking scheduled posts.")

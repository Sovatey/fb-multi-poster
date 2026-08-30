from fastapi import APIRouter, HTTPException, Depends
from app.services.storage_service import StorageService
from app.utils.logger import get_logger

logger = get_logger("router.history")
router = APIRouter()

def get_storage():
    return StorageService()

@router.get("/history")
def get_all_history(storage: StorageService = Depends(get_storage)):
    return storage.get_history()

@router.get("/history/{entry_id}")
def get_history_entry(entry_id: str, storage: StorageService = Depends(get_storage)):
    history = storage.get_history()
    for entry in history:
        if entry.get("id") == entry_id:
            return entry
    raise HTTPException(status_code=404, detail="History entry not found")

@router.delete("/history/{entry_id}")
def delete_history_entry(entry_id: str, storage: StorageService = Depends(get_storage)):
    success = storage.delete_history_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"success": True, "message": "History entry deleted"}

# Additional utility routes for scheduled post management in the UI
@router.get("/scheduled")
def get_all_scheduled(storage: StorageService = Depends(get_storage)):
    return storage.get_scheduled()

@router.delete("/scheduled/{entry_id}")
def delete_scheduled_post(entry_id: str, storage: StorageService = Depends(get_storage)):
    success = storage.delete_scheduled_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    return {"success": True, "message": "Scheduled post deleted / cancelled"}

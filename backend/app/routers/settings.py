from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import ConfigUpdateModel, TestConnectionRequest
from app.services.storage_service import StorageService
from app.services.fb_publisher import FacebookPublisher
from app.utils.logger import get_logger

logger = get_logger("router.settings")
router = APIRouter()

# Simple Dependency Injectors
def get_storage():
    return StorageService()

def get_publisher():
    return FacebookPublisher()

@router.get("/settings")
def get_settings(storage: StorageService = Depends(get_storage)):
    return storage.get_config()

@router.post("/settings")
def update_settings(payload: ConfigUpdateModel, storage: StorageService = Depends(get_storage)):
    config = storage.get_config()
    
    if payload.settings is not None:
        existing_settings = config.get("settings", {})
        new_settings = payload.settings.model_dump()
        if not new_settings.get("storageDir") and existing_settings.get("storageDir"):
            new_settings["storageDir"] = existing_settings["storageDir"]
        config["settings"] = new_settings
    if payload.pages is not None:
        config["pages"] = [page.model_dump() for page in payload.pages]
    if payload.youtubeChannels is not None:
        config["youtubeChannels"] = [channel.model_dump() for channel in payload.youtubeChannels]
    if payload.templates is not None:
        config["templates"] = payload.templates.model_dump()
        
    storage.save_config(config)
    return {"success": True, "message": "Settings updated successfully", "config": config}

@router.post("/facebook/test")
async def test_facebook_connection(
    payload: TestConnectionRequest, 
    publisher: FacebookPublisher = Depends(get_publisher)
):
    result = await publisher.test_connection(payload.pageId, payload.accessToken)
    return result

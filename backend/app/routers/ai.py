from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import AISummaryRequest
from app.services.storage_service import StorageService
from app.services.ai_service import AIService
from app.utils.logger import get_logger

logger = get_logger("router.ai")
router = APIRouter()

def get_storage():
    return StorageService()

def get_ai_service():
    return AIService()

@router.post("/ai/title")
async def generate_ai_title(
    payload: AISummaryRequest,
    storage: StorageService = Depends(get_storage),
    ai_service: AIService = Depends(get_ai_service)
):
    settings = storage.get_settings()
    try:
        title = await ai_service.generate_title(payload.storySummary, settings)
        return {"success": True, "title": title}
    except Exception as e:
        logger.error(f"Error in /ai/title: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/caption")
async def generate_ai_caption(
    payload: AISummaryRequest,
    storage: StorageService = Depends(get_storage),
    ai_service: AIService = Depends(get_ai_service)
):
    settings = storage.get_settings()
    try:
        caption = await ai_service.generate_caption(payload.storySummary, settings)
        return {"success": True, "caption": caption}
    except Exception as e:
        logger.error(f"Error in /ai/caption: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/hashtags")
async def generate_ai_hashtags(
    payload: AISummaryRequest,
    storage: StorageService = Depends(get_storage),
    ai_service: AIService = Depends(get_ai_service)
):
    settings = storage.get_settings()
    try:
        hashtags = await ai_service.generate_hashtags(payload.storySummary, settings)
        return {"success": True, "hashtags": hashtags}
    except Exception as e:
        logger.error(f"Error in /ai/hashtags: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/page-variations")
async def generate_ai_page_variations(
    payload: AISummaryRequest,
    storage: StorageService = Depends(get_storage),
    ai_service: AIService = Depends(get_ai_service)
):
    settings = storage.get_settings()
    try:
        variations = await ai_service.generate_page_variations(payload.storySummary, settings)
        return {"success": True, "variations": variations}
    except Exception as e:
        logger.error(f"Error in /ai/page-variations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

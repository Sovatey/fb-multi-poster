import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers import upload, publish, history, settings, ai, dashboard, youtube_auth
from app.scheduler.bg_scheduler import start_scheduler, shutdown_scheduler
from app.services.storage_service import StorageService
from app.utils.logger import get_logger

logger = get_logger("main")

# Ensure storage subfolders exist prior to serving static files
storage_service = StorageService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start APScheduler
    logger.info("Application starting up...")
    start_scheduler()
    yield
    # Shutdown: Stop APScheduler
    logger.info("Application shutting down...")
    shutdown_scheduler()

app = FastAPI(
    title="FB Multi Poster API",
    description="Backend services for FB Multi Poster single-user publishing system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since it's a local single-user application, wildcards are safe and prevent CORS bugs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static folders for uploaded videos and thumbnails
app.mount("/static/videos", StaticFiles(directory=storage_service.videos_dir), name="videos")
app.mount("/static/thumbnails", StaticFiles(directory=storage_service.thumbnails_dir), name="thumbnails")

# Register routers
app.include_router(upload.router, tags=["Upload & Media"])
app.include_router(publish.router, tags=["Publishing & Scheduling"])
app.include_router(history.router, tags=["History & Queue"])
app.include_router(settings.router, tags=["Settings & Credentials"])
app.include_router(youtube_auth.router, tags=["YouTube OAuth"])
app.include_router(ai.router, tags=["AI Tools"])
app.include_router(dashboard.router, tags=["Dashboard & Stats"])

# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception caught on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": f"An internal server error occurred: {str(exc)}"}
    )

@app.get("/")
def read_root():
    return {"name": "FB Multi Poster API", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8800, reload=True)

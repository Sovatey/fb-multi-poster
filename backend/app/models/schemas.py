from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SettingsModel(BaseModel):
    maxVideoSizeMb: int = Field(default=10240, description="Max video file size in MB")
    openaiApiKey: str = Field(default="", description="OpenAI API Key")
    openaiBaseUrl: str = Field(default="https://api.openai.com/v1", description="OpenAI API Base URL")
    openaiModel: str = Field(default="gpt-4o-mini", description="OpenAI Model Name")
    googleClientId: str = Field(default="", description="Google Client ID")
    googleClientSecret: str = Field(default="", description="Google Client Secret")
    storageDir: str = Field(default="", description="Storage directory path")

class PageModel(BaseModel):
    name: str
    pageId: str
    accessToken: str
    status: Optional[str] = "disconnected"

class YouTubeChannelModel(BaseModel):
    name: str
    channelId: str
    refreshToken: str
    avatarUrl: Optional[str] = None
    status: Optional[str] = "disconnected"

class CaptionTemplateModel(BaseModel):
    id: str
    name: str
    content: str

class HashtagTemplateModel(BaseModel):
    id: str
    name: str
    content: str

class TemplatesModel(BaseModel):
    captions: List[CaptionTemplateModel] = []
    hashtags: List[HashtagTemplateModel] = []

class ConfigUpdateModel(BaseModel):
    pages: Optional[List[PageModel]] = None
    youtubeChannels: Optional[List[YouTubeChannelModel]] = None
    settings: Optional[SettingsModel] = None
    templates: Optional[TemplatesModel] = None

class TestConnectionRequest(BaseModel):
    pageId: str
    accessToken: str

class PublishRequest(BaseModel):
    videoFilename: str
    title: str
    caption: str
    pages: List[str]  # List of page names to publish to
    postType: str = "video" # "video" or "reel"
    pageCustomizations: Optional[Dict[str, Dict[str, Any]]] = None

class ScheduleRequest(BaseModel):
    videoFilename: str
    title: str
    caption: str
    pages: List[str]
    timestamp: str  # ISO 8601 string
    timezone: str = "UTC"
    postType: str = "video" # "video" or "reel"
    pageCustomizations: Optional[Dict[str, Dict[str, Any]]] = None

class AISummaryRequest(BaseModel):
    storySummary: str

class DownloadRequest(BaseModel):
    url: str
    autoPublish: bool = False
    title: Optional[str] = ""
    caption: Optional[str] = ""
    pages: List[str] = []
    postType: str = "video" # "video" or "reel"
    pageCustomizations: Optional[Dict[str, Dict[str, Any]]] = None

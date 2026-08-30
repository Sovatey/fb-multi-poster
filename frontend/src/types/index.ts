export interface FacebookPage {
  name: string;
  pageId: string;
  accessToken: string;
  status?: 'connected' | 'expired' | 'invalid_id' | 'disconnected';
}

export interface YouTubeChannel {
  name: string;
  channelId: string;
  refreshToken: string;
  avatarUrl?: string;
  status?: 'connected' | 'expired' | 'disconnected';
}

export interface Settings {
  maxVideoSizeMb: number;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  googleClientId?: string;
  googleClientSecret?: string;
  storageDir?: string;
}

export interface CaptionTemplate {
  id: string;
  name: string;
  content: string;
}

export interface HashtagTemplate {
  id: string;
  name: string;
  content: string;
}

export interface Templates {
  captions: CaptionTemplate[];
  hashtags: HashtagTemplate[];
}

export interface AppConfig {
  pages: FacebookPage[];
  youtubeChannels?: YouTubeChannel[];
  settings: Settings;
  templates: Templates;
}

export interface PagePublishResult {
  name: string;
  pageId: string;
  status: 'success' | 'failed';
  postId: string | null;
  error: string | null;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  videoPath: string;
  thumbnailPath: string | null;
  title: string;
  caption: string;
  pages: PagePublishResult[];
  executionTimeMs: number;
  pageCustomizations?: Record<string, { title?: string; caption: string }>;
}

export interface ScheduledEntry {
  id: string;
  timestamp: string;
  videoPath: string;
  thumbnailPath: string | null;
  title: string;
  caption: string;
  pages: string[];
  timezone: string;
  postType: 'video' | 'reel' | 'short' | 'fb_reel_yt_video';
  status: 'pending' | 'processing' | 'published' | 'failed';
  pageCustomizations?: Record<string, { title?: string; caption: string }>;
}

export interface MediaItem {
  id: string;
  filename: string;
  videoPath: string;
  thumbnailPath: string | null;
  duration: number;
  sizeBytes: number;
  uploadDate: string;
}

export interface TrendDataPoint {
  date?: string;
  week?: string;
  month?: string;
  posts: number;
}

export interface DashboardStats {
  cards: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    scheduledPosts: number;
    successRate: number;
  };
  storage: {
    videosBytes: number;
    thumbnailsBytes: number;
    totalBytes: number;
    maxSizeBytes: number;
    percentUsed: number;
  };
  pagesStatus: {
    name: string;
    pageId: string;
    status: string;
  }[];
  mostUsedPage: string;
  mostUsedHashtags: string[];
  trends: {
    daily: TrendDataPoint[];
    weekly: TrendDataPoint[];
    monthly: TrendDataPoint[];
  };
  recentActivity: HistoryEntry[];
}

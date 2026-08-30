import axios from 'axios';
import type { 
  AppConfig, 
  HistoryEntry, 
  ScheduledEntry, 
  MediaItem, 
  DashboardStats 
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8800';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Settings API
  getSettings: async (): Promise<AppConfig> => {
    const res = await client.get('/settings');
    return res.data;
  },
  
  updateSettings: async (config: Partial<AppConfig>): Promise<{ success: boolean; config: AppConfig }> => {
    const res = await client.post('/settings', config);
    return res.data;
  },
  
  testFacebookConnection: async (pageId: string, accessToken: string): Promise<{ status: string; message: string; name: string | null }> => {
    const res = await client.post('/facebook/test', { pageId, accessToken });
    return res.data;
  },
  
  // Media Library API
  getMediaLibrary: async (): Promise<MediaItem[]> => {
    const res = await client.get('/media');
    return res.data;
  },
  
  deleteMediaItem: async (filename: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/media/${filename}`);
    return res.data;
  },
  
  uploadVideo: async (
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<{
    success: boolean;
    filename: string;
    originalName: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    sizeBytes: number;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  downloadVideoFromUrl: async (payload: {
    url: string;
    autoPublish?: boolean;
    title?: string;
    caption?: string;
    pages?: string[];
    postType?: string;
    pageCustomizations?: Record<string, { title?: string; caption: string }>;
  }): Promise<{
    success: boolean;
    filename: string;
    originalName: string;
    title: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    sizeBytes: number;
    autoPublished: boolean;
    publishResults?: any;
  }> => {
    const res = await client.post('/upload/download-url', payload);
    return res.data;
  },
  
  // Publishing API
  publishPost: async (payload: {
    videoFilename: string;
    title: string;
    caption: string;
    pages: string[];
    postType: string;
    pageCustomizations?: Record<string, { title?: string; caption: string }>;
  }): Promise<{ success: boolean; results: any[]; history: HistoryEntry }> => {
    const res = await client.post('/publish', payload);
    return res.data;
  },
  
  schedulePost: async (payload: {
    videoFilename: string;
    title: string;
    caption: string;
    pages: string[];
    timestamp: string;
    timezone: string;
    postType: string;
    pageCustomizations?: Record<string, { title?: string; caption: string }>;
  }): Promise<{ success: boolean; entry: ScheduledEntry }> => {
    const res = await client.post('/schedule', payload);
    return res.data;
  },
  
  // History & Schedule API
  getHistory: async (): Promise<HistoryEntry[]> => {
    const res = await client.get('/history');
    return res.data;
  },
  
  deleteHistoryEntry: async (id: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/history/${id}`);
    return res.data;
  },
  
  getScheduled: async (): Promise<ScheduledEntry[]> => {
    const res = await client.get('/scheduled');
    return res.data;
  },
  
  deleteScheduledPost: async (id: string): Promise<{ success: boolean }> => {
    const res = await client.delete(`/scheduled/${id}`);
    return res.data;
  },
  
  // Dashboard API
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await client.get('/dashboard/stats');
    return res.data;
  },
  
  // AI Generation API
  generateAiTitle: async (storySummary: string): Promise<{ success: boolean; title: string }> => {
    const res = await client.post('/ai/title', { storySummary });
    return res.data;
  },
  
  generateAiCaption: async (storySummary: string): Promise<{ success: boolean; caption: string }> => {
    const res = await client.post('/ai/caption', { storySummary });
    return res.data;
  },
  
  generateAiHashtags: async (storySummary: string): Promise<{ success: boolean; hashtags: string }> => {
    const res = await client.post('/ai/hashtags', { storySummary });
    return res.data;
  },
  
  generateAiPageVariations: async (storySummary: string): Promise<{ success: boolean; variations: Record<string, string> }> => {
    const res = await client.post('/ai/page-variations', { storySummary });
    return res.data;
  },
};

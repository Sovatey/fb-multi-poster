import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Col, Row, Input, Button, Modal, Empty, Tooltip, notification, Popconfirm } from 'antd';
import { SearchOutlined, PlayCircleOutlined, DeleteOutlined, SendOutlined, SyncOutlined, CloudDownloadOutlined, LinkOutlined } from '@ant-design/icons';
import { api, API_BASE_URL } from '../services/api';
import type { MediaItem } from '../types';
import dayjs from 'dayjs';

interface MediaLibraryProps {
  onNavigate: (page: string) => void;
  onSetReuseVideo: (filename: string) => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ onNavigate, onSetReuseVideo }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImportVideo = async () => {
    if (!importUrl || !importUrl.trim()) {
      notification.warning({ message: 'URL Required', description: 'Please paste a valid video URL.' });
      return;
    }
    setImporting(true);
    try {
      const res = await api.downloadVideoFromUrl({
        url: importUrl.trim(),
        autoPublish: false
      });
      if (res.success) {
        notification.success({
          message: '4K/Full HD Video Imported!',
          description: `Successfully downloaded ${res.title} into your media library.`
        });
        setImportUrl('');
        setIsDownloadModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      }
    } catch (err: any) {
      notification.error({
        message: 'Import Failed',
        description: err.response?.data?.detail || 'Failed to download video from link.'
      });
    } finally {
      setImporting(false);
    }
  };

  const { data: mediaItems = [], isLoading, refetch } = useQuery({
    queryKey: ['mediaLibrary'],
    queryFn: api.getMediaLibrary,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteMediaItem,
    onSuccess: () => {
      notification.success({ message: 'Media Deleted', description: 'Video file and thumbnail deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err: any) => {
      notification.error({ message: 'Delete Failed', description: err.response?.data?.detail || 'Failed to delete file' });
    }
  });

  const handleDelete = (filename: string) => {
    deleteMutation.mutate(filename);
  };

  const handleReuse = (filename: string) => {
    onSetReuseVideo(filename);
    onNavigate('publish');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredItems = mediaItems.filter(item => 
    item.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Input
          placeholder="Search by filename..."
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
          style={{ width: '320px', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            type="primary"
            icon={<CloudDownloadOutlined />}
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', border: 'none' }}
            onClick={() => setIsDownloadModalOpen(true)}
          >
            Import Video from Link (FB, YT, TikTok)
          </Button>
          <Button 
            type="dashed" 
            icon={<SyncOutlined />} 
            style={{ borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
            onClick={() => refetch()}
          >
            Refresh Library
          </Button>
        </div>
      </div>

      <Modal
        title={<span style={{ color: '#fff' }}>🔗 Download Video from URL (4K / Full HD)</span>}
        open={isDownloadModalOpen}
        onCancel={() => setIsDownloadModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsDownloadModalOpen(false)}>Cancel</Button>,
          <Button 
            key="import" 
            type="primary" 
            loading={importing}
            icon={<CloudDownloadOutlined />}
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', border: 'none' }}
            onClick={handleImportVideo}
          >
            {importing ? 'Downloading 4K Video...' : 'Download & Import Video'}
          </Button>
        ]}
      >
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '16px' }}>
          Paste a Facebook, YouTube, or TikTok video link. The video will be fetched in 4K / Full HD maximum quality and stored in your local media library.
        </p>
        <Input
          size="large"
          placeholder="Paste Facebook, YouTube, or TikTok video link..."
          prefix={<LinkOutlined style={{ color: '#a855f7' }} />}
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(168,85,247,0.3)', color: '#fff' }}
        />
      </Modal>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <SyncOutlined spin style={{ fontSize: '32px', color: '#a855f7' }} />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.65)' }}>Scanning media directory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Empty 
          description={<span style={{ color: 'rgba(255,255,255,0.45)' }}>No media files found. Upload a video in Quick Publish to get started.</span>} 
          style={{ padding: '40px 0' }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredItems.map((item) => (
            <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
              <Card
                className="glass-panel glow-card"
                bordered={false}
                cover={
                  <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                    {item.thumbnailPath ? (
                      <img 
                        src={`${API_BASE_URL}${item.thumbnailPath}`} 
                        alt={item.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlayCircleOutlined style={{ fontSize: '40px', color: 'rgba(255,255,255,0.2)' }} />
                      </div>
                    )}
                    
                    {/* Play Overlay */}
                    <div 
                      onClick={() => setPreviewItem(item)}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, cursor: 'pointer', transition: 'opacity 0.3s' }}
                      className="play-hover-overlay"
                    >
                      <PlayCircleOutlined style={{ fontSize: '48px', color: '#fff' }} />
                    </div>
                    <style>{`
                      .play-hover-overlay:hover { opacity: 1 !important; }
                    `}</style>

                    {/* Duration badge */}
                    <span style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '2px 6px', background: 'rgba(0,0,0,0.85)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                      {formatDuration(item.duration)}
                    </span>
                  </div>
                }
                actions={[
                  <Tooltip title="Reuse Video" key="reuse">
                    <Button 
                      type="text" 
                      icon={<SendOutlined style={{ color: '#a855f7' }} />} 
                      onClick={() => handleReuse(item.filename)}
                    />
                  </Tooltip>,
                  <Tooltip title="Play Video" key="play">
                    <Button 
                      type="text" 
                      icon={<PlayCircleOutlined style={{ color: '#3b82f6' }} />} 
                      onClick={() => setPreviewItem(item)}
                    />
                  </Tooltip>,
                  <Tooltip title="Delete Video" key="delete">
                    <Popconfirm
                      title="Delete Video"
                      description="Are you sure you want to delete this video file and thumbnail permanently?"
                      onConfirm={() => handleDelete(item.filename)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        type="text" 
                        danger
                        icon={<DeleteOutlined />} 
                      />
                    </Popconfirm>
                  </Tooltip>,
                ]}
              >
                <Card.Meta
                  title={
                    <Tooltip title={item.filename}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{item.filename}</span>
                    </Tooltip>
                  }
                  description={
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>Size: {formatSize(item.sizeBytes)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>Uploaded: {dayjs(item.uploadDate).format('DD MMM YYYY')}</span>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Video Preview Modal */}
      <Modal
        title={previewItem?.filename}
        open={previewItem !== null}
        onCancel={() => setPreviewItem(null)}
        footer={null}
        width={720}
        destroyOnClose
        className="glass-panel"
        styles={{ body: { padding: '24px 0 0 0', backgroundColor: '#000' } }}
      >
        {previewItem && (
          <video 
            controls 
            autoPlay 
            style={{ width: '100%', maxHeight: '450px', background: '#000' }}
          >
            <source src={`${API_BASE_URL}${previewItem.videoPath}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </Modal>
    </div>
  );
};

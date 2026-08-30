import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Form, Input, Button, Checkbox, DatePicker, Select,
  Row, Col, Space, Progress, Modal, notification, Upload,
  Divider, Radio, Tabs
} from 'antd';
import {
  UploadOutlined, RobotOutlined, SendOutlined,
  ClockCircleOutlined, EyeOutlined, VideoCameraOutlined,
  PlayCircleOutlined, ThunderboltOutlined, CopyOutlined,
  EditOutlined, LinkOutlined, SyncOutlined, CloudDownloadOutlined
} from '@ant-design/icons';
import { api, API_BASE_URL } from '../services/api';
import type { MediaItem, AppConfig } from '../types';
import dayjs from 'dayjs';

interface QuickPublishProps {
  reuseVideoFilename?: string;
  onClearReuseVideo?: () => void;
}

export const QuickPublish: React.FC<QuickPublishProps> = ({
  reuseVideoFilename,
  onClearReuseVideo
}) => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const watchTitle = Form.useWatch('title', form) || '';
  const watchPages = Form.useWatch('pages', form) || [];
  const watchCustomizations = Form.useWatch('pageCustomizations', form);
  const watchPostType = Form.useWatch('postType', form) || 'video';

  // Compute live mock preview based on first selected page overrides
  const firstSelectedPage = watchPages[0];
  let previewCaption = '';
  let previewTitle = watchTitle;
  let previewPostType = watchPostType;

  if (firstSelectedPage && watchCustomizations?.[firstSelectedPage]) {
    previewCaption = watchCustomizations[firstSelectedPage].caption || '';
    previewTitle = watchCustomizations[firstSelectedPage].title || watchTitle;
    previewPostType = watchCustomizations[firstSelectedPage].postType || watchPostType;
  }


  // States
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [selectedThumbUrl, setSelectedThumbUrl] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVariations, setAiVariations] = useState<Record<string, string> | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string>('');

  // Video source & download states
  const [videoSourceMode, setVideoSourceMode] = useState<'upload' | 'url'>('upload');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [downloadingUrl, setDownloadingUrl] = useState<boolean>(false);

  // Hashtag Auto-Randomizer states
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [hashtagPoolText, setHashtagPoolText] = useState<string>(
    '#សម្រាយរឿងចិន #សម្រាយរឿងថ្មីៗ #រឿងAI #សម្រាយរឿង #រឿងចិនបុរាណ #រឿងចិននិយាយខ្មែរ #សម្រាយរឿងល្បី #សម្រាយរឿងថ្មីៗ #រឿងចិននិយាយខ្មែរ'
  );
  const [tagsPerPageCount, setTagsPerPageCount] = useState<number>(0); // 0 = ALL tags shuffled
  const [hashtagAppendMode, setHashtagAppendMode] = useState<'append' | 'replace'>('append');
  const [includePageHashtag, setIncludePageHashtag] = useState<boolean>(true);

  // Fisher-Yates array shuffling helper
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Convert page name into hashtag (e.g. "NT Video " -> "#NTVideo", "Midnight Tales" -> "#MidnightTales")
  const getPageHashtag = (pageName: string): string => {
    if (!pageName) return '';
    const cleaned = pageName.replace(/[^\w\u1780-\u17FF]/g, '');
    return cleaned ? `#${cleaned}` : '';
  };

  // Strip existing hashtag blocks from the end of a caption
  const cleanCaptionText = (caption: string): string => {
    if (!caption) return '';
    const lines = caption.split('\n');
    while (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      if (lastLine === '' || /^(\s*#[^\s#]+\s*)+$/.test(lastLine)) {
        lines.pop();
      } else {
        break;
      }
    }
    return lines.join('\n').trim();
  };

  // Randomize hashtags across all selected target pages (each page gets channel tag + pool tags in unique random order)
  const randomizeHashtagsToPages = (customPool?: string) => {
    const targetPages = watchPages as string[];
    if (!targetPages || targetPages.length === 0) {
      notification.warning({
        message: 'Hashtag Randomizer',
        description: 'Please select at least one target channel first.'
      });
      return;
    }

    const rawText = customPool || hashtagPoolText;
    const matches: string[] = rawText.match(/#[^\s#\s,;]+/g) || [];
    if (matches.length === 0 && !includePageHashtag) {
      notification.warning({
        message: 'Hashtag Randomizer',
        description: 'No valid hashtags found. Make sure tags start with #'
      });
      return;
    }

    const currentCustomizations = form.getFieldValue('pageCustomizations') || {};
    const updatedCustomizations = { ...currentCustomizations };

    targetPages.forEach((pageName) => {
      const pageTag = includePageHashtag ? getPageHashtag(pageName) : '';
      const pagePool = (pageTag && !matches.includes(pageTag))
        ? [pageTag, ...matches]
        : [...matches];

      // Shuffle ALL tags for this page
      const shuffled = shuffleArray(pagePool);
      const selectedTags = (tagsPerPageCount && tagsPerPageCount > 0 && tagsPerPageCount < shuffled.length)
        ? shuffled.slice(0, tagsPerPageCount)
        : shuffled;
      const tagsString = selectedTags.join(' ');

      const currentCaption = updatedCustomizations[pageName]?.caption || '';
      let baseCaption = '';
      if (hashtagAppendMode === 'replace') {
        baseCaption = '';
      } else {
        baseCaption = cleanCaptionText(currentCaption);
      }

      const finalCaption = baseCaption
        ? `${baseCaption}\n\n${tagsString}`
        : tagsString;

      updatedCustomizations[pageName] = {
        ...updatedCustomizations[pageName],
        caption: finalCaption
      };
    });

    form.setFieldsValue({ pageCustomizations: updatedCustomizations });
    notification.success({
      message: '🎲 Hashtags Auto-Randomized!',
      description: `Successfully applied channel hashtags (e.g. #NTVideo) & pool tags in unique random orders to all ${targetPages.length} pages!`
    });
  };


  // Fetch Settings & Config
  const { data: config } = useQuery<AppConfig>({
    queryKey: ['settings'],
    queryFn: api.getSettings
  });
  let resolvedPreviewPostType = previewPostType;
  if (previewPostType === 'fb_reel_yt_video') {
    const isYT = config?.youtubeChannels?.some(c => c.name === firstSelectedPage);
    resolvedPreviewPostType = isYT ? 'video' : 'reel';
  }

  // Fetch Media Library
  const { data: mediaItems = [] } = useQuery<MediaItem[]>({
    queryKey: ['mediaLibrary'],
    queryFn: api.getMediaLibrary
  });

  // Handle Reuse Video trigger from other pages
  useEffect(() => {
    if (reuseVideoFilename) {
      setSelectedFilename(reuseVideoFilename);
      // Try to find matching thumbnail
      const item = mediaItems.find(m => m.filename === reuseVideoFilename);
      if (item && item.thumbnailPath) {
        setSelectedThumbUrl(item.thumbnailPath);
      } else {
        const nameWithoutExt = reuseVideoFilename.split('.').shift();
        setSelectedThumbUrl(`/static/thumbnails/${nameWithoutExt}.jpg`);
      }
      form.setFieldsValue({ videoFilename: reuseVideoFilename });
      if (onClearReuseVideo) onClearReuseVideo();
    }
  }, [reuseVideoFilename, mediaItems]);

  // Keep activeTabKey in sync with selected pages list
  useEffect(() => {
    if (watchPages.length > 0) {
      if (!activeTabKey || !watchPages.includes(activeTabKey)) {
        setActiveTabKey(watchPages[0]);
      }
    } else {
      setActiveTabKey('');
    }
  }, [watchPages, activeTabKey]);

  // Upload handler
  const handleUpload = async (options: any) => {
    const { file } = options;
    setUploading(true);
    setUploadPercent(0);
    try {
      const res = await api.uploadVideo(file as File, (percent) => {
        setUploadPercent(percent);
      });
      if (res.success) {
        setSelectedFilename(res.filename);
        setSelectedThumbUrl(res.thumbnailUrl);
        form.setFieldsValue({ videoFilename: res.filename });
        notification.success({ message: 'Upload Completed', description: `Video file registered: ${res.originalName}` });
        queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      }
    } catch (err: any) {
      notification.error({
        message: 'Upload Failed',
        description: err.response?.data?.detail || 'Video file transfer aborted / exceeded size limitations.'
      });
    } finally {
      setUploading(false);
    }
  };

  // Reuse media library selection handler
  const handleSelectMedia = (item: MediaItem) => {
    setSelectedFilename(item.filename);
    setSelectedThumbUrl(item.thumbnailPath);
    form.setFieldsValue({ videoFilename: item.filename });
    setIsMediaModalOpen(false);
  };

  // Mutations for publishing
  const publishMutation = useMutation({
    mutationFn: api.publishPost,
    onSuccess: (res) => {
      // Evaluate broadcast statuses
      const successes = res.results.filter(r => r.status === 'success');
      const failures = res.results.filter(r => r.status === 'failed');

      if (failures.length === 0) {
        notification.success({
          message: 'Post Broadcast Successful',
          description: `Successfully published to all ${successes.length} pages!`
        });
      } else if (successes.length > 0) {
        notification.warning({
          message: 'Partial Broadcast Success',
          description: `Published to ${successes.length} channels. Failed on ${failures.length} channels.`
        });
      } else {
        notification.error({
          message: 'Broadcast Failed',
          description: 'Failed to publish to any of the selected channels. See logs for details.'
        });
      }

      // Reset video configuration
      setSelectedFilename(null);
      setSelectedThumbUrl(null);
      form.resetFields(['title', 'pageCustomizations', 'videoFilename']);
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['postingHistory'] });
    },
    onError: (err: any) => {
      notification.error({
        message: 'Publish Exception',
        description: err.response?.data?.detail || 'An unexpected error occurred during the publishing process.'
      });
    }
  });

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: api.schedulePost,
    onSuccess: () => {
      notification.success({
        message: 'Post Scheduled',
        description: 'Publish queue registered in scheduler successfully.'
      });
      setSelectedFilename(null);
      setSelectedThumbUrl(null);
      form.resetFields(['title', 'pageCustomizations', 'videoFilename', 'scheduledTime']);
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPosts'] });
    },
    onError: (err: any) => {
      notification.error({ message: 'Scheduling Failed', description: err.response?.data?.detail || 'Scheduler error' });
    }
  });

  // Form submit dispatcher
  const onFinish = async (values: any) => {
    if (!values.pages || values.pages.length === 0) {
      notification.warning({ message: 'Validation Alert', description: 'Select at least one destination channel (Facebook Page or YouTube Channel).' });
      return;
    }

    // Process pageCustomizations for all selected pages
    const pageCustomizations: Record<string, { title?: string; caption: string; postType?: string }> = {};
    values.pages.forEach((pageName: string) => {
      const custom = values.pageCustomizations?.[pageName];
      pageCustomizations[pageName] = {
        title: custom?.title || '',
        caption: custom?.caption || '',
        postType: custom?.postType || ''
      };
    });

    const primaryCaption = pageCustomizations[values.pages[0]]?.caption || '';
    let targetFilename = selectedFilename;

    // If URL mode is active and no file is selected yet, download and publish in 1 step!
    if (videoSourceMode === 'url' && !targetFilename) {
      if (!downloadUrl || !downloadUrl.trim()) {
        notification.warning({ message: 'Validation Alert', description: 'Please paste a valid video URL from Facebook, YouTube, or TikTok.' });
        return;
      }

      setDownloadingUrl(true);
      try {
        const res = await api.downloadVideoFromUrl({
          url: downloadUrl.trim(),
          autoPublish: publishMode === 'now',
          title: values.title || '',
          caption: primaryCaption,
          pages: values.pages,
          postType: values.postType || 'video',
          pageCustomizations: pageCustomizations
        });

        if (res.success) {
          queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
          queryClient.invalidateQueries({ queryKey: ['postingHistory'] });

          if (res.autoPublished && res.publishResults) {
            const successes = res.publishResults.results?.filter((r: any) => r.status === 'success') || [];
            const failures = res.publishResults.results?.filter((r: any) => r.status === 'failed') || [];

            if (failures.length === 0) {
              notification.success({
                message: 'Downloaded 4K & Auto-Posted!',
                description: `Successfully downloaded video and published to all ${successes.length} target channels!`
              });
            } else if (successes.length > 0) {
              notification.warning({
                message: 'Partial Broadcast Success',
                description: `Downloaded & published to ${successes.length} channels. Failed on ${failures.length} channels.`
              });
            } else {
              notification.error({
                message: 'Broadcast Failed',
                description: 'Video downloaded successfully, but publishing failed. Check channel permissions.'
              });
            }

            setSelectedFilename(null);
            setSelectedThumbUrl(null);
            setDownloadUrl('');
            form.resetFields(['title', 'pageCustomizations', 'videoFilename']);
            return;
          } else {
            targetFilename = res.filename;
            setSelectedFilename(res.filename);
            setSelectedThumbUrl(res.thumbnailUrl);
          }
        }
      } catch (err: any) {
        notification.error({
          message: 'Download & Publish Exception',
          description: err.response?.data?.detail || 'Failed to download video from URL link.'
        });
        return;
      } finally {
        setDownloadingUrl(false);
      }
    }

    if (!targetFilename) {
      notification.warning({ message: 'Validation Alert', description: 'Please upload or select a video.' });
      return;
    }

    const payload = {
      videoFilename: targetFilename,
      title: values.title || '',
      caption: primaryCaption,
      pages: values.pages,
      postType: values.postType || 'video',
      pageCustomizations: pageCustomizations
    };

    if (publishMode === 'now') {
      publishMutation.mutate(payload);
    } else {
      if (!values.scheduledTime) {
        notification.warning({ message: 'Validation Alert', description: 'Please specify the target date and time.' });
        return;
      }
      scheduleMutation.mutate({
        ...payload,
        timestamp: values.scheduledTime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
  };

  // Download Only handler (saves to library and loads into composer without auto-publishing)
  const handleDownloadOnly = async () => {
    if (!downloadUrl || !downloadUrl.trim()) {
      notification.warning({
        message: 'Validation Alert',
        description: 'Please paste a valid video URL from Facebook, YouTube, or TikTok.'
      });
      return;
    }

    setDownloadingUrl(true);
    try {
      const res = await api.downloadVideoFromUrl({
        url: downloadUrl.trim(),
        autoPublish: false
      });

      if (res.success) {
        setSelectedFilename(res.filename);
        setSelectedThumbUrl(res.thumbnailUrl);
        form.setFieldsValue({ videoFilename: res.filename });
        if (res.title && !form.getFieldValue('title')) {
          form.setFieldsValue({ title: res.title });
        }

        notification.success({
          message: '4K/Full HD Video Downloaded!',
          description: `Successfully downloaded "${res.title || res.filename}" into Media Library and loaded into composer.`
        });

        queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      }
    } catch (err: any) {
      notification.error({
        message: 'Download Failed',
        description: err.response?.data?.detail || 'Failed to download video from URL link.'
      });
    } finally {
      setDownloadingUrl(false);
    }
  };


  // AI Content helpers
  const handleGenerateAI = async (type: 'title' | 'caption' | 'hashtags' | 'variations') => {
    const summary = form.getFieldValue('storySummary');
    if (!summary) {
      notification.warning({ message: 'AI Assistant', description: 'Write a quick summary of your video story first.' });
      return;
    }

    setAiLoading(true);
    setAiVariations(null);
    try {
      if (type === 'title') {
        const res = await api.generateAiTitle(summary);
        form.setFieldsValue({ title: res.title });
        notification.success({ message: 'AI Title Generated' });
      } else if (type === 'caption') {
        const res = await api.generateAiCaption(summary);
        form.setFieldsValue({ caption: res.caption });
        notification.success({ message: 'AI Caption Generated' });
      } else if (type === 'hashtags') {
        const res = await api.generateAiHashtags(summary);
        const currentCaption = form.getFieldValue('caption') || '';
        form.setFieldsValue({ caption: `${currentCaption}\n\n${res.hashtags}` });
        notification.success({ message: 'AI Hashtags Appended' });
      } else if (type === 'variations') {
        const res = await api.generateAiPageVariations(summary);
        setAiVariations(res.variations);
        notification.success({ message: 'AI Tone Variations Generated' });
      }
    } catch (err: any) {
      notification.error({
        message: 'AI Assistant Failed',
        description: err.response?.data?.detail || 'OpenAI-compatible connection failed. Verify API Key settings.'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const applyVariation = (pageName: string, caption: string) => {
    const currentCustomizations = form.getFieldValue('pageCustomizations') || {};
    form.setFieldsValue({
      pageCustomizations: {
        ...currentCustomizations,
        [pageName]: {
          ...currentCustomizations[pageName],
          caption: caption
        }
      }
    });
    notification.success({ message: 'Variation Applied', description: `Tailored caption applied to ${pageName}.` });
  };

  // Pre-configured Templates apply helpers
  const applyTemplate = (type: 'caption' | 'hashtag', content: string) => {
    if (!activeTabKey) {
      notification.warning({ message: 'Preset Template', description: 'Select at least one channel first.' });
      return;
    }
    const currentCustomizations = form.getFieldValue('pageCustomizations') || {};
    const currentCaption = currentCustomizations[activeTabKey]?.caption || '';

    let newCaption = '';
    if (type === 'caption') {
      newCaption = content;
    } else {
      newCaption = `${currentCaption} ${content}`.trim();
    }

    form.setFieldsValue({
      pageCustomizations: {
        ...currentCustomizations,
        [activeTabKey]: {
          ...currentCustomizations[activeTabKey],
          caption: newCaption
        }
      }
    });
    notification.success({ message: 'Template applied', description: `Preset applied to ${activeTabKey}.` });
  };



  return (
    <div style={{ padding: '0 16px' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          pages: [],
          postType: 'reel',
        }}
      >
        <Row gutter={[24, 24]}>
          {/* Main Form Composer */}
          <Col xs={24} xl={15}>
            <Card className="glass-panel" title={<span style={{ color: '#fff' }}>Post Composer</span>} bordered={false}>
              {/* Video upload row */}
              <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Video File Source</span>} required>
                <div style={{ marginBottom: '16px' }}>
                  <Radio.Group
                    value={videoSourceMode}
                    onChange={(e) => setVideoSourceMode(e.target.value)}
                    buttonStyle="solid"
                    style={{ width: '100%', display: 'flex' }}
                  >
                    <Radio.Button value="upload" style={{ flex: 1, textAlign: 'center' }}>
                      📁 Local Upload / Media Library
                    </Radio.Button>
                    <Radio.Button value="url" style={{ flex: 1, textAlign: 'center' }}>
                      🔗 Download Link (FB, YT, TikTok)
                    </Radio.Button>
                  </Radio.Group>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {!selectedFilename ? (
                    <div style={{ flex: 1 }}>
                      {videoSourceMode === 'upload' ? (
                        <>
                          <Upload.Dragger
                            customRequest={handleUpload}
                            showUploadList={false}
                            disabled={uploading}
                            style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(168,85,247,0.3)', padding: '24px' }}
                          >
                            <p className="ant-upload-drag-icon">
                              <UploadOutlined style={{ color: '#a855f7', fontSize: '32px' }} />
                            </p>
                            <p style={{ color: '#fff', fontSize: '15px', fontWeight: 500, margin: '8px 0' }}>Drag & Drop video file here</p>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Supports mp4, mov, avi, mkv. Max 10GB.</p>
                          </Upload.Dragger>

                          {uploading && (
                            <div style={{ marginTop: '12px' }}>
                              <Progress percent={uploadPercent} strokeColor="#a855f7" />
                              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Uploading video to server...</span>
                            </div>
                          )}

                          <Divider plain style={{ margin: '16px 0', borderColor: 'rgba(255,255,255,0.05)' }}>or</Divider>

                          <Button
                            type="dashed"
                            block
                            icon={<VideoCameraOutlined />}
                            onClick={() => setIsMediaModalOpen(true)}
                            style={{ borderColor: 'rgba(168,85,247,0.2)', color: '#c084fc', height: '40px' }}
                          >
                            Select Reusable Video from Media Library
                          </Button>
                        </>
                      ) : (
                        <Card
                          size="small"
                          style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(168,85,247,0.3)', padding: '16px' }}
                        >
                          <Input
                            size="large"
                            placeholder="Paste Facebook, YouTube, or TikTok video link..."
                            prefix={<LinkOutlined style={{ color: '#a855f7' }} />}
                            value={downloadUrl}
                            onChange={(e) => setDownloadUrl(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(168,85,247,0.3)', color: '#fff' }}
                          />

                          <div style={{ marginTop: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Button
                              type="primary"
                              icon={downloadingUrl ? <SyncOutlined spin /> : <CloudDownloadOutlined />}
                              loading={downloadingUrl}
                              onClick={handleDownloadOnly}
                              style={{
                                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                                border: 'none',
                                fontWeight: 600,
                                height: '38px'
                              }}
                            >
                              📥 Download Video Only (Save to Library & Load)
                            </Button>
                            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                              or select channels below & click ⚡ <strong>Download & Post</strong>
                            </span>
                          </div>

                          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
                              Click <strong>Download Video Only</strong> to store in library & edit captions first, or submit below to <strong>Download & Post</strong> automatically!
                            </span>
                            <span style={{ color: '#a855f7', fontSize: '12px', fontWeight: 600 }}>
                              ✨ 4K / Full HD Quality
                            </span>
                          </div>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                      <div style={{ width: '100px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: '#000', position: 'relative' }}>
                        {selectedThumbUrl ? (
                          <img src={`${API_BASE_URL}${selectedThumbUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                        ) : (
                          <PlayCircleOutlined style={{ fontSize: '20px', position: 'absolute', top: '20px', left: '40px', color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <h4 style={{ color: '#fff', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{selectedFilename}</h4>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Ready to publish</span>
                      </div>
                      <Button type="text" danger onClick={() => { setSelectedFilename(null); setSelectedThumbUrl(null); form.setFieldsValue({ videoFilename: '' }); }}>
                        Change
                      </Button>
                    </div>
                  )}
                </div>
              </Form.Item>

              <Form.Item name="videoFilename" noStyle><Input type="hidden" /></Form.Item>

              <Form.Item
                name="title"
                label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Video Title</span>}
                rules={[{ max: 100, message: 'Title should be under 100 characters.' }]}
              >
                <Input placeholder="Enter catchword video title..." />
              </Form.Item>



              {/* Target Channels check boxes list */}
              <Form.Item
                name="pages"
                label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Target Channels</span>}
                rules={[{ required: true, message: 'Choose at least one channel' }]}
              >
                <Checkbox.Group style={{ width: '100%' }}>
                  <Row gutter={[16, 12]}>
                    {config?.pages.map(page => (
                      <Col span={8} key={`fb-${page.name}`}>
                        <Checkbox value={page.name} disabled={page.status !== 'connected'}>
                          <span style={{ color: page.status === 'connected' ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                            📘 {page.name}
                          </span>
                        </Checkbox>
                      </Col>
                    ))}
                    {config?.youtubeChannels?.map(channel => (
                      <Col span={8} key={`yt-${channel.name}`}>
                        <Checkbox value={channel.name} disabled={channel.status !== 'connected'}>
                          <span style={{ color: channel.status === 'connected' ? '#ff4d4f' : 'rgba(255,255,255,0.25)' }}>
                            🔴 {channel.name}
                          </span>
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>

              {watchPages.length > 0 && (
                <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                  <Card
                    size="small"
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <EditOutlined style={{ color: '#a855f7' }} /> Channel-Specific Content
                        </span>
                        <Button
                          size="small"
                          type="primary"
                          icon={<ThunderboltOutlined />}
                          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', border: 'none', fontWeight: 600 }}
                          onClick={() => setIsHashtagModalOpen(true)}
                        >
                          🎲 Auto Hashtag Randomizer
                        </Button>
                      </div>
                    }
                    style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(168,85,247,0.2)' }}
                  >
                    {/* Active tab templates & quick hashtag randomizer bar */}
                    <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <Button
                        size="small"
                        type="primary"
                        style={{ background: '#a855f7', border: 'none', fontWeight: 600, fontSize: '11px' }}
                        onClick={() => randomizeHashtagsToPages()}
                      >
                        🎲 1-Click Auto-Randomize Tags to All ({watchPages.length}) Pages
                      </Button>
                      <Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      {activeTabKey && (
                        <>
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Apply preset to {activeTabKey}:</span>
                          {config?.templates.captions.map(c => (
                            <Button key={c.id} size="small" type="dashed" style={{ fontSize: '11px' }} onClick={() => applyTemplate('caption', c.content)}>
                              {c.name}
                            </Button>
                          ))}
                          {config?.templates.hashtags.map(h => (
                            <Button key={h.id} size="small" type="dashed" style={{ fontSize: '11px' }} onClick={() => applyTemplate('hashtag', h.content)}>
                              {h.name} (Tags)
                            </Button>
                          ))}
                        </>
                      )}
                    </div>

                    <Tabs
                      type="card"
                      activeKey={activeTabKey}
                      onChange={(key) => setActiveTabKey(key)}
                      items={(watchPages as string[]).map((pageName: string) => ({
                        key: pageName,
                        label: pageName,
                        children: (
                          <div style={{ padding: '8px 0 0 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Form.Item
                              name={['pageCustomizations', pageName, 'title']}
                              label={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>Custom Title for {pageName} (Optional)</span>}
                              rules={[{ max: 100, message: 'Title should be under 100 characters.' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="Defaults to global video title..." />
                            </Form.Item>
                            <Form.Item
                              name={['pageCustomizations', pageName, 'caption']}
                              label={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>Caption / Post Body for {pageName} (Required)</span>}
                              rules={[{ required: true, message: `Caption for ${pageName} is required.` }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input.TextArea placeholder="Enter unique caption for this channel..." rows={5} />
                            </Form.Item>
                            <Form.Item
                              name={['pageCustomizations', pageName, 'postType']}
                              label={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>Publishing Format for {pageName} (Optional)</span>}
                              style={{ marginBottom: 0 }}
                            >
                              <Select placeholder="Defaults to global format selection...">
                                <Select.Option value="video">Standard Video</Select.Option>
                                <Select.Option value="reel">Reel / Shorts</Select.Option>
                              </Select>
                            </Form.Item>
                          </div>
                        )
                      }))}
                    />
                  </Card>
                </div>
              )}

              <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} />

              {/* Formats and schedules triggers */}
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="postType" label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Publishing Format</span>}>
                    <Select placeholder="Select Format">
                      <Select.Option value="reel">Facebook Reel / YouTube Short</Select.Option>
                      <Select.Option value="video">Standard Video / YouTube Video</Select.Option>
                      <Select.Option value="fb_reel_yt_video">Facebook Reel & YouTube Video</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Schedule Type</span>}>
                    <Radio.Group value={publishMode} onChange={(e) => setPublishMode(e.target.value)} buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
                      <Radio.Button value="now" style={{ flex: 1, textAlign: 'center' }}>Publish Now</Radio.Button>
                      <Radio.Button value="schedule" style={{ flex: 1, textAlign: 'center' }}>Schedule Later</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              {publishMode === 'schedule' && (
                <Form.Item
                  name="scheduledTime"
                  label={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Post Date & Time</span>}
                  rules={[{ required: true, message: 'Please specify the scheduled time' }]}
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
                </Form.Item>
              )}

              <Button
                type="primary"
                htmlType="submit"
                block
                icon={downloadingUrl ? <SyncOutlined spin /> : publishMode === 'now' ? <SendOutlined /> : <ClockCircleOutlined />}
                loading={publishMutation.isPending || scheduleMutation.isPending || downloadingUrl}
                style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)', border: 'none', height: '48px', fontSize: '16px', fontWeight: 700, marginTop: '16px' }}
              >
                {downloadingUrl
                  ? 'Downloading 4K Video & Publishing...'
                  : videoSourceMode === 'url' && !selectedFilename
                    ? (publishMode === 'now' ? `⚡ Download 4K Video & Publish Now to ${watchPages.length} Channels` : `⚡ Download 4K Video & Schedule Post`)
                    : (publishMode === 'now' ? `Publish Broadcast now to ${watchPages.length} Channels` : `Schedule post for queue`)}
              </Button>

            </Card>
          </Col>

          {/* AI Tools Side Panel & Preview */}
          <Col xs={24} xl={9}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>

              {/* AI generator panel */}
              <Card
                className="glass-panel"
                title={<span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}><RobotOutlined style={{ color: '#a855f7' }} /> AI Content Assistant</span>}
                bordered={false}
              >
                <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Story / Video Summary</span>} name="storySummary">
                  <Input.TextArea placeholder="Enter story synopsis or summary of what is happening in the video..." rows={3} />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  <Button icon={<ThunderboltOutlined />} loading={aiLoading} onClick={() => handleGenerateAI('title')} style={{ fontSize: '13px' }}>
                    Gen Title
                  </Button>
                  <Button icon={<ThunderboltOutlined />} loading={aiLoading} onClick={() => handleGenerateAI('caption')} style={{ fontSize: '13px' }}>
                    Gen Caption
                  </Button>
                  <Button icon={<ThunderboltOutlined />} loading={aiLoading} onClick={() => handleGenerateAI('hashtags')} style={{ fontSize: '13px' }}>
                    Gen Hashtags
                  </Button>
                  <Button icon={<RobotOutlined />} loading={aiLoading} onClick={() => handleGenerateAI('variations')} style={{ fontSize: '13px', gridColumn: 'span 2' }}>
                    Generate Tone Variations per Page
                  </Button>
                </div>

                {aiVariations && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '10px' }}>Tailored Variations:</h4>
                    {Object.entries(aiVariations).map(([page, text]) => (
                      <div key={page} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px', color: '#c084fc' }}>{page}</span>
                          <Space>
                            <Button
                              size="small"
                              type="primary"
                              style={{ fontSize: '11px', background: '#a855f7', border: 'none', height: '22px' }}
                              onClick={() => applyVariation(page, text)}
                            >
                              Apply to Page
                            </Button>
                            <Button
                              size="small"
                              type="text"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                form.setFieldsValue({ caption: text });
                                notification.success({ message: 'Variation Copied', description: 'Tailored caption copied to global composer.' });
                              }}
                              style={{ height: '20px', padding: 0 }}
                            />
                          </Space>
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Live Preview panel */}
              <Card
                className="glass-panel"
                title={
                  <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <EyeOutlined style={{ color: '#a855f7' }} />
                    {config?.youtubeChannels?.some(c => c.name === firstSelectedPage)
                      ? (resolvedPreviewPostType === 'reel' ? 'YouTube Shorts Preview' : 'YouTube Video Preview')
                      : (resolvedPreviewPostType === 'reel' ? 'FB Reel Preview' : 'FB Video Preview')}
                  </span>
                }
                bordered={false}
              >
                {config?.youtubeChannels?.some(c => c.name === firstSelectedPage) ? (
                  resolvedPreviewPostType === 'reel' ? (
                    <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ width: '220px', height: '380px', background: '#121212', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {selectedThumbUrl ? (
                          <img src={`${API_BASE_URL}${selectedThumbUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Shorts Thumb" />
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
                            <VideoCameraOutlined style={{ fontSize: '32px' }} />
                          </div>
                        )}

                        <div style={{ position: 'absolute', bottom: '60px', right: '10px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                          <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px' }}>👍</span><div style={{ fontSize: '10px' }}>Like</div></div>
                          <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px' }}>👎</span><div style={{ fontSize: '10px' }}>Dislike</div></div>
                          <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px' }}>💬</span><div style={{ fontSize: '10px' }}>0</div></div>
                          <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px' }}>➡️</span><div style={{ fontSize: '10px' }}>Share</div></div>
                        </div>

                        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', color: '#fff', zIndex: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ff0000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                              {firstSelectedPage ? firstSelectedPage.substring(0, 2).toUpperCase() : 'YT'}
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>@{firstSelectedPage || 'Channel'}</span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '15px' }}>
                            {previewTitle || 'Shorts Video Title...'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {previewCaption || 'Description...'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#0f0f0f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', padding: '12px' }}>
                      <div style={{ width: '100%', height: '180px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                        {selectedThumbUrl ? (
                          <>
                            <img src={`${API_BASE_URL}${selectedThumbUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PlayCircleOutlined style={{ fontSize: '36px', color: '#fff' }} />
                            </div>
                            <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: '#000', color: '#fff', padding: '2px 4px', fontSize: '11px', borderRadius: '2px' }}>
                              3:15
                            </span>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                            <VideoCameraOutlined style={{ fontSize: '32px', marginBottom: '6px' }} />
                            <p style={{ fontSize: '12px', margin: 0 }}>No Video Loaded</p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff0000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#fff', flexShrink: 0 }}>
                          {firstSelectedPage ? firstSelectedPage.substring(0, 2).toUpperCase() : 'YT'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <h4 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {previewTitle || 'Your video title...'}
                          </h4>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>
                            {firstSelectedPage || 'YouTube Channel'} · 0 views · Just now
                          </div>
                          <p style={{ color: '#aaa', fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                            {previewCaption || 'Your description will appear here...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ background: '#18191a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                        {watchPages.length > 0 ? watchPages[0].substring(0, 2).toUpperCase() : 'FB'}
                      </div>
                      <div>
                        <h4 style={{ color: '#fff', margin: 0, fontSize: '13px', fontWeight: 'semibold' }}>
                          {watchPages.length > 0 ? watchPages.join(' & ') : 'Facebook Page Name'}
                        </h4>
                        <span style={{ color: '#b0b3b8', fontSize: '11px' }}>Just now · 🌐</span>
                      </div>
                    </div>

                    <p style={{ color: '#e4e6eb', fontSize: '13px', margin: '0 0 10px 0', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                      {previewCaption || 'Your caption text will appear here...'}
                    </p>

                    <div style={{ width: '100%', height: '180px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                      {selectedThumbUrl ? (
                        <>
                          <img src={`${API_BASE_URL}${selectedThumbUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PlayCircleOutlined style={{ fontSize: '36px', color: '#fff' }} />
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                          <VideoCameraOutlined style={{ fontSize: '32px', marginBottom: '6px' }} />
                          <p style={{ fontSize: '12px', margin: 0 }}>No Video Loaded</p>
                        </div>
                      )}
                    </div>

                    {previewTitle && (
                      <div style={{ padding: '10px', background: '#242526', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}>
                        <span style={{ color: '#b0b3b8', fontSize: '11px', display: 'block' }}>VIDEO TITLE</span>
                        <h4 style={{ color: '#fff', margin: 0, fontSize: '13px' }}>{previewTitle}</h4>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Space>
          </Col>
        </Row>
      </Form>

      {/* Media Library Selector Modal */}
      <Modal
        title="Select Video from Library"
        open={isMediaModalOpen}
        onCancel={() => setIsMediaModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
        className="glass-panel"
      >
        {mediaItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Your Media Library is empty. Upload a video file first.</p>
          </div>
        ) : (
          <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {mediaItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectMedia(item)}
                style={{ display: 'flex', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', alignItems: 'center', transition: 'border-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
              >
                <div style={{ width: '80px', height: '48px', borderRadius: '4px', overflow: 'hidden', background: '#000' }}>
                  {item.thumbnailPath ? (
                    <img src={`${API_BASE_URL}${item.thumbnailPath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <PlayCircleOutlined style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#fff', margin: 0 }}>{item.filename}</h4>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
                    Uploaded: {dayjs(item.uploadDate).format('DD MMM YYYY')} · Size: {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <Button size="small" type="primary" style={{ background: '#a855f7', border: 'none' }}>
                  Select
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Auto Hashtag Randomizer Modal */}
      <Modal
        title={<span style={{ color: '#fff' }}>🎲 Auto Hashtag Randomizer for Target Channels</span>}
        open={isHashtagModalOpen}
        onCancel={() => setIsHashtagModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
        className="glass-panel"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Hashtag Pool (Space or line separated):
            </span>
            <Input.TextArea
              rows={4}
              value={hashtagPoolText}
              onChange={(e) => setHashtagPoolText(e.target.value)}
              placeholder="#tag1 #tag2 #tag3..."
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(168,85,247,0.3)', color: '#fff' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Paste all your hashtags above. Each target page will receive an independent, randomized selection of these tags.
            </span>
          </div>

          <div style={{ background: 'rgba(168,85,247,0.05)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(168,85,247,0.2)' }}>
            <Checkbox
              checked={includePageHashtag}
              onChange={(e) => setIncludePageHashtag(e.target.checked)}
            >
              <span style={{ color: '#fff', fontSize: '13px' }}>
                Auto-generate Channel Name Hashtag for each page (e.g. <strong>#NTVideo</strong>, <strong>#MidnightTales</strong>)
              </span>
            </Checkbox>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Tags per Page:
              </span>
              <Select
                value={tagsPerPageCount}
                onChange={(val) => setTagsPerPageCount(val)}
                style={{ width: '100%' }}
              >
                <Select.Option value={3}>3 random tags</Select.Option>
                <Select.Option value={5}>5 random tags</Select.Option>
                <Select.Option value={7}>7 random tags</Select.Option>
                <Select.Option value={0}>All tags (Shuffled)</Select.Option>
              </Select>
            </Col>
            <Col span={12}>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Placement Mode:
              </span>
              <Radio.Group
                value={hashtagAppendMode}
                onChange={(e) => setHashtagAppendMode(e.target.value)}
                buttonStyle="solid"
                style={{ width: '100%', display: 'flex' }}
              >
                <Radio.Button value="append" style={{ flex: 1, textAlign: 'center', fontSize: '12px' }}>Append</Radio.Button>
                <Radio.Button value="replace" style={{ flex: 1, textAlign: 'center', fontSize: '12px' }}>Replace</Radio.Button>
              </Radio.Group>
            </Col>
          </Row>

          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button onClick={() => setIsHashtagModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', border: 'none', fontWeight: 600 }}
              onClick={() => {
                randomizeHashtagsToPages();
                setIsHashtagModalOpen(false);
              }}
            >
              ⚡ Randomize & Apply to {watchPages.length} Pages Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

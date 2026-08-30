import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Space, Tag, InputNumber, notification, Tabs, Divider, Row, Col } from 'antd';
import { SettingOutlined, GlobalOutlined, KeyOutlined, YoutubeOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { api, API_BASE_URL } from '../services/api';
import type { AppConfig, FacebookPage, YouTubeChannel } from '../types';

export const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testingPageName, setTestingPageName] = useState<string | null>(null);
  const [testingStatus, setTestingStatus] = useState<Record<string, string>>({});
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);


  const fetchSettings = async (initialLoad = true) => {
    if (initialLoad) setLoading(true);
    try {
      const data = await api.getSettings();
      const ytChannels = data.youtubeChannels || [];
      setYoutubeChannels(ytChannels);
      
      if (initialLoad) {
        form.setFieldsValue({
          maxVideoSizeMb: data.settings.maxVideoSizeMb,
          openaiApiKey: data.settings.openaiApiKey,
          openaiBaseUrl: data.settings.openaiBaseUrl,
          openaiModel: data.settings.openaiModel,
          googleClientId: data.settings.googleClientId || "",
          googleClientSecret: data.settings.googleClientSecret || "",
          storageDir: data.settings.storageDir || "",
          pages: data.pages,
          youtubeChannels: ytChannels,
        });
      } else {
        form.setFieldsValue({
          youtubeChannels: ytChannels,
        });
      }
    } catch (error) {
      if (initialLoad) {
        notification.error({ message: 'Failed to load settings configuration' });
      }
    } finally {
      if (initialLoad) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings(true);
    
    const handleFocus = () => {
      fetchSettings(false);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const updatedConfig: Partial<AppConfig> = {
        settings: {
          maxVideoSizeMb: values.maxVideoSizeMb,
          openaiApiKey: values.openaiApiKey || "",
          openaiBaseUrl: values.openaiBaseUrl || "https://api.openai.com/v1",
          openaiModel: values.openaiModel || "gpt-4o-mini",
          googleClientId: values.googleClientId || "",
          googleClientSecret: values.googleClientSecret || "",
          storageDir: values.storageDir || "",
        },
        pages: values.pages,
        youtubeChannels: values.youtubeChannels || [],
      };
      await api.updateSettings(updatedConfig);
      notification.success({ message: 'Settings saved successfully' });
    } catch (error) {
      notification.error({ message: 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (page: FacebookPage, index: number) => {
    if (!page.pageId || !page.accessToken) {
      notification.warning({ message: 'Validation Alert', description: 'Page ID and Access Token are required to test.' });
      return;
    }
    setTestingPageName(page.name);
    try {
      const res = await api.testFacebookConnection(page.pageId, page.accessToken);
      setTestingStatus(prev => ({ ...prev, [page.name]: res.status }));
      
      if (res.status === 'connected') {
        notification.success({ 
          message: 'Connection Successful', 
          description: `Page '${res.name || page.name}' verified and connected!` 
        });
        
        // Update in form list
        const currentPages = form.getFieldValue('pages');
        currentPages[index].status = 'connected';
        if (res.name) currentPages[index].name = res.name;
        form.setFieldsValue({ pages: currentPages });
      } else {
        notification.error({ 
          message: 'Connection Failed', 
          description: res.message 
        });
        
        const currentPages = form.getFieldValue('pages');
        currentPages[index].status = res.status;
        form.setFieldsValue({ pages: currentPages });
      }
    } catch (err: any) {
      notification.error({ message: 'Network Error', description: 'Could not contact Facebook Servers.' });
    } finally {
      setTestingPageName(null);
    }
  };

  const tabItems = [
    {
      key: 'facebook',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><GlobalOutlined /> Facebook Pages</span>,
      children: (
        <div>
          <h3 style={{ color: '#fff', marginTop: 0 }}>Facebook Page Config</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '20px' }}>
            Configure the Graph API Page ID and permanent/long-lived Page Access Token for each target page.
          </p>
          
          <Form.List name="pages">
            {(fields) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {fields.map(({ key, name, ...restField }, index) => {
                  const pageName = form.getFieldValue(['pages', name, 'name']);
                  const status = testingStatus[pageName] || form.getFieldValue(['pages', name, 'status']) || 'disconnected';
                  
                  return (
                    <Card 
                      key={key} 
                      className="glass-panel" 
                      bordered={false}
                      title={<span style={{ color: '#fff', fontWeight: 600 }}>{pageName || `Page #${index + 1}`}</span>}
                      extra={
                        <Space>
                          {status === 'connected' && <Tag color="success">✅ Connected</Tag>}
                          {status === 'expired' && <Tag color="warning">❌ Token Expired</Tag>}
                          {status === 'invalid_id' && <Tag color="error">❌ Invalid Page ID</Tag>}
                          {status === 'disconnected' && <Tag color="default">⚠️ Disconnected</Tag>}
                          
                          <Button 
                            size="small" 
                            type="dashed"
                            loading={testingPageName === pageName}
                            onClick={() => handleTestConnection(form.getFieldValue(['pages', name]), index)}
                            style={{ color: '#c084fc', borderColor: 'rgba(168,85,247,0.3)' }}
                          >
                            Test Connection
                          </Button>
                        </Space>
                      }
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'pageId']}
                            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Page ID</span>}
                            rules={[{ required: true, message: 'Missing Page ID' }]}
                          >
                            <Input placeholder="Enter Facebook Page ID" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'name']}
                            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Page Name (Label)</span>}
                            rules={[{ required: true, message: 'Missing Page Name' }]}
                          >
                            <Input placeholder="E.g. NT Video" />
                          </Form.Item>
                        </Col>
                      </Row>
                      
                      <Form.Item
                        {...restField}
                        name={[name, 'accessToken']}
                        label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Page Access Token</span>}
                        rules={[{ required: true, message: 'Missing Access Token' }]}
                      >
                        <Input.Password placeholder="E.g. EAAG..." />
                      </Form.Item>
                      
                      {/* Keep status hidden in form fields */}
                      <Form.Item name={[name, 'status']} noStyle>
                        <Input type="hidden" />
                      </Form.Item>
                    </Card>
                  );
                })}
              </div>
            )}
          </Form.List>
        </div>
      )
    },
    {
      key: 'youtube',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><YoutubeOutlined /> YouTube Channels</span>,
      children: (
        <div>
          <h3 style={{ color: '#fff', marginTop: 0 }}>YouTube Channel Config</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '20px' }}>
            Configure your Google OAuth Web App credentials. The Authorized Redirect URI in Google Cloud Console MUST be:
            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', margin: '0 6px', color: '#c084fc' }}>
              {API_BASE_URL}/google/callback
            </code>
          </p>
          
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="googleClientId"
                label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Google Client ID</span>}
              >
                <Input placeholder="Enter Google Client ID" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="googleClientSecret"
                label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Google Client Secret</span>}
              >
                <Input.Password placeholder="Enter Google Client Secret" />
              </Form.Item>
            </Col>
          </Row>
          
          <div style={{ marginBottom: '24px' }}>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => {
                const clientId = form.getFieldValue('googleClientId');
                const clientSecret = form.getFieldValue('googleClientSecret');
                if (!clientId || !clientSecret) {
                  notification.warning({
                    message: 'Credentials Required',
                    description: 'Please input Google Client ID and Secret and click "Save All Settings" first.'
                  });
                  return;
                }
                window.open(`${API_BASE_URL}/google/auth`, 'google_oauth_popup', 'width=600,height=700');
              }}
              style={{ background: '#ff0000', borderColor: '#ff0000', fontWeight: 600 }}
            >
              Connect YouTube Channel
            </Button>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginLeft: '12px' }}>
              Save credentials first before connecting.
            </span>
          </div>
          
          <Divider style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '20px 0' }} />
          
          <h4 style={{ color: '#fff', marginBottom: '12px' }}>Connected YouTube Channels</h4>
          
          {youtubeChannels.length === 0 ? (
            <div style={{ 
              padding: '24px', 
              textAlign: 'center', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px',
              border: '1px dashed rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)' 
            }}>
              No YouTube Channels connected yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {youtubeChannels.map((channel) => (
                <div 
                  key={channel.channelId} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 16px', 
                    background: 'rgba(255,255,255,0.04)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {channel.avatarUrl ? (
                      <img 
                        src={channel.avatarUrl} 
                        alt={channel.name} 
                        style={{ width: '40px', height: '40px', borderRadius: '50%' }} 
                      />
                    ) : (
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        background: '#ff0000', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold'
                      }}>
                        YT
                      </div>
                    )}
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>{channel.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Channel ID: {channel.channelId}</div>
                    </div>
                  </div>
                  
                  <Space>
                    <Tag color="success">Connected</Tag>
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => {
                        const updated = youtubeChannels.filter((c) => c.channelId !== channel.channelId);
                        setYoutubeChannels(updated);
                        form.setFieldsValue({ youtubeChannels: updated });
                      }}
                    />
                  </Space>
                </div>
              ))}
            </div>
          )}
          
          <Form.Item name="youtubeChannels" noStyle>
            <Input type="hidden" />
          </Form.Item>
        </div>
      )
    },
    {
      key: 'ai',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><KeyOutlined /> OpenAI API</span>,
      children: (
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>OpenAI-Compatible AI settings</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '20px' }}>
            Set up credentials to feed the AI generator. This works with OpenAI or any compatible base proxy (Gemini, Local LM, OpenRouter).
          </p>
          
          <Form.Item
            name="openaiApiKey"
            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>API Key</span>}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          
          <Form.Item
            name="openaiBaseUrl"
            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Base API URL</span>}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          
          <Form.Item
            name="openaiModel"
            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Model Name</span>}
          >
            <Input placeholder="gpt-4o-mini" />
          </Form.Item>
        </div>
      )
    },
    {
      key: 'general',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><SettingOutlined /> General</span>,
      children: (
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>General Settings</h3>
          
          <Form.Item
            name="maxVideoSizeMb"
            label={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Maximum Video Size (MB)</span>}
            rules={[{ required: true, message: 'Please specify max upload size' }]}
          >
            <InputNumber style={{ width: '100%' }} min={10} max={102400} />
          </Form.Item>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '-12px' }}>
            Videos larger than this configured size limit will be rejected during upload. Default is 20GB (20480 MB).
          </p>
        </div>
      )
    }
  ];

  return (
    <Card className="glass-panel" bordered={false} style={{ margin: '0 16px' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          maxVideoSizeMb: 20480,
          openaiBaseUrl: 'https://api.openai.com/v1',
          openaiModel: 'gpt-4o-mini',
          googleClientId: '',
          googleClientSecret: '',
          storageDir: '',
          pages: [],
          youtubeChannels: [],
        }}
      >
        <Tabs defaultActiveKey="facebook" items={tabItems} style={{ color: '#fff' }} />
        
        <Form.Item name="storageDir" noStyle>
          <Input type="hidden" />
        </Form.Item>
        
        <Divider style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '24px 0' }} />
        
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading}
          style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)', border: 'none', height: '40px', padding: '0 32px', fontSize: '15px', fontWeight: 600 }}
        >
          Save All Settings
        </Button>
      </Form>
    </Card>
  );
};



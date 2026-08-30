import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Table, Tag, Progress, Space, Button, Alert, Tooltip } from 'antd';
import { 
  SendOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  DatabaseOutlined,
  GlobalOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import type { HistoryEntry } from '../types';
import dayjs from 'dayjs';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onSetReuseVideo?: (filename: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSetReuseVideo }) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 15000, // Refresh every 15s for dynamic feel
  });


  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <SyncOutlined spin style={{ fontSize: '32px', color: '#a855f7' }} />
        <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.65)' }}>Loading Dashboard Stats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Data"
        description="Could not connect to FastAPI backend services. Please ensure the backend is running."
        type="error"
        showIcon
      />
    );
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => dayjs(text).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: 'rgba(255,255,255,0.3)' }}>No Title</span>,
    },
    {
      title: 'Pages',
      dataIndex: 'pages',
      key: 'pages',
      render: (pages: any[]) => (
        <Space size={[0, 4]} wrap>
          {pages.map((p) => {
            const isSuccess = p.status === 'success';
            return (
              <Tooltip key={p.name} title={isSuccess ? `Post ID: ${p.postId}` : `Error: ${p.error}`}>
                <Tag color={isSuccess ? 'success' : 'error'}>
                  {p.name} {isSuccess ? '✅' : '❌'}
                </Tag>
              </Tooltip>
            );
          })}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: HistoryEntry) => {
        const filename = record.videoPath.split('/').pop() || '';
        return (
          <Button 
            type="link" 
            size="small" 
            style={{ color: '#c084fc', padding: 0 }}
            onClick={() => {
              if (onSetReuseVideo) {
                onSetReuseVideo(filename);
              }
              onNavigate('publish');
            }}
          >
            Reuse Video
          </Button>
        );
      },
    },
  ];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-panel stat-card-gradient glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Total Posts</span>}
              value={stats?.cards.totalPosts}
              prefix={<SendOutlined style={{ color: '#c084fc' }} />}
              valueStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-panel stat-card-green glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Successful</span>}
              value={stats?.cards.successfulPosts}
              prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: '#fff', fontWeight: 700 }}
              suffix={<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>({stats?.cards.successRate}%)</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-panel stat-card-red glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Failed Posts</span>}
              value={stats?.cards.failedPosts}
              prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
              valueStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="glass-panel stat-card-blue glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Scheduled Posts</span>}
              value={stats?.cards.scheduledPosts}
              prefix={<ClockCircleOutlined style={{ color: '#3b82f6' }} />}
              valueStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Middle Row: Storage & Connections */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}><DatabaseOutlined style={{ color: '#a855f7' }} /> Local Storage Usage</span>} 
            className="glass-panel" 
            bordered={false}
            style={{ height: '100%' }}
          >
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Videos: {formatSize(stats?.storage.videosBytes || 0)}</span>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Max Limit: {stats?.storage.maxSizeBytes === 0 ? 'Unlimited' : formatSize(stats?.storage.maxSizeBytes || 0)}
                </span>
              </div>
              <Progress 
                percent={stats?.storage.percentUsed} 
                status={stats?.storage.percentUsed && stats.storage.percentUsed > 85 ? "exception" : "active"}
                strokeColor={{
                  '0%': '#a855f7',
                  '100%': '#c084fc',
                }}
              />
              <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
                Storage holds your uploaded video files and generated thumbnails inside the `storage/` directory on your local disk.
              </p>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}><GlobalOutlined style={{ color: '#a855f7' }} /> Connected Facebook Pages</span>} 
            className="glass-panel" 
            bordered={false}
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats?.pagesStatus.map((page) => (
                <div key={page.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{page.name}</span>
                  {page.status === 'connected' ? (
                    <Tag color="success">✅ Connected</Tag>
                  ) : page.status === 'expired' ? (
                    <Tag color="warning">❌ Token Expired</Tag>
                  ) : page.status === 'invalid_id' ? (
                    <Tag color="error">❌ Invalid Page ID</Tag>
                  ) : (
                    <Tag color="default">⚠️ Not Configured</Tag>
                  )}
                </div>
              ))}
              <Button 
                type="dashed" 
                block 
                style={{ borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
                onClick={() => onNavigate('settings')}
              >
                Manage Pages & Tokens
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bottom Row: Recent Activity */}
      <Card 
        title={<span style={{ color: '#fff' }}>Recent Activity</span>} 
        className="glass-panel" 
        bordered={false} 
        style={{ marginTop: '24px' }}
      >
        <Table 
          dataSource={stats?.recentActivity} 
          columns={columns} 
          rowKey="id" 
          pagination={false} 
          locale={{ emptyText: 'No posts published yet. Go to Quick Publish to make your first post!' }}
        />
      </Card>
    </div>
  );
};

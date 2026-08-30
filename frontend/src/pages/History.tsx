import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Table, Tag, Button, Space, Input, Tooltip, Drawer, Descriptions, Popconfirm, notification } from 'antd';
import { SearchOutlined, EyeOutlined, DeleteOutlined, SendOutlined, DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { HistoryEntry } from '../types';
import dayjs from 'dayjs';

interface HistoryProps {
  onNavigate: (page: string) => void;
  onSetReuseVideo: (filename: string) => void;
}

export const History: React.FC<HistoryProps> = ({ onNavigate, onSetReuseVideo }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['postingHistory'],
    queryFn: api.getHistory,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteHistoryEntry,
    onSuccess: () => {
      notification.success({ message: 'Log Deleted', description: 'Posting history log removed successfully.' });
      queryClient.invalidateQueries({ queryKey: ['postingHistory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err: any) => {
      notification.error({ message: 'Failed to delete history log', description: err.message });
    }
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleReuse = (videoPath: string) => {
    const filename = videoPath.split('/').pop() || '';
    onSetReuseVideo(filename);
    onNavigate('publish');
  };

  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(history, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `fb_poster_history_${dayjs().format('YYYYMMDD_HHmmss')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredHistory = history.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pages.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const columns = [
    {
      title: 'Date/Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      sorter: (a: HistoryEntry, b: HistoryEntry) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
      render: (text: string) => dayjs(text).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Video File',
      dataIndex: 'videoPath',
      key: 'videoPath',
      render: (text: string) => {
        const filename = text.split('/').pop() || '';
        return (
          <Tooltip title={filename}>
            <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#c084fc' }}>
              {filename.length > 25 ? `${filename.substring(0, 22)}...` : filename}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: 'rgba(255,255,255,0.25)' }}>No Title</span>,
    },
    {
      title: 'Broadcast Pages',
      dataIndex: 'pages',
      key: 'pages',
      render: (pages: any[]) => {
        const successCount = pages.filter(p => p.status === 'success').length;
        const total = pages.length;
        let color = 'default';
        let statusText = 'Pending';
        
        if (total > 0) {
          if (successCount === total) {
            color = 'success';
            statusText = 'All Success ✅';
          } else if (successCount === 0) {
            color = 'error';
            statusText = 'All Failed ❌';
          } else {
            color = 'warning';
            statusText = `Partial (${successCount}/${total})`;
          }
        }
        
        return (
          <Space direction="vertical" size={2}>
            <Tag color={color}>{statusText}</Tag>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
              {pages.map(p => p.name).join(', ')}
            </span>
          </Space>
        );
      }
    },
    {
      title: 'Execution',
      dataIndex: 'executionTimeMs',
      key: 'executionTimeMs',
      render: (ms: number) => ms ? `${(ms / 1000).toFixed(2)}s` : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: HistoryEntry) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined style={{ color: '#3b82f6' }} />}
            onClick={() => setSelectedEntry(record)}
            title="View Details"
          />
          <Button 
            type="text" 
            icon={<SendOutlined style={{ color: '#10b981' }} />}
            onClick={() => handleReuse(record.videoPath)}
            title="Reuse Video"
          />
          <Popconfirm
            title="Delete this history entry?"
            description="This will clear this item from your dashboard records."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />}
              title="Delete Log"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Search and Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Space size="middle">
          <Input
            placeholder="Search title, caption, or page..."
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
            style={{ width: '320px', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            type="dashed" 
            icon={<SyncOutlined />} 
            onClick={() => refetch()}
            style={{ borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
          >
            Refresh Log
          </Button>
        </Space>
        
        <Button 
          type="primary" 
          icon={<DownloadOutlined />} 
          onClick={handleExportJSON}
          style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)', border: 'none' }}
          disabled={history.length === 0}
        >
          Export History JSON
        </Button>
      </div>

      <Card className="glass-panel" bordered={false}>
        <Table
          dataSource={filteredHistory}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: 'No posting records found. Make your first publish!' }}
        />
      </Card>

      {/* Details Drawer */}
      <Drawer
        title="Post Details Log"
        placement="right"
        width={600}
        onClose={() => setSelectedEntry(null)}
        open={selectedEntry !== null}
        className="glass-panel"
        styles={{ body: { color: '#fff', background: 'rgba(17,17,24,0.95)' }, header: { borderBottom: '1px solid rgba(255,255,255,0.05)' } }}
      >
        {selectedEntry && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions title="Post Info" column={1} bordered size="small" style={{ color: '#fff' }}>
              <Descriptions.Item label="Post ID ID">{selectedEntry.id}</Descriptions.Item>
              <Descriptions.Item label="Date Published">{dayjs(selectedEntry.timestamp).format('DD MMMM YYYY, HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="Video File">{selectedEntry.videoPath.split('/').pop()}</Descriptions.Item>
              <Descriptions.Item label="Title">{selectedEntry.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="Execution Time">{selectedEntry.executionTimeMs ? `${selectedEntry.executionTimeMs} ms` : '-'}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="Caption" column={1} bordered size="small">
              <Descriptions.Item label="Text" style={{ whiteSpace: 'pre-wrap' }}>{selectedEntry.caption}</Descriptions.Item>
            </Descriptions>

            <div>
              <h4 style={{ color: '#fff', marginBottom: '12px' }}>Publishing Results per Page</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedEntry.pages.map((p) => {
                  const isSuccess = p.status === 'success';
                  return (
                    <div key={p.name} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: isSuccess ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <Tag color={isSuccess ? 'success' : 'error'}>{isSuccess ? 'SUCCESS' : 'FAILED'}</Tag>
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        {isSuccess ? (
                          <span>FB Post ID: <code style={{ color: '#c084fc' }}>{p.postId}</code></span>
                        ) : (
                          <span style={{ color: '#ef4444' }}>Error: {p.error}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <Button 
              type="primary" 
              block 
              icon={<SendOutlined />}
              onClick={() => {
                handleReuse(selectedEntry.videoPath);
                setSelectedEntry(null);
              }}
              style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)', border: 'none' }}
            >
              Reuse Video in Quick Publish
            </Button>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

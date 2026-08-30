import React from 'react';
import { Layout, Menu, Button, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  SendOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentPage,
  onPageChange,
}) => {
  const [collapsed, setCollapsed] = React.useState(false);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined style={{ fontSize: '18px' }} />,
      label: 'Dashboard',
    },
    {
      key: 'publish',
      icon: <SendOutlined style={{ fontSize: '18px' }} />,
      label: 'Quick Publish',
    },
    {
      key: 'media',
      icon: <PlayCircleOutlined style={{ fontSize: '18px' }} />,
      label: 'Media Library',
    },
    {
      key: 'history',
      icon: <HistoryOutlined style={{ fontSize: '18px' }} />,
      label: 'Posting History',
    },
    {
      key: 'analytics',
      icon: <BarChartOutlined style={{ fontSize: '18px' }} />,
      label: 'Analytics',
    },
    {
      key: 'settings',
      icon: <SettingOutlined style={{ fontSize: '18px' }} />,
      label: 'Settings',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        theme="dark"
        className="glass-panel"
        style={{
          position: 'fixed',
          left: 16,
          top: 16,
          bottom: 16,
          height: 'calc(100vh - 32px)',
          zIndex: 100,
          background: 'rgba(17, 17, 24, 0.8)',
          borderRight: 'none',
        }}
      >
        <div className="sidebar-logo">
          <SendOutlined style={{ fontSize: '22px', color: '#a855f7' }} />
          {!collapsed && <h1>FB Multi Poster</h1>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          style={{ 
            background: 'transparent', 
            borderRight: 0,
            padding: '16px 8px',
          }}
          items={menuItems.map(item => ({
            ...item,
            onClick: () => onPageChange(item.key),
            style: {
              borderRadius: '8px',
              marginBottom: '6px',
              fontSize: '15px',
              fontWeight: 500,
              backgroundColor: currentPage === item.key ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              color: currentPage === item.key ? '#d8b4fe' : 'rgba(255, 255, 255, 0.65)',
            }
          }))}
        />
        {!collapsed && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            padding: '12px',
            background: 'rgba(168, 85, 247, 0.05)',
            border: '1px dashed rgba(168, 85, 247, 0.2)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', color: 'rgba(255,255,255,0.45)' }}>
              Connected Channels
            </Text>
            <Space style={{ marginTop: '6px' }}>
              <span title="NT Video" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              <span title="Midnight Tales" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              <span title="StoryVerse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            </Space>
          </div>
        )}
      </Sider>
      
      <Layout style={{ 
        marginLeft: collapsed ? 96 : 276, 
        transition: 'margin-left 0.2s',
        background: 'transparent',
        padding: '16px 16px 16px 0',
      }}>
        <Header style={{ 
          background: 'rgba(17, 17, 24, 0.6)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: 0, 
          margin: '0 0 16px 16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          height: '60px',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 50,
              height: 50,
              color: 'rgba(255, 255, 255, 0.85)',
              marginLeft: '8px',
            }}
          />
          <Typography.Title level={4} style={{ margin: 0, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
            {menuItems.find(item => item.key === currentPage)?.label}
          </Typography.Title>
        </Header>
        
        <Content style={{ 
          margin: '0 0 0 16px',
          minHeight: 280,
          background: 'transparent',
        }}>
          <div className="animate-fade-in-up">
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

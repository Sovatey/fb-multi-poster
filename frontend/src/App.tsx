import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { QuickPublish } from './pages/QuickPublish';
import { MediaLibrary } from './pages/MediaLibrary';
import { History } from './pages/History';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [reuseVideoFilename, setReuseVideoFilename] = useState<string | undefined>(undefined);

  const handleSetReuseVideo = (filename: string) => {
    setReuseVideoFilename(filename);
  };

  const handleClearReuseVideo = () => {
    setReuseVideoFilename(undefined);
  };

  // Render correct page view
  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={setCurrentPage} 
            onSetReuseVideo={handleSetReuseVideo} 
          />
        );
      case 'publish':
        return (
          <QuickPublish 
            reuseVideoFilename={reuseVideoFilename} 
            onClearReuseVideo={handleClearReuseVideo} 
          />
        );
      case 'media':
        return (
          <MediaLibrary 
            onNavigate={setCurrentPage} 
            onSetReuseVideo={handleSetReuseVideo} 
          />
        );
      case 'history':
        return (
          <History 
            onNavigate={setCurrentPage} 
            onSetReuseVideo={handleSetReuseVideo} 
          />
        );
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#a855f7', // Purple primary
            colorLink: '#c084fc',
            borderRadius: 10,
            colorBgBase: '#08080c', // Sleek background color
            colorBgContainer: 'rgba(17, 17, 24, 0.7)', // Sleek card background
            fontFamily: "'Outfit', sans-serif",
          },
          components: {
            Menu: {
              itemBg: 'transparent',
              itemSelectedBg: 'rgba(168, 85, 247, 0.15)',
              itemSelectedColor: '#d8b4fe',
            },
            Table: {
              colorBgContainer: 'transparent',
            }
          }
        }}
      >
        <DashboardLayout currentPage={currentPage} onPageChange={setCurrentPage}>
          {renderContent()}
        </DashboardLayout>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;

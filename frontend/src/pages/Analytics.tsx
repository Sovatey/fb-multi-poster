import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Radio, Statistic, Alert, Progress } from 'antd';
import { LineChartOutlined, PieChartOutlined, SyncOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { TrendDataPoint } from '../types';

export const Analytics: React.FC = () => {
  const [chartType, setChartType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['analyticsStats'],
    queryFn: api.getDashboardStats,
  });


  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <SyncOutlined spin style={{ fontSize: '32px', color: '#a855f7' }} />
        <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.65)' }}>Calculating metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Analytics Error"
        description="Unable to connect to the backend server to pull analytics. Verify FastAPI is online."
        type="error"
        showIcon
      />
    );
  }

  const trends: TrendDataPoint[] = stats?.trends[chartType] || [];
  
  // Find maximum post count to scale the charts dynamically
  const maxPosts = Math.max(...trends.map(t => t.posts), 1);
  const chartHeight = 220;
  const chartWidth = 550;
  const paddingX = 40;
  const paddingY = 30;

  // Calculate SVG Points for the line chart
  const points = trends.map((item, idx) => {
    const x = paddingX + (idx * (chartWidth - paddingX * 2)) / (trends.length - 1 || 1);
    const y = chartHeight - paddingY - (item.posts * (chartHeight - paddingY * 2)) / maxPosts;
    return { x, y, label: item.date || item.week || item.month || '', value: item.posts };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  return (
    <div style={{ padding: '0 16px' }}>
      {/* High-level cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="glass-panel stat-card-gradient glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Publish Success Rate</span>}
              value={stats?.cards.successRate}
              suffix="%"
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
            />
            <div style={{ marginTop: '12px' }}>
              <Progress 
                percent={stats?.cards.successRate} 
                showInfo={false} 
                strokeColor="#10b981" 
                trailColor="rgba(255,255,255,0.05)"
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-panel glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Most Active Page</span>}
              value={stats?.mostUsedPage || 'None'}
              valueStyle={{ color: '#c084fc', fontWeight: 700 }}
            />
            <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
              Target page with the highest overall posting frequency.
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-panel glow-card" bordered={false}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Most Used Hashtags</span>}
              value={stats?.mostUsedHashtags.slice(0, 3).join(' ') || 'None'}
              valueStyle={{ color: '#3b82f6', fontSize: '20px', fontWeight: 700 }}
            />
            <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
              Frequently appended tags in successful captions.
            </div>
          </Card>
        </Col>
      </Row>

      {/* Chart Section */}
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}><LineChartOutlined style={{ color: '#a855f7' }} /> Publishing Volumetric Trends</span>
            <Radio.Group 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="daily">Daily</Radio.Button>
              <Radio.Button value="weekly">Weekly</Radio.Button>
              <Radio.Button value="monthly">Monthly</Radio.Button>
            </Radio.Group>
          </div>
        }
        className="glass-panel" 
        bordered={false} 
        style={{ marginTop: '24px' }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} xl={16}>
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto', textAlign: 'center' }}>
              {/* Custom SVG Line Area Chart */}
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                style={{ width: '100%', maxWidth: '650px', height: 'auto', display: 'inline-block' }}
              >
                <defs>
                  <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="rgba(255,255,255,0.1)" />

                {/* Area under curve */}
                {points.length > 0 && (
                  <path d={areaPath} fill="url(#chartGlow)" />
                )}

                {/* Line path */}
                {points.length > 0 && (
                  <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="3.5" strokeLinecap="round" />
                )}

                {/* Circles & Labels */}
                {points.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r="5" fill="#a855f7" stroke="#fff" strokeWidth="1.5" />
                    {/* Value text above dot */}
                    <text x={p.x} y={p.y - 10} fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">
                      {p.value}
                    </text>
                    {/* X axis Label */}
                    <text x={p.x} y={chartHeight - 10} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="middle">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </Col>
          <Col xs={24} xl={8}>
            <div style={{ padding: '8px' }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '15px' }}><PieChartOutlined style={{ color: '#a855f7' }} /> Activity Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>Publish Attempts:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{stats?.cards.totalPosts}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>Success Count:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{stats?.cards.successfulPosts}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>Fail Count:</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{stats?.cards.failedPosts}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>Scheduler Queue:</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{stats?.cards.scheduledPosts}</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

/**
 * UsageChart - 使用趋势图表组件
 *
 * 功能：
 * - 使用 Chart.js 实现数据可视化
 * - 支持折线图、柱状图、饼图
 * - 响应式设计
 * - 自适应配色
 */

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import type { TimeSeriesData, ModelDistribution } from '../../types/tokenMonitor';

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface UsageChartProps {
  data: TimeSeriesData[];
  type?: 'line' | 'bar' | 'pie';
  height?: number;
  isLoading?: boolean;
}

// 图表配色方案
const chartColors = {
  blue: {
    primary: 'rgba(99, 102, 241, 1)',
    background: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.5)'
  },
  purple: {
    primary: 'rgba(139, 92, 246, 1)',
    background: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.5)'
  },
  green: {
    primary: 'rgba(16, 185, 129, 1)',
    background: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.5)'
  },
  orange: {
    primary: 'rgba(245, 158, 11, 1)',
    background: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.5)'
  },
  pink: {
    primary: 'rgba(236, 72, 153, 1)',
    background: 'rgba(236, 72, 153, 0.1)',
    border: 'rgba(236, 72, 153, 0.5)'
  },
  cyan: {
    primary: 'rgba(6, 182, 212, 1)',
    background: 'rgba(6, 182, 212, 0.1)',
    border: 'rgba(6, 182, 212, 0.5)'
  }
};

// 通用图表配置
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        color: '#64748b'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: function (context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toLocaleString();
          }
          return label;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(148, 163, 184, 0.1)'
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 11
        },
        callback: function (value: any) {
          return value.toLocaleString();
        }
      }
    }
  },
  interaction: {
    mode: 'index' as const,
    intersect: false
  }
};

export const UsageChart: React.FC<UsageChartProps> = ({
  data,
  type = 'line',
  height = 300,
  isLoading = false
}) => {
  // 格式化时间标签
  const formatTimeLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 24) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  // 准备折线图数据
  const lineChartData = useMemo(() => {
    return {
      labels: data.map((d) => formatTimeLabel(d.timestamp)),
      datasets: [
        {
          label: 'Token 使用量',
          data: data.map((d) => d.tokens),
          borderColor: chartColors.blue.primary,
          backgroundColor: chartColors.blue.background,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: chartColors.blue.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: '成本 (¢)',
          data: data.map((d) => d.cost * 100),
          borderColor: chartColors.green.primary,
          backgroundColor: chartColors.green.background,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: chartColors.green.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  }, [data]);

  // 准备柱状图数据
  const barChartData = useMemo(() => {
    return {
      labels: data.map((d) => formatTimeLabel(d.timestamp)),
      datasets: [
        {
          label: '输入 Tokens',
          data: data.map((d) => d.inputTokens || 0),
          backgroundColor: chartColors.blue.primary,
          borderRadius: 4
        },
        {
          label: '输出 Tokens',
          data: data.map((d) => d.outputTokens || 0),
          backgroundColor: chartColors.purple.primary,
          borderRadius: 4
        }
      ]
    };
  }, [data]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // 空数据状态
  if (data.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-12">
        <div className="text-center">
          <svg
            className="w-12 h-12 text-slate-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无图表数据</h3>
          <p className="text-sm text-slate-500">
            数据积累后将显示使用趋势
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Token 使用趋势</h3>
          <p className="text-sm text-slate-500 mt-1">
            近 {data.length} 个数据点
          </p>
        </div>
      </div>

      <div style={{ height: `${height}px` }}>
        {type === 'line' && <Line data={lineChartData} options={chartOptions} />}
        {type === 'bar' && <Bar data={barChartData} options={chartOptions} />}
      </div>
    </div>
  );
};

export default UsageChart;

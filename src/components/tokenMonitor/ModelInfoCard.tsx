/**
 * ModelInfoCard - 模型信息卡片组件
 *
 * 功能：
 * - 显示模型使用分布
 * - 饼图展示各模型占比
 * - 列表显示各模型的详细统计
 */

import React, { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { ArcElement, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';
import { Bot, Zap, DollarSign } from 'lucide-react';
import type { ProviderUsage } from '../../types/tokenMonitor';

import { Chart as ChartJS } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ModelInfoCardProps {
  providers: ProviderUsage[];
  isLoading?: boolean;
}

// 图表配色（多种颜色）
const pieColors = [
  'rgba(99, 102, 241, 0.8)',   // Indigo
  'rgba(139, 92, 246, 0.8)',   // Purple
  'rgba(16, 185, 129, 0.8)',   // Green
  'rgba(245, 158, 11, 0.8)',   // Orange
  'rgba(236, 72, 153, 0.8)',   // Pink
  'rgba(6, 182, 212, 0.8)',    // Cyan
  'rgba(59, 130, 246, 0.8)',   // Blue
  'rgba(234, 179, 8, 0.8)',    // Yellow
];

export const ModelInfoCard: React.FC<ModelInfoCardProps> = ({
  providers,
  isLoading = false
}) => {
  // 计算总量
  const totals = useMemo(() => {
    return providers.reduce(
      (acc, provider) => ({
        tokens: acc.tokens + provider.tokens,
        cost: acc.cost + provider.cost,
        requests: acc.requests + provider.requests
      }),
      { tokens: 0, cost: 0, requests: 0 }
    );
  }, [providers]);

  // 准备饼图数据
  const pieChartData = useMemo(() => {
    return {
      labels: providers.map((p) => `${p.provider}/${p.model}`),
      datasets: [
        {
          data: providers.map((p) => p.tokens),
          backgroundColor: pieColors.slice(0, providers.length),
          borderColor: pieColors.map((c) => c.replace('0.8', '1')),
          borderWidth: 2
        }
      ]
    };
  }, [providers]);

  // 格式化 Token 数量
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  // 格式化成本
  const formatCost = (cost: number) => {
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`;
    }
    return `¢${Math.round(cost * 100)}`;
  };

  // 饼图配置
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // 隐藏图例，使用自定义列表
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formatTokens(value)} (${percentage}%)`;
          }
        }
      }
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 shadow-lg"
      >
        <div className="animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-slate-200 rounded-lg mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // 空状态
  if (providers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-12 shadow-lg"
      >
        <div className="text-center">
          <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无模型数据</h3>
          <p className="text-sm text-slate-500">
            使用 AI 功能后，模型统计将显示在这里
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 shadow-lg"
    >
      {/* 标题 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800">模型使用分布</h3>
        <p className="text-sm text-slate-500 mt-1">
          共 {providers.length} 个模型
        </p>
      </div>

      {/* 饼图和统计列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 饼图 */}
        <div className="flex items-center justify-center">
          <div style={{ height: '200px', width: '200px' }}>
            <Pie data={pieChartData} options={pieOptions} />
          </div>
        </div>

        {/* 统计列表 */}
        <div className="space-y-3">
          {providers.map((provider, index) => {
            const percentage = totals.tokens > 0
              ? ((provider.tokens / totals.tokens) * 100).toFixed(1)
              : '0.0';
            const color = pieColors[index % pieColors.length];

            return (
              <motion.div
                key={`${provider.provider}-${provider.model}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/50 rounded-lg p-3 border border-slate-200/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <h4 className="text-sm font-medium text-slate-700 truncate">
                        {provider.model}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500">{provider.provider}</p>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 ml-2">
                    {percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {/* Tokens */}
                  <div className="flex items-center gap-1 text-slate-600">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span>{formatTokens(provider.tokens)}</span>
                  </div>

                  {/* 成本 */}
                  <div className="flex items-center gap-1 text-slate-600">
                    <DollarSign className="w-3 h-3 text-green-500" />
                    <span>{formatCost(provider.cost)}</span>
                  </div>

                  {/* 请求次数 */}
                  <div className="flex items-center gap-1 text-slate-600">
                    <Bot className="w-3 h-3 text-blue-500" />
                    <span>{provider.requests}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default ModelInfoCard;

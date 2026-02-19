/**
 * TokenMonitor - Token 监控主页面
 *
 * 功能：
 * - 整合所有 Token 监控组件
 * - 显示连接状态和控制按钮
 * - 支持手动刷新和日期范围过滤
 * - 响应式布局
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  DollarSign,
  MessageSquare,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Calendar,
  X
} from 'lucide-react';
import { useTokenMonitor } from '../contexts/TokenMonitorContext';
import { UsageStatsCard } from '../components/tokenMonitor/UsageStatsCard';
import { SessionList } from '../components/tokenMonitor/SessionList';
import { UsageChart } from '../components/tokenMonitor/UsageChart';
import { ModelInfoCard } from '../components/tokenMonitor/ModelInfoCard';
import type { PeriodPreset } from '../types/tokenMonitor';

const periodPresets: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'last7days', label: '最近 7 天' },
  { value: 'last30days', label: '最近 30 天' },
  { value: 'thisMonth', label: '本月' }
];

export const TokenMonitor: React.FC = () => {
  const {
    connectionStatus,
    usageCost,
    sessions,
    timeSeriesData,
    periodPreset,
    isLoadingUsage,
    isLoadingSessions,
    error,
    refresh,
    setPeriodPreset
  } = useTokenMonitor();

  // 连接状态指示器
  const ConnectionStatus = () => {
    const statusConfig = {
      DISCONNECTED: {
        icon: WifiOff,
        text: '未连接',
        color: 'text-slate-500',
        bgColor: 'bg-slate-100'
      },
      CONNECTING: {
        icon: RefreshCw,
        text: '连接中...',
        color: 'text-blue-500',
        bgColor: 'bg-blue-100'
      },
      CONNECTED: {
        icon: Wifi,
        text: '已连接',
        color: 'text-blue-500',
        bgColor: 'bg-blue-100'
      },
      AUTHENTICATED: {
        icon: Activity,
        text: '已认证',
        color: 'text-green-500',
        bgColor: 'bg-green-100'
      },
      ERROR: {
        icon: AlertCircle,
        text: '连接错误',
        color: 'text-red-500',
        bgColor: 'bg-red-100'
      }
    };

    const config = statusConfig[connectionStatus];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgColor}`}>
        <Icon className={`w-4 h-4 ${config.color} ${connectionStatus === 'CONNECTING' ? 'animate-spin' : ''}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.text}</span>
      </div>
    );
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // 格式化成本
  const formatCost = (cost: number) => {
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`;
    }
    return `¢${Math.round(cost * 100)}`;
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* 顶部导航栏 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 mb-6 shadow-lg"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* 左侧：标题和连接状态 */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Token 监控</h1>
              <p className="text-sm text-slate-500 mt-1">
                实时监控 OpenClaw-CN 的 Token 使用情况
              </p>
            </div>
            <ConnectionStatus />
          </div>

          {/* 右侧：控制按钮 */}
          <div className="flex items-center gap-3">
            {/* 日期范围选择器 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-lg border border-slate-200/50">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
                className="bg-transparent text-sm text-slate-700 focus:outline-none cursor-pointer"
              >
                {periodPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 刷新按钮 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={refresh}
              disabled={isLoadingUsage || isLoadingSessions}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${
                  isLoadingUsage || isLoadingSessions
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md hover:shadow-lg'
                }
              `}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingUsage || isLoadingSessions ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </motion.button>
          </div>
        </div>

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800">错误</h4>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧面板：统计卡片和模型分布 */}
        <div className="lg:col-span-3 space-y-6">
          {/* 使用统计卡片 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <UsageStatsCard
              title="总 Tokens"
              value={usageCost?.totalTokens ? formatNumber(usageCost.totalTokens) : '0'}
              subtitle="输入 + 输出"
              icon={<Zap className="w-5 h-5" />}
              color="blue"
              isLoading={isLoadingUsage}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <UsageStatsCard
              title="总成本"
              value={usageCost?.totalCost ? formatCost(usageCost.totalCost) : '¢0'}
              subtitle="累计花费"
              icon={<DollarSign className="w-5 h-5" />}
              color="green"
              isLoading={isLoadingUsage}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <UsageStatsCard
              title="会话数"
              value={usageCost?.sessionsCount ?? sessions.length}
              subtitle="总请求数"
              icon={<MessageSquare className="w-5 h-5" />}
              color="purple"
              isLoading={isLoadingUsage}
            />
          </motion.div>

          {/* 模型分布 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <ModelInfoCard
              providers={usageCost?.providers ?? []}
              isLoading={isLoadingUsage}
            />
          </motion.div>
        </div>

        {/* 右侧主区域：图表和会话列表 */}
        <div className="lg:col-span-9 space-y-6">
          {/* Token 使用趋势图 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <UsageChart
              data={timeSeriesData}
              type="line"
              height={300}
              isLoading={isLoadingSessions}
            />
          </motion.div>

          {/* 会话列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <SessionList
              sessions={sessions}
              isLoading={isLoadingSessions}
              onSelectSession={(session) => {
                console.log('查看会话详情:', session);
                // TODO: 打开会话详情弹窗
              }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TokenMonitor;

/**
 * UsageStatsCard - 使用统计卡片组件
 *
 * 功能：
 * - 显示关键指标（总 Tokens、总成本、会话数等）
 * - 毛玻璃效果
 * - Framer Motion 动画
 * - 趋势指示器
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  DollarSign,
  MessageSquare,
  Zap,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface UsageStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  isLoading?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/30',
    icon: 'text-blue-500',
    text: 'text-blue-600'
  },
  green: {
    bg: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/30',
    icon: 'text-green-500',
    text: 'text-green-600'
  },
  purple: {
    bg: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
    icon: 'text-purple-500',
    text: 'text-purple-600'
  },
  orange: {
    bg: 'from-orange-500/20 to-amber-500/20',
    border: 'border-orange-500/30',
    icon: 'text-orange-500',
    text: 'text-orange-600'
  },
  red: {
    bg: 'from-red-500/20 to-rose-500/20',
    border: 'border-red-500/30',
    icon: 'text-red-500',
    text: 'text-red-600'
  }
};

const iconMap = {
  activity: Activity,
  dollar: DollarSign,
  message: MessageSquare,
  zap: Zap
};

export const UsageStatsCard: React.FC<UsageStatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  isLoading = false
}) => {
  const colors = colorClasses[color];

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 shadow-lg"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-slate-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-slate-200 rounded w-1/3"></div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6 shadow-lg overflow-hidden"
    >
      {/* 背景渐变 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-50`} />

      {/* 内容 */}
      <div className="relative z-10">
        {/* 标题和图标 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-600">{title}</h3>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.bg} ${colors.icon}`}>
            {icon}
          </div>
        </div>

        {/* 数值 */}
        <div className="mb-2">
          <span className={`text-3xl font-bold ${colors.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        </div>

        {/* 副标题和趋势 */}
        <div className="flex items-center justify-between">
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}

          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default UsageStatsCard;

/**
 * SessionList - 会话列表组件
 *
 * 功能：
 * - 使用 react-virtuoso 实现虚拟滚动
 * - 显示会话信息（ID、模型、Token 数量、成本、时间）
 * - 支持点击查看详情
 * - 毛玻璃效果
 */

import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import {
  Bot,
  Clock,
  DollarSign,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import type { SessionUsage } from '../../types/tokenMonitor';

interface SessionListProps {
  sessions: SessionUsage[];
  onSelectSession?: (session: SessionUsage) => void;
  isLoading?: boolean;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  onSelectSession,
  isLoading = false
}) => {
  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

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

  // 截断会话 ID
  const truncateId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-6)}`;
  };

  // 单个会话项
  const SessionItem = useMemo(
    () =>
      ({ session, index }: { session: SessionUsage; index: number }) => (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
          className="group"
        >
          <div
            className={`
              backdrop-blur-xl bg-white/60 rounded-xl border border-slate-200/50
              p-4 mb-3 cursor-pointer transition-all duration-200
              hover:bg-white/80 hover:shadow-md hover:border-indigo-300/50
              active:scale-[0.98]
            `}
            onClick={() => onSelectSession?.(session)}
          >
            <div className="flex items-start justify-between">
              {/* 左侧：模型和会话信息 */}
              <div className="flex-1 min-w-0">
                {/* 模型名称 */}
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {session.model}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {session.provider}
                  </span>
                </div>

                {/* 会话 ID */}
                <div className="text-xs text-slate-500 font-mono mb-2">
                  {truncateId(session.sessionId)}
                </div>

                {/* 统计信息 */}
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  {/* Token 数量 */}
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-slate-400" />
                    <span>
                      {formatTokens(session.inputTokens)} / {formatTokens(session.outputTokens)} /{' '}
                      {formatTokens(session.totalTokens)}
                    </span>
                  </div>

                  {/* 成本 */}
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-green-500" />
                    <span>{formatCost(session.cost)}</span>
                  </div>

                  {/* 消息数 */}
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-blue-400" />
                    <span>{session.messagesCount}</span>
                  </div>
                </div>
              </div>

              {/* 右侧：时间和箭头 */}
              <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                {/* 时间 */}
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(session.startTime)}</span>
                </div>

                {/* 箭头图标 */}
                <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </motion.div>
      ),
    [onSelectSession]
  );

  // 加载状态
  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 空状态
  if (sessions.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 p-12">
        <div className="text-center">
          <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无会话数据</h3>
          <p className="text-sm text-slate-500">
            开始对话后，会话信息将显示在这里
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-slate-200/50 overflow-hidden">
      <div className="p-4 border-b border-slate-200/50">
        <h3 className="text-lg font-semibold text-slate-800">会话列表</h3>
        <p className="text-sm text-slate-500 mt-1">
          共 {sessions.length} 个会话
        </p>
      </div>

      <Virtuoso
        style={{ height: '600px' }}
        data={sessions}
        itemContent={(index, session) => <SessionItem session={session} index={index} />}
        defaultItemHeight={120}
      />
    </div>
  );
};

export default SessionList;

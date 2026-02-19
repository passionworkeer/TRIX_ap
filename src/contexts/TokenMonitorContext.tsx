/**
 * TokenMonitorContext - Token 监控全局状态管理
 *
 * 功能：
 * - 管理连接状态
 * - 缓存 Token 使用数据
 * - 提供数据刷新和过滤功能
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import gatewayAPI from '../services/GatewayAPI';
import type {
  GatewayConnectionStatus,
  UsageCostData,
  SessionUsage,
  TimeSeriesData,
  DateRange,
  PeriodPreset
} from '../types/tokenMonitor';

interface TokenMonitorState {
  // 连接状态
  connectionStatus: GatewayConnectionStatus;

  // 数据
  usageCost: UsageCostData | null;
  sessions: SessionUsage[];
  timeSeriesData: TimeSeriesData[];

  // 过滤器
  dateRange: DateRange;
  periodPreset: PeriodPreset;

  // 加载状态
  isLoadingUsage: boolean;
  isLoadingSessions: boolean;
  isLoadingTimeSeries: boolean;

  // 错误
  error: string | null;

  // 操作
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshTimeSeries: () => Promise<void>;
  setPeriodPreset: (preset: PeriodPreset) => void;
  setDateRange: (start: Date, end: Date) => void;
}

const TokenMonitorContext = createContext<TokenMonitorState | undefined>(undefined);

interface TokenMonitorProviderProps {
  children: ReactNode;
  gatewayUrl?: string;
  authToken?: string;
  autoConnect?: boolean;
  autoRefreshInterval?: number; // 自动刷新间隔（毫秒）
}

export const TokenMonitorProvider: React.FC<TokenMonitorProviderProps> = ({
  children,
  gatewayUrl = import.meta.env.VITE_GATEWAY_WS_URL || import.meta.env.VITE_PC_WEBSOCKET_URL || 'ws://127.0.0.1:18789',
  authToken = import.meta.env.VITE_GATEWAY_AUTH_TOKEN || import.meta.env.VITE_PC_AUTH_TOKEN || '',
  autoConnect = true,
  autoRefreshInterval = 30000
}) => {
  const [connectionStatus, setConnectionStatus] = useState<GatewayConnectionStatus>('DISCONNECTED');
  const [usageCost, setUsageCost] = useState<UsageCostData | null>(null);
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [periodPreset, setPeriodPresetState] = useState<PeriodPreset>('last7days');
  const [dateRange, setDateRangeState] = useState<DateRange>(() => getDateRangeForPreset('last7days'));
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingTimeSeries, setIsLoadingTimeSeries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算日期范围
  function getDateRangeForPreset(preset: PeriodPreset): DateRange {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'last30days':
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        // 保持当前范围
        break;
    }

    return { start, end };
  }

  // 设置 Gateway API 状态回调
  useEffect(() => {
    gatewayAPI.setOnStatusChange((status) => {
      console.log('[TokenMonitor] 连接状态变更:', status);
      setConnectionStatus(status);

      if (status === 'AUTHENTICATED') {
        // 连接成功后自动刷新数据
        refresh();
      }
    });
  }, []);

  // 自动连接
  useEffect(() => {
    if (autoConnect && connectionStatus === 'DISCONNECTED' && authToken) {
      console.log('[TokenMonitor] 自动连接到 Gateway');
      connect();
    }
  }, [autoConnect]);

  // 自动刷新数据
  useEffect(() => {
    if (connectionStatus === 'AUTHENTICATED' && autoRefreshInterval > 0) {
      console.log('[TokenMonitor] 设置自动刷新，间隔:', autoRefreshInterval);
      const interval = setInterval(() => {
        console.log('[TokenMonitor] 自动刷新数据');
        refresh();
      }, autoRefreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [connectionStatus, autoRefreshInterval]);

  // 连接到 Gateway
  const connect = useCallback(async () => {
    try {
      console.log('[TokenMonitor] 连接到 Gateway:', gatewayUrl);
      setError(null);
      await gatewayAPI.connect(gatewayUrl, authToken);
      console.log('[TokenMonitor] 连接成功');
    } catch (err) {
      console.error('[TokenMonitor] 连接失败:', err);
      setError(err instanceof Error ? err.message : '连接失败');
      setConnectionStatus('ERROR');
    }
  }, [gatewayUrl, authToken]);

  // 断开连接
  const disconnect = useCallback(() => {
    console.log('[TokenMonitor] 断开连接');
    gatewayAPI.disconnect();
  }, []);

  // 刷新使用成本数据
  const refreshUsage = useCallback(async () => {
    if (connectionStatus !== 'AUTHENTICATED') {
      console.warn('[TokenMonitor] 未认证，跳过刷新使用数据');
      return;
    }

    setIsLoadingUsage(true);
    setError(null);

    try {
      console.log('[TokenMonitor] 刷新使用成本数据');
      const data = await gatewayAPI.getUsageCost(dateRange.start, dateRange.end);
      setUsageCost(data);
      console.log('[TokenMonitor] 使用成本数据:', data);
    } catch (err) {
      console.error('[TokenMonitor] 刷新使用数据失败:', err);
      const errorMessage = err instanceof Error ? err.message : '刷新失败';
      setError(errorMessage);
    } finally {
      setIsLoadingUsage(false);
    }
  }, [connectionStatus, dateRange]);

  // 刷新会话列表
  const refreshSessions = useCallback(async () => {
    if (connectionStatus !== 'AUTHENTICATED') {
      console.warn('[TokenMonitor] 未认证，跳过刷新会话数据');
      return;
    }

    setIsLoadingSessions(true);
    setError(null);

    try {
      console.log('[TokenMonitor] 刷新会话列表');
      const data = await gatewayAPI.getSessionsUsage(dateRange.start, dateRange.end, 100);
      setSessions(data);
      console.log('[TokenMonitor] 会话列表:', data);
    } catch (err) {
      console.error('[TokenMonitor] 刷新会话数据失败:', err);
      const errorMessage = err instanceof Error ? err.message : '刷新失败';
      setError(errorMessage);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [connectionStatus, dateRange]);

  // 刷新时间序列数据
  const refreshTimeSeries = useCallback(async () => {
    if (connectionStatus !== 'AUTHENTICATED') {
      console.warn('[TokenMonitor] 未认证，跳过刷新时间序列数据');
      return;
    }

    setIsLoadingTimeSeries(true);
    setError(null);

    try {
      console.log('[TokenMonitor] 刷新时间序列数据');
      const data = await gatewayAPI.getTimeSeriesData();
      setTimeSeriesData(data);
      console.log('[TokenMonitor] 时间序列数据:', data);
    } catch (err) {
      console.error('[TokenMonitor] 刷新时间序列数据失败:', err);
      const errorMessage = err instanceof Error ? err.message : '刷新失败';
      setError(errorMessage);
    } finally {
      setIsLoadingTimeSeries(false);
    }
  }, [connectionStatus]);

  // 刷新所有数据
  const refresh = useCallback(async () => {
    console.log('[TokenMonitor] 刷新所有数据');
    await Promise.all([refreshUsage(), refreshSessions(), refreshTimeSeries()]);
  }, [refreshUsage, refreshSessions, refreshTimeSeries]);

  // 设置时间预设
  const setPeriodPreset = useCallback((preset: PeriodPreset) => {
    console.log('[TokenMonitor] 设置时间预设:', preset);
    setPeriodPresetState(preset);

    const newRange = getDateRangeForPreset(preset);
    setDateRangeState(newRange);

    // 刷新数据
    setTimeout(() => {
      refresh();
    }, 100);
  }, [refresh]);

  // 设置自定义日期范围
  const setDateRange = useCallback((start: Date, end: Date) => {
    console.log('[TokenMonitor] 设置日期范围:', start, end);
    setPeriodPresetState('custom');
    setDateRangeState({ start, end });

    // 刷新数据
    setTimeout(() => {
      refresh();
    }, 100);
  }, [refresh]);

  const value: TokenMonitorState = {
    connectionStatus,
    usageCost,
    sessions,
    timeSeriesData,
    dateRange,
    periodPreset,
    isLoadingUsage,
    isLoadingSessions,
    isLoadingTimeSeries,
    error,
    connect,
    disconnect,
    refresh,
    refreshUsage,
    refreshSessions,
    refreshTimeSeries,
    setPeriodPreset,
    setDateRange
  };

  return <TokenMonitorContext.Provider value={value}>{children}</TokenMonitorContext.Provider>;
};

// Hook to use the Token Monitor context
export const useTokenMonitor = (): TokenMonitorState => {
  const context = useContext(TokenMonitorContext);
  if (context === undefined) {
    throw new Error('useTokenMonitor must be used within a TokenMonitorProvider');
  }
  return context;
};

export default TokenMonitorContext;

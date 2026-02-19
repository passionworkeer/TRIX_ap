/**
 * Token Monitor - OpenClaw-CN Token 使用监控类型定义
 */

// 连接状态
export type GatewayConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'AUTHENTICATED'
  | 'ERROR';

// Gateway API 方法类型
export type GatewayAPIMethod =
  | 'usage.status'
  | 'usage.cost'
  | 'sessions.usage'
  | 'sessions.usage.timeseries'
  | 'sessions.list'
  | 'sessions.usage.logs';

// Gateway API 请求/响应类型
export interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponse {
  type: 'res' | 'error';
  id: string;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface GatewayEvent {
  type: string;
  payload?: unknown;
}

// 认证相关类型
export interface ConnectChallenge {
  type: 'connect.challenge';
  payload: {
    protocolVersion: number;
    serverId: string;
  };
}

export interface AuthParams {
  minProtocol: number;
  maxProtocol: number;
  role: string;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
    instanceId: string;
  };
  auth: {
    token: string;
  };
}

// 使用成本数据
export interface UsageCostData {
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  sessionsCount: number;
  requestsCount: number;
  providers: ProviderUsage[];
  period?: {
    start: string;
    end: string;
  };
}

// 提供商使用统计
export interface ProviderUsage {
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  inputCost: number;
  outputCost: number;
}

// 会话使用数据
export interface SessionUsage {
  sessionId: string;
  sessionKey: string;
  startTime: string;
  endTime?: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  messagesCount: number;
  lastActive?: string;
}

// 会话消息
export interface SessionMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  cost?: number;
}

// 时间序列数据
export interface TimeSeriesData {
  timestamp: string;
  tokens: number;
  cost: number;
  requests: number;
  inputTokens?: number;
  outputTokens?: number;
}

// 使用状态数据
export interface UsageStatus {
  providers: {
    [key: string]: {
      usage: number;
      limit?: number;
      resetAt?: string;
    };
  };
  totalUsage: number;
  totalLimit?: number;
}

// 会话列表项
export interface SessionListItem {
  id: string;
  key: string;
  agentId: string;
  channel: string;
  createdAt: string;
  lastActive?: string;
  messagesCount: number;
  model?: string;
  provider?: string;
}

// 过滤器类型
export interface DateRange {
  start: Date;
  end: Date;
}

export type PeriodPreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'custom';

// 图表数据类型
export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: string;
}

export interface ModelDistribution {
  model: string;
  provider: string;
  tokens: number;
  cost: number;
  requests: number;
  percentage: number;
}

// API 错误类型
export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

// 统计卡片数据
export interface StatsCardData {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

// 连接配置
export interface GatewayConnectionConfig {
  url: string;
  token: string;
  heartbeatInterval?: number;
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectAttempts?: number;
}

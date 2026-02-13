/**
 * Clawbot Gateway 完整类型定义
 *
 * 基于 Clawdbot Gateway 集成指南 v1.0.0
 * 文档日期: 2026年2月11日
 */

// ============================================
// 基础类型
// ============================================

/** 配对码状态 */
export type PairingStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

/** 设备类型 */
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'web';

/** 连接状态 */
export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTH_FAILED' | 'ERROR' | 'RECONNECTING';

/** WebSocket 消息类型 */
export type WebSocketMessageType =
  | 'ping'           // 心跳请求
  | 'pong'           // 心跳响应
  | 'pairing.request'   // 配对请求
  | 'pairing.confirm'   // 配对确认
  | 'pairing.success'   // 配对成功
  | 'message'        // 普通消息
  | 'command'        // 命令消息
  | 'error'          // 错误通知
  | 'connect.challenge' // 连接挑战
  | 'req'            // 请求
  | 'res';           // 响应

/** 消息内容类型 */
export type MessageContentType = 'text' | 'image' | 'video' | 'audio' | 'mixed' | 'command';

// ============================================
// 配对相关类型
// ============================================

/**
 * 二维码数据
 * 扫描二维码后获取的信息
 */
export interface QRCodeData {
  /** Gateway WebSocket URL */
  gatewayUrl: string;
  /** 配对 Token */
  pairingToken: string;
  /** 请求 ID */
  requestId: string;
  /** 过期时间 (ISO 8601) */
  expiresAt: string;
}

/**
 * 配对元数据
 */
export interface PairingMetadata {
  /** 设备名称 */
  deviceName: string;
  /** 设备类型 */
  deviceType: DeviceType;
  /** 设备平台 */
  platform?: string;
  /** 设备用户代理 */
  userAgent?: string;
}

/**
 * 配对请求（手机端 → Gateway）
 */
export interface PairingRequest {
  /** 请求唯一 ID */
  requestId: string;
  /** 设备名称 */
  deviceName: string;
  /** 设备类型 */
  deviceType: DeviceType;
  /** 创建时间戳 */
  timestamp: number;
  /** 当前状态 */
  status: PairingStatus;
  /** 设备 ID */
  deviceId?: string;
  /** 配对 Token */
  device_token?: string;
  /** 附加信息 */
  message?: string;
  /** 元数据 */
  metadata?: PairingMetadata;
}

/**
 * 配对响应（Gateway → 手机端）
 */
export interface PairingResponse {
  /** 请求 ID */
  requestId: string;
  /** 配对状态 */
  status: PairingStatus;
  /** 设备 Token（配对成功后返回） */
  deviceToken?: string;
  /** 节点 ID */
  nodeId?: string;
  /** WebSocket URL（配对成功后返回） */
  wsUrl?: string;
  /** Token 过期时间 */
  expiresAt?: string;
  /** 附加消息 */
  message?: string;
}

/**
 * 配对确认请求（电脑端 → Gateway）
 */
export interface PairingConfirmRequest {
  /** 配对码 */
  code: string;
  /** 是否确认 */
  confirmed: boolean;
  /** 授予的权限 */
  permissions?: ('read' | 'write' | 'execute')[];
}

/**
 * 配对状态查询响应
 */
export interface PairingStatusResponse {
  /** 是否已配对 */
  paired: boolean;
  /** 是否已连接 */
  connected: boolean;
  /** 设备信息 */
  deviceInfo?: {
    deviceId: string;
    deviceName: string;
    pairedAt: string;
  };
}

// ============================================
// WebSocket 通信协议类型
// ============================================

/**
 * WebSocket 连接参数
 */
export interface ConnectParams {
  /** 最小协议版本 */
  minProtocol: number;
  /** 最大协议版本 */
  maxProtocol: number;
  /** 角色 */
  role: 'operator' | 'node' | 'gateway';
  /** 客户端信息 */
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
    instanceId: string;
  };
  /** 能力列表 */
  caps: string[];
  /** 认证信息 */
  auth?: {
    token: string;
  };
}

/**
 * WebSocket 连接请求
 */
export interface ConnectRequest {
  type: 'req';
  id: string;
  method: 'connect';
  params: ConnectParams;
}

/**
 * WebSocket 心跳消息
 */
export interface HeartbeatMessage {
  type: 'ping' | 'pong';
  timestamp: number;
}

/**
 * 媒体文件信息
 */
export interface MediaInfo {
  /** 资源 URI */
  uri: string;
  /** 媒体类型 */
  type: string;
  /** 文件大小 */
  size?: number;
  /** 分类 */
  category?: 'image' | 'video';
  /** 元数据 */
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

/**
 * 消息载荷数据
 */
export interface MessagePayload {
  /** 消息内容 */
  message: string;
  /** 目标 */
  to: string;
  /** 幂等键 */
  idempotencyKey: string;
  /** 媒体信息（可选） */
  media?: MediaInfo;
}

/**
 * WebSocket 消息请求
 */
export interface WebSocketMessageRequest {
  type: 'req';
  id: string;
  method: 'agent' | 'command' | 'message';
  params: MessagePayload;
}

/**
 * 流式响应数据
 */
export interface StreamData {
  /** 流类型 */
  stream: string;
  /** 增量数据 */
  delta?: string;
  /** 完整内容 */
  content?: string;
  /** 是否结束 */
  done?: boolean;
}

/**
 * WebSocket 响应
 */
export interface WebSocketResponse {
  type: 'res';
  id: string;
  payload: {
    type: string;
    stream?: string;
    data?: StreamData;
    message?: string;
  };
}

/**
 * WebSocket 错误消息
 */
export interface WebSocketError {
  type: 'error';
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * 连接挑战消息
 */
export interface ConnectChallenge {
  event: 'connect.challenge';
  payload: {
    nonce: string;
    timestamp: string;
  };
}

/**
 * WebSocket 消息联合体
 */
export type WebSocketMessage =
  | ConnectRequest
  | ConnectChallenge
  | WebSocketMessageRequest
  | WebSocketResponse
  | WebSocketError
  | HeartbeatMessage;

// ============================================
// Gateway 配置类型
// ============================================

/**
 * Gateway SSL 配置
 */
export interface GatewaySSLConfig {
  enabled: boolean;
  cert: string;
  key: string;
  ca?: string;
}

/**
 * WebSocket 心跳配置
 */
export interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
}

/**
 * WebSocket 重连配置
 */
export interface ReconnectConfig {
  maxAttempts: number;
  delay: number;
  exponentialBackoff: boolean;
}

/**
 * WebSocket 配置
 */
export interface WebSocketConfig {
  path: string;
  heartbeat: HeartbeatConfig;
  reconnect: ReconnectConfig;
}

/**
 * 配对配置
 */
export interface PairingConfig {
  codeLength: number;
  codeTTL: number;
  qrCodeSize: number;
  maxPending: number;
  confirmTimeout: number;
}

/**
 * 节点配置
 */
export interface NodeConfig {
  maxConnections: number;
  timeout: number;
  pingInterval: number;
  authRequired: boolean;
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  port: number;
  host: string;
  secret: string;
  ssl: GatewaySSLConfig;
  websocket: WebSocketConfig;
  pairing: PairingConfig;
  nodes: NodeConfig;
}

// ============================================
// 业务数据类型
// ============================================

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息 ID */
  id: string;
  /** 发送者 */
  sender: 'user' | 'bot' | 'friend';
  /** 消息文本 */
  text: string;
  /** 时间戳 */
  timestamp: string;
  /** 消息类型 */
  messageType?: MessageContentType;
  /** 媒体 URI */
  mediaUri?: string;
  /** 媒体类型 */
  mediaType?: string;
  /** 媒体元数据 */
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

/**
 * Bot 消息流状态
 */
export interface BotMessageStream {
  /** 流 ID */
  streamId: string;
  /** 完整响应内容 */
  content: string;
  /** 是否接收中 */
  isReceiving: boolean;
  /** 开始时间 */
  startTime: number;
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/**
 * Clawbot 连接上下文
 */
export interface ClawbotConnectionContext {
  /** 连接状态 */
  status: ConnectionStatus;
  /** 当前流 ID */
  currentStreamId: string | null;
  /** Bot 完整回复 */
  fullResponse: string;
  /** 是否已连接 */
  isConnected: boolean;
  /** 连接 */
  connect: () => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 发送消息 */
  sendMessage: (text: string, media?: MediaInfo) => void;
}

/**
 * 配对上下文
 */
export interface PairingContext {
  /** 是否正在配对 */
  isPairing: boolean;
  /** 当前配对请求 */
  pairingRequest: PairingRequest | null;
  /** 配对状态 */
  pairingStatus: PairingStatus | null;
  /** 设备 Token */
  deviceToken: string | null;
  /** 错误信息 */
  errorMessage: string | null;
  /** 二维码内容 */
  qrCodeContent: string | null;
  /** 开始配对 */
  startPairing: (deviceName?: string) => Promise<void>;
  /** 取消配对 */
  cancelPairing: () => Promise<void>;
  /** 重置配对 */
  resetPairing: () => void;
}

// ============================================
// API 响应类型
// ============================================

/**
 * REST API 通用响应
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 健康检查响应
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
}

/**
 * 监控指标响应
 */
export interface MetricsResponse {
  connections: {
    total: number;
    active: number;
  };
  pairing: {
    pending: number;
    completed: number;
    failed: number;
  };
  messages: {
    sent: number;
    received: number;
  };
}

// ============================================
// 常量定义
// ============================================

/** 配对超时时间（毫秒） */
export const PAIRING_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/** 配对确认超时时间（毫秒） */
export const PAIRING_CONFIRM_TIMEOUT_MS = 2 * 60 * 1000; // 2 分钟

/** Token 有效期（毫秒） */
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 小时

/** 心跳间隔（毫秒） */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 秒

/** 重连初始延迟（毫秒） */
export const RECONNECT_INITIAL_DELAY_MS = 2 * 1000; // 2 秒

/** 重连最大延迟（毫秒） */
export const RECONNECT_MAX_DELAY_MS = 60 * 1000; // 60 秒

/** 重连退避因子 */
export const RECONNECT_BACKOFF_FACTOR = 1.5; // 指数退避因子

/** 最大重连次数（设置为较大值以支持长期重连） */
export const MAX_RECONNECT_ATTEMPTS = 100; // 100 次（实际相当于无限重连）

/** 二维码默认大小 */
export const DEFAULT_QR_SIZE = 10;

/** 配对码默认长度 */
export const DEFAULT_PAIRING_CODE_LENGTH = 6;

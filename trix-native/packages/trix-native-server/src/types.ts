// ============================================
// 类型定义 - TRIX Native Server
// ============================================

// -------------------- 配对相关 --------------------

export interface Pairing {
  id: string;
  code: string;
  status: PairingStatus;
  devicePublicKey?: string;
  deviceId?: string;
  deviceName?: string;
  pluginToken?: string;
  refreshToken?: string;
  createdAt: Date;
  expiresAt: Date;
  pairedAt?: Date;
}

export type PairingStatus = 'waiting' | 'phone_connected' | 'paired' | 'expired';

export interface PairingCreateRequest {
  devicePublicKey?: string;
  label?: string;
}

export interface PairingCreateResponse {
  success: true;
  code: string;
  qrDataUrl: string;
  expiresIn: number;
  createdAt: string;
}

export interface PairingStatusResponse {
  success: true;
  code: string;
  status: PairingStatus;
  deviceId?: string;
  createdAt: string;
  pairedAt?: string;
}

export interface PairingClaimRequest {
  deviceId: string;
  deviceName: string;
  publicKey?: string;
}

export interface PairingClaimResponse {
  success: true;
  conversationId: string;
  clientToken: string;
  websocketUrl: string;
  pairing: {
    code: string;
  };
  agentOnline?: boolean;
  deviceId: string;
  expiresIn: number;
}

// -------------------- 消息相关 --------------------

export interface Message {
  id: string;
  conversationId: string;
  from: 'phone' | 'agent';
  text?: string;
  attachments?: Attachment[];
  timestamp: Date;
  delivered?: boolean;
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface FromPluginRequest {
  conversationId: string;
  text?: string;
  attachments?: Attachment[];
}

export interface FromPluginResponse {
  success: true;
  messageId: string;
}

export interface ToPluginQuery {
  conversationId: string;
  lastMessageId?: string;
}

export interface ToPluginResponse {
  success: true;
  messages: Message[];
  hasMore: boolean;
}

// -------------------- 设备相关 --------------------

export interface Device {
  id: string;
  name: string;
  type: 'phone' | 'plugin';
  status: DeviceStatus;
  lastSeen: Date;
  createdAt: Date;
}

export type DeviceStatus = 'active' | 'inactive' | 'blocked';

export interface DeviceStatusResponse {
  success: true;
  deviceId: string;
  status: DeviceStatus;
  lastSeen: string;
}

// -------------------- 文件上传相关 --------------------

export interface UploadRequest {
  file: Express.Multer.File;
  type: 'image' | 'audio' | 'video' | 'file';
  conversationId?: string;
}

export interface UploadResponse {
  success: true;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

// -------------------- WebSocket 消息 --------------------

export interface WSPhoneMessage {
  type: 'message' | 'ping' | 'pong';
  id?: string;
  conversationId?: string;
  text?: string;
  attachments?: Attachment[];
}

export interface WSPhoneConnect {
  type: 'connect';
  code: string;
}

export interface WSPluginMessage {
  type: 'message' | 'ping' | 'pong' | 'ack';
  messageIds?: string[];
  conversationId?: string;
  text?: string;
  attachments?: Attachment[];
}

// -------------------- 错误码 --------------------

export const ErrorCodes = {
  // 配对相关
  PAIRING_NOT_FOUND: 'PAIRING_NOT_FOUND',
  PAIRING_EXPIRED: 'PAIRING_EXPIRED',
  PAIRING_ALREADY_USED: 'PAIRING_ALREADY_USED',

  // 认证相关
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',

  // 消息相关
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  CLIENT_NOT_CONNECTED: 'CLIENT_NOT_CONNECTED',

  // 文件相关
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED'
} as const;

// -------------------- 配置 --------------------

export interface ServerConfig {
  port: number;
  host: string;
  uploadDir: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  pairingCodeLength: number;
  pairingExpiresIn: number;
  pairingCodeChars: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  redisUrl?: string;
}

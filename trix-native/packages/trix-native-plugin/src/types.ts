// ============================================
// 类型定义 - TRIX Native Plugin
// ============================================

// -------------------- 配置相关 --------------------

export interface TrixNativeConfig {
  accountId: string;
  name: string;
  serverUrl: string;
}

export interface PluginCredentials {
  version: string;
  accountId: string;
  serverUrl: string;
  deviceId: string;
  pluginToken: string;
  refreshToken: string;
  keyPair?: {
    publicKey: string;
    encryptedPrivateKey: string;
  };
  pairedAt: string;
  expiresAt: string;
}

// -------------------- 消息相关 --------------------

export interface TrixMessage {
  id: string;
  conversationId: string;
  from: 'phone' | 'agent';
  timestamp: string;
  text?: string;
  attachments?: Attachment[];
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

// -------------------- API 请求/响应 --------------------

export interface CreatePairingResponse {
  success: true;
  code: string;
  qrDataUrl: string;
  expiresIn: number;
}

export interface PairingStatusResponse {
  success: true;
  code: string;
  status: 'waiting' | 'phone_connected' | 'paired' | 'expired';
  deviceId?: string;
}

export interface ClaimPairingResponse {
  success: true;
  deviceId: string;
  pluginToken: string;
  refreshToken: string;
  serverUrl: string;
  expiresIn: number;
}

export interface SendToPhoneRequest {
  conversationId: string;
  text?: string;
  attachments?: Attachment[];
}

export interface SendToPhoneResponse {
  success: true;
  messageId: string;
}

export interface GetMessagesResponse {
  success: true;
  messages: TrixMessage[];
  hasMore: boolean;
}

export interface UploadResponse {
  success: true;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

// -------------------- OpenClaw Channel 接口 --------------------

export interface ChannelContext {
  account: TrixNativeConfig;
  credentials?: PluginCredentials;
  conversation: {
    id: string;
  };
  api: any; // OpenClaw API
}

export interface OutboundMessage {
  text?: string;
  attachments?: Attachment[];
}

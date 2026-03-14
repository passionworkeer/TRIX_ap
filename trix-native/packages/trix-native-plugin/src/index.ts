// ============================================
// TRIX Native Plugin 入口
// ============================================

export { default } from './channel.js';
export { trixNativeChannel } from './channel.js';

// 导出类型
export type {
  TrixNativeConfig,
  PluginCredentials,
  TrixMessage,
  Attachment,
  CreatePairingResponse,
  PairingStatusResponse,
  ClaimPairingResponse,
  SendToPhoneRequest,
  SendToPhoneResponse,
  GetMessagesResponse,
  UploadResponse,
  ChannelContext,
  OutboundMessage
} from './types.js';

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface AttachmentDescriptor {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  publicUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  createdAt: number;
}

export interface AttachmentInput {
  kind?: AttachmentKind;
  mimeType?: string;
  fileName?: string;
  contentBase64?: string;
  localPath?: string;
  url?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface PairingRecord {
  code: string;
  secret: string;
  label?: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'paired' | 'expired';
  conversationId: string;
  claimUrl: string;
  qrDataUrl?: string;
  pairedAt?: number;
  pairedClientId?: string;
  pairedDeviceName?: string;
  clientToken?: string;
}

export interface ConversationRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  pairingCode: string;
  openClawSessionKey?: string;
  participants: Array<{
    clientId: string;
    deviceName?: string;
    role: 'user' | 'agent';
    clientToken?: string;
    connectedAt?: number;
    lastSeenAt?: number;
  }>;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound' | 'system';
  text: string;
  attachments: AttachmentDescriptor[];
  senderId: string;
  senderName?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface NativeChannelState {
  adminToken: string;
  pairings: PairingRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  uploads: AttachmentDescriptor[];
}

export interface PairingCreateInput {
  label?: string;
  ttlMs?: number;
  publicBaseUrl: string;
  openClawSessionKey?: string;
}

export interface PairingClaimInput {
  code: string;
  secret?: string;
  clientId: string;
  deviceName?: string;
}

export interface ServerConfig {
  host?: string;
  port?: number;
  storageDir?: string;
  publicBaseUrl?: string;
  adminToken?: string;
  uploadBaseUrl?: string;
}

export interface ClientEnvelope<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface PairingCreatedResponse extends PairingRecord {
  websocketUrl: string;
}

export interface PairingClaimResponse {
  conversationId: string;
  clientToken: string;
  websocketUrl: string;
  serverUrl?: string;
  pairing: PairingRecord;
  agentOnline?: boolean;
}

export interface CreateMessageInput {
  conversationId: string;
  clientToken?: string;
  text?: string;
  senderId: string;
  senderName?: string;
  direction: 'inbound' | 'outbound' | 'system';
  attachments?: AttachmentInput[];
  uploadedAttachmentIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface UploadResponse {
  attachment: AttachmentDescriptor;
}

export interface PluginAccountConfig {
  accountId: string;
  enabled: boolean;
  name: string;
  serverUrl: string;
  publicBaseUrl?: string;
  adminToken: string;
  storageDir?: string;
}

export interface ResolvedPluginAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name: string;
  serverUrl: string;
  publicBaseUrl?: string;
  adminToken?: string;
  storageDir: string;
}

export interface OutboundReplyPayloadLike {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  replyToId?: string;
}

export interface StoredAttachmentForOpenClaw {
  descriptor: AttachmentDescriptor;
  contentBase64: string;
}

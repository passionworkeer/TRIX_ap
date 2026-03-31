export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface AttachmentDescriptor {
  id: string;
  accountId?: string;
  conversationId?: string;
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
  accountId?: string;
  conversationId?: string;
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
  accountId: string;
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
  peerId?: string;
  clientToken?: string;
}

export interface ConversationParticipant {
  clientId: string;
  peerId: string;
  deviceName?: string;
  role: 'user' | 'service';
  clientToken?: string;
  connectedAt?: number;
  lastSeenAt?: number;
}

export interface ConversationRecord {
  id: string;
  accountId: string;
  peerId: string;
  appUserId?: string;
  peerDisplayName?: string;
  createdAt: number;
  updatedAt: number;
  pairingCode: string;
  openClawSessionKey?: string;
  participants: ConversationParticipant[];
}

export interface MessageRecord {
  id: string;
  accountId: string;
  conversationId: string;
  direction: 'inbound' | 'outbound' | 'system';
  text: string;
  attachments: AttachmentDescriptor[];
  senderId: string;
  senderName?: string;
  createdAt: number;
  replyToMessageId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NativeChannelState {
  adminToken: string;
  serviceTokens: Record<string, string>;
  attachmentSigningSecret: string;
  pairings: PairingRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  uploads: AttachmentDescriptor[];
  studyRooms: StudyRoom[];
}

export interface PairingCreateInput {
  accountId?: string;
  label?: string;
  ttlMs?: number;
  publicBaseUrl: string;
  openClawSessionKey?: string;
}

export interface PairingClaimInput {
  code: string;
  accountId?: string;
  secret?: string;
  clientId: string;
  deviceName?: string;
  appUserId?: string;
}

export interface ServerConfig {
  host?: string;
  port?: number;
  storageDir?: string;
  publicBaseUrl?: string;
  adminToken?: string;
  serviceToken?: string;
  attachmentSigningSecret?: string;
  enableLegacyAgentWs?: boolean;
  uploadBaseUrl?: string;
  serviceAllowlist?: string[];
  trustedProxyAllowlist?: string[];
  rateLimits?: Partial<Record<ServerRateLimitName, ServerRateLimitRule>>;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  ttsEnabled?: boolean;
  ttsBaseUrl?: string;
  ttsAppKey?: string;
  ttsToken?: string;
  ttsSpeaker?: string;
  ttsSampleRate?: number;
  ttsTimeoutMs?: number;
  ttsMaxTextLength?: number;
  ttsSynthesizer?: (request: TtsSynthesisRequest) => Promise<TtsSynthesisResult>;
}

export type TtsScene = 'welcome' | 'status' | 'bot_reply';

export interface TtsSynthesisRequest {
  text: string;
  scene: TtsScene;
  messageId?: string;
  userId?: string;
}

export interface TtsSynthesisResult {
  buffer: Buffer;
  contentType: string;
}

export type ServerRateLimitName =
  | 'claim'
  | 'userMessages'
  | 'userUploads'
  | 'serviceMessages'
  | 'serviceUploads';

export interface ServerRateLimitRule {
  max: number;
  windowMs: number;
}

export interface ClientEnvelope<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface PairingCreatedResponse extends PairingRecord {
  websocketUrl: string;
}

export interface PairingClaimResponse {
  accountId: string;
  conversationId: string;
  clientToken: string;
  peerId: string;
  websocketUrl: string;
  wsUrl: string;
  uploadUrl: string;
  messagesUrl: string;
  serverUrl?: string;
  pairing: PairingRecord;
  agentOnline?: boolean;
}

export interface UserCreateMessageInput {
  conversationId: string;
  clientToken: string;
  text?: string;
  localId?: string;
  replyToMessageId?: string | null;
  attachments?: AttachmentInput[];
  uploadedAttachmentIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ServiceMessagePayload {
  idempotencyKey?: string;
  text?: string;
  replyToMessageId?: string | null;
  attachments?: AttachmentInput[];
}

export interface ServiceCreateMessageInput {
  accountId?: string;
  conversationId: string;
  message: ServiceMessagePayload;
}

export interface CreateMessageInput {
  accountId?: string;
  conversationId: string;
  clientToken?: string;
  text?: string;
  senderId: string;
  senderName?: string;
  direction: 'inbound' | 'outbound' | 'system';
  replyToMessageId?: string | null;
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
  serviceUrl?: string;
  serverUrl?: string;
  publicBaseUrl?: string;
  adminToken?: string;
  serviceToken?: string;
  transport?: 'ws' | 'http';
  storageDir?: string;
}

export interface ResolvedPluginAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name: string;
  serviceUrl: string;
  publicBaseUrl?: string;
  adminToken?: string;
  serviceToken?: string;
  transport: 'ws' | 'http';
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

// ============================================================
// Study Room Types
// ============================================================

export type StudyRoomSessionState = 'idle' | 'focusing' | 'resting';
export type StudyRoomMemberStatus = 'online' | 'focusing' | 'resting';
export type StudyRoomHostAction = 'start_focus' | 'pause' | 'end';

export interface StudyRoomMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: number;
  lastActiveAt: number;
  status: StudyRoomMemberStatus;
}

export interface StudyRoomTimerState {
  durationSeconds: number;
  startedAt: number;
  endsAt: number;
  remainingSeconds: number;
}

export interface StudyRoom {
  roomCode: string;
  hostUserId: string;
  sessionState: StudyRoomSessionState;
  members: StudyRoomMember[];
  maxMembers: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  timer: StudyRoomTimerState | null;
}

export interface StudyRoomStateEvent {
  roomCode: string;
  reason: string;
  room: StudyRoom | null;
  serverTs: number;
}

export interface StudyRoomAckPayload {
  success: boolean;
  code?: string;
  error?: string;
  roomCode?: string;
  room?: StudyRoom | null;
}

export interface CreateStudyRoomInput {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  maxMembers?: number;
}

export interface JoinStudyRoomInput {
  userId: string;
  roomCode: string;
  displayName: string;
  avatarUrl?: string;
}

export interface LeaveStudyRoomInput {
  userId: string;
  roomCode?: string;
}

export interface StudyRoomHostActionInput {
  userId: string;
  roomCode: string;
  action: StudyRoomHostAction;
}

export interface StudyRoomState {
  rooms: StudyRoom[];
}

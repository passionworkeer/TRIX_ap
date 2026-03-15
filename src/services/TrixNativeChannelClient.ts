import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import {
  logger,
} from '../utils/logger';
import type {
  ClawbotChannelAttachment,
  ClawbotChannelMessage,
  ErrorPayload,
} from './ClawbotChannelBridge';

export interface NativeUploadAttachment {
  attachmentId: string;
  url: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  mimeType: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface NativeMessageAttachmentInput {
  uploadId?: string;
  kind?: 'image' | 'audio' | 'video' | 'file';
  url?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

type NativeSocketEvents = {
  connecting: void;
  connected: { agentOnline: boolean };
  disconnected: void;
  reconnecting: { attempt: number };
  pairing_success: { deviceId: string; deviceName: string };
  unpaired: void;
  bot_online: { deviceId: string; message: string; timestamp: number };
  bot_offline: { deviceId: string; message: string; timestamp: number };
  message: ClawbotChannelMessage;
  error: ErrorPayload;
  history: ClawbotChannelMessage[];
};

type NativeSocketEventName = keyof NativeSocketEvents;
type NativeSocketEventPayload<TEvent extends NativeSocketEventName> = NativeSocketEvents[TEvent];
type EventCallback<TPayload> = (payload: TPayload) => void;

type StoredSession = {
  serverUrl: string;
  websocketUrl: string;
  conversationId: string;
  clientToken: string;
  clientId: string;
  deviceName?: string;
  pairingCode?: string;
};

type ConversationMessagesResponse = {
  messages: Array<{
    id: string;
    conversationId: string;
    direction: 'inbound' | 'outbound' | 'system';
    text: string;
    attachments: Array<{
      id: string;
      kind: 'image' | 'audio' | 'video' | 'file';
      mimeType: string;
      fileName: string;
      sizeBytes: number;
      publicUrl?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    }>;
    senderId: string;
    senderName?: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
  }>;
  agentOnline?: boolean;
};

type ClaimResponse = {
  conversationId: string;
  clientToken: string;
  websocketUrl: string;
  pairing: {
    code: string;
  };
  agentOnline?: boolean;
};

type UploadResponse = {
  attachment: {
    id: string;
    kind: 'image' | 'audio' | 'video' | 'file';
    mimeType: string;
    fileName: string;
    sizeBytes: number;
    publicUrl?: string;
    width?: number;
    height?: number;
    durationMs?: number;
  };
};

const STORAGE_KEYS = {
  session: 'trix_native_channel_session',
  clientId: 'trix_native_channel_client_id',
} as const;

function generateSecureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/$/, '');
}

function toWebSocketUrl(serverUrl: string): string {
  const normalized = normalizeServerUrl(serverUrl);
  if (/^wss?:\/\//i.test(normalized)) {
    return `${normalized.replace(/\/$/, '')}/ws`;
  }
  return `${normalized.replace(/^http/i, 'ws')}/ws`;
}

function defaultDeviceName(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'Browser' : 'Browser';
  return `TRIX-${platform}`;
}

function inferAttachmentKind(mimeType: string | undefined, fileName: string | undefined): NativeUploadAttachment['kind'] {
  const mime = String(mimeType || '').toLowerCase();
  const extension = String(fileName || '').split('.').pop()?.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(String(extension))) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac', 'webm'].includes(String(extension))) return 'audio';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(String(extension))) return 'video';
  return 'file';
}

function deriveContentType(text: string, attachments: ClawbotChannelAttachment[]): ClawbotChannelMessage['contentType'] {
  if (attachments.length === 0) {
    return 'text';
  }
  if (attachments.length > 1 || text.trim().length > 0) {
    return 'mixed';
  }
  const attachment = attachments[0];
  if (!attachment) {
    return 'text';
  }
  if (attachment.kind === 'audio') {
    return 'voice';
  }
  return attachment.kind;
}

function toMediaMetadata(attachments: ClawbotChannelAttachment[]): ClawbotChannelMessage['mediaMetadata'] | undefined {
  const [attachment] = attachments;
  if (!attachment) {
    return undefined;
  }

  return {
    width: attachment.width,
    height: attachment.height,
    duration: attachment.duration,
    originalName: attachment.fileName,
    size: attachment.size,
  };
}

function mapAttachments(rawAttachments: ConversationMessagesResponse['messages'][number]['attachments']): ClawbotChannelAttachment[] {
  return rawAttachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    url: attachment.publicUrl || '',
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    size: attachment.sizeBytes,
    width: attachment.width,
    height: attachment.height,
    duration: attachment.durationMs,
  }));
}

function mapServerMessage(rawMessage: ConversationMessagesResponse['messages'][number]): ClawbotChannelMessage {
  const attachments = mapAttachments(rawMessage.attachments);
  const primaryAttachment = attachments[0];
  return {
    id: rawMessage.id,
    content: rawMessage.text,
    contentType: deriveContentType(rawMessage.text, attachments),
    mediaUrl: primaryAttachment?.url,
    mediaMimeType: primaryAttachment?.mimeType,
    mediaMetadata: toMediaMetadata(attachments),
    attachments,
    metadata: rawMessage.metadata,
    timestamp: rawMessage.createdAt,
    sender: rawMessage.direction === 'outbound' ? 'bot' : 'user',
  };
}

function parseQrOrClaimPayload(rawInput: string): { serverUrl?: string; code: string; secret?: string } {
  const raw = rawInput.trim();

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.claimUrl === 'string') {
      return parseQrOrClaimPayload(parsed.claimUrl);
    }
    if (typeof parsed.url === 'string') {
      return parseQrOrClaimPayload(parsed.url);
    }
    if (typeof parsed.code === 'string') {
      return {
        serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : undefined,
        code: parsed.code.trim().toUpperCase(),
        secret: typeof parsed.secret === 'string' ? parsed.secret.trim() : undefined,
      };
    }
  } catch {
    // Ignore JSON parse failure.
  }

  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('二维码缺少配对码');
    }
    return {
      serverUrl: `${url.protocol}//${url.host}`,
      code: code.trim().toUpperCase(),
      secret: url.searchParams.get('secret')?.trim(),
    };
  }

  const compact = raw.replace(/[^a-zA-Z0-9:|_-]/g, '');
  if (compact.includes(':')) {
    const [code, secret] = compact.split(':');
    if (code) {
      return { code: code.trim().toUpperCase(), secret: secret?.trim() };
    }
  }

  const normalizedCode = compact.toUpperCase();
  if (/^[A-Z0-9]{6,8}$/.test(normalizedCode)) {
    return { code: normalizedCode };
  }

  throw new Error('无法解析配对二维码或配对链接');
}

class TrixNativeChannelClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<EventCallback<unknown>>>();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private agentOnline = false;

  on<TEvent extends NativeSocketEventName>(event: TEvent, callback: EventCallback<NativeSocketEventPayload<TEvent>>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as EventCallback<unknown>);
  }

  off<TEvent extends NativeSocketEventName>(event: TEvent, callback: EventCallback<NativeSocketEventPayload<TEvent>>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  private emit<TEvent extends NativeSocketEventName>(event: TEvent, payload: NativeSocketEventPayload<TEvent>): void {
    const callbacks = this.listeners.get(event);
    callbacks?.forEach((callback) => {
      try {
        callback(payload as never);
      } catch (error) {
        logger.clawbot.error(`[TrixNative] event listener failed (${event})`, error);
      }
    });
  }

  getOrCreateClientId(): string {
    const stored = localStorage.getItem(STORAGE_KEYS.clientId);
    if (stored?.trim()) {
      return stored;
    }
    const next = `web_${generateSecureRandomString(18)}`;
    localStorage.setItem(STORAGE_KEYS.clientId, next);
    return next;
  }

  getSession(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (!parsed.serverUrl || !parsed.conversationId || !parsed.clientToken || !parsed.clientId) {
        return null;
      }
      return {
        serverUrl: normalizeServerUrl(parsed.serverUrl),
        websocketUrl: parsed.websocketUrl ? normalizeServerUrl(parsed.websocketUrl) : toWebSocketUrl(parsed.serverUrl),
        conversationId: parsed.conversationId,
        clientToken: parsed.clientToken,
        clientId: parsed.clientId,
        deviceName: parsed.deviceName,
        pairingCode: parsed.pairingCode,
      };
    } catch {
      return null;
    }
  }

  private saveSession(session: StoredSession): void {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  isPaired(): boolean {
    return Boolean(this.getSession());
  }

  async connect(): Promise<void> {
    const session = this.getSession();
    if (!session) {
      this.emit('disconnected', undefined);
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualDisconnect = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.emit('connecting', undefined);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(
        `${session.websocketUrl}?role=user&conversationId=${encodeURIComponent(session.conversationId)}&clientId=${encodeURIComponent(session.clientId)}&clientToken=${encodeURIComponent(session.clientToken)}`,
      );
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      socket.onerror = () => {
        reject(new Error('无法连接到 TRIX Native Channel 服务器'));
      };

      socket.onclose = () => {
        this.socket = null;
        this.emit('disconnected', undefined);
        if (!this.manualDisconnect && this.getSession()) {
          this.reconnectAttempts += 1;
          this.emit('reconnecting', { attempt: this.reconnectAttempts });
          this.reconnectTimer = window.setTimeout(() => {
            void this.connect().catch((error: unknown) => {
              this.emit('error', { message: error instanceof Error ? error.message : '重连失败' });
            });
          }, Math.min(5000, 1000 * this.reconnectAttempts));
        }
      };

      socket.onmessage = (event) => {
        this.handleSocketMessage(event.data);
      };
    });

    try {
      const history = await this.fetchHistory();
      this.emit('history', history);
    } catch (error) {
      this.emit('error', {
        message: error instanceof Error ? error.message : '加载消息历史失败',
      });
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  async pairWithCode(code: string, deviceName: string = defaultDeviceName()): Promise<{ success: boolean }> {
    const endpoints = getClawbotEndpoints();
    const session = this.getSession();
    const serverUrl = normalizeServerUrl(session?.serverUrl || endpoints.nativeServerUrl);
    if (!serverUrl) {
      throw new Error('鏈厤缃?TRIX Native Server 鍦板潃锛岃鍏堣缃?VITE_TRIX_NATIVE_SERVER_URL');
    }

    const clientId = this.getOrCreateClientId();
    const response = await fetch(`${serverUrl}/api/pairings/${encodeURIComponent(code)}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        deviceName,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '配对失败' }));
      throw new Error(typeof payload.error === 'string' ? payload.error : '配对失败');
    }

    const claim = await response.json() as ClaimResponse;
    this.saveSession({
      serverUrl,
      websocketUrl: claim.websocketUrl,
      conversationId: claim.conversationId,
      clientToken: claim.clientToken,
      clientId,
      deviceName,
      pairingCode: claim.pairing.code,
    });
    this.emit('pairing_success', { deviceId: clientId, deviceName });
    this.agentOnline = Boolean(claim.agentOnline);
    await this.connect();
    return { success: true };
  }

  async pairWithQR(rawPayload: string, deviceName: string = defaultDeviceName()): Promise<{ success: boolean }> {
    const parsed = parseQrOrClaimPayload(rawPayload);
    const serverUrl = normalizeServerUrl(parsed.serverUrl || getClawbotEndpoints().nativeServerUrl || this.getSession()?.serverUrl || '');
    if (!serverUrl) {
      throw new Error('二维码没有包含服务器地址，且当前环境未配置 VITE_TRIX_NATIVE_SERVER_URL');
    }

    const clientId = this.getOrCreateClientId();
    const response = await fetch(`${serverUrl}/api/pairings/${encodeURIComponent(parsed.code)}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        deviceName,
        secret: parsed.secret,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '二维码配对失败' }));
      throw new Error(typeof payload.error === 'string' ? payload.error : '二维码配对失败');
    }

    const claim = await response.json() as ClaimResponse;
    this.saveSession({
      serverUrl,
      websocketUrl: claim.websocketUrl,
      conversationId: claim.conversationId,
      clientToken: claim.clientToken,
      clientId,
      deviceName,
      pairingCode: claim.pairing.code,
    });
    this.emit('pairing_success', { deviceId: clientId, deviceName });
    this.agentOnline = Boolean(claim.agentOnline);
    await this.connect();
    return { success: true };
  }

  async checkPairingStatus(): Promise<{ paired: boolean; deviceId?: string; botOnline: boolean }> {
    const session = this.getSession();
    return {
      paired: Boolean(session),
      deviceId: session?.clientId,
      botOnline: this.agentOnline,
    };
  }

  async fetchHistory(): Promise<ClawbotChannelMessage[]> {
    const session = this.requireSession();
    const response = await fetch(`${session.serverUrl}/api/conversations/${encodeURIComponent(session.conversationId)}/messages`, {
      headers: {
        'x-trix-client-token': session.clientToken,
      },
    });
    if (!response.ok) {
      throw new Error('加载消息历史失败');
    }
    const payload = await response.json() as ConversationMessagesResponse;
    this.agentOnline = Boolean(payload.agentOnline);
    return payload.messages.map((message) => mapServerMessage(message));
  }

  async uploadAttachment(file: File | Blob, options: { fileName?: string; kind?: NativeUploadAttachment['kind'] } = {}): Promise<NativeUploadAttachment> {
    const session = this.requireSession();
    const serverUrl = normalizeServerUrl(session.serverUrl);
    if (!serverUrl) {
      throw new Error('未配置 TRIX Native Server 地址');
    }

    const derivedFileName = options.fileName || (file instanceof File ? file.name : `attachment-${Date.now()}`);
    const mimeType = file.type || 'application/octet-stream';
    const kind = options.kind || inferAttachmentKind(mimeType, derivedFileName);

    const response = await fetch(`${serverUrl}/api/uploads`, {
      method: 'POST',
      headers: {
        'x-file-name': encodeURIComponent(derivedFileName),
        'x-mime-type': mimeType,
        'x-attachment-kind': kind,
        'x-trix-conversation-id': session.conversationId,
        'x-trix-client-token': session.clientToken,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error('上传附件失败');
    }

    const payload = await response.json() as UploadResponse;
    return {
      attachmentId: payload.attachment.id,
      url: payload.attachment.publicUrl || '',
      kind: payload.attachment.kind,
      mimeType: payload.attachment.mimeType,
      fileName: payload.attachment.fileName,
      size: payload.attachment.sizeBytes,
      width: payload.attachment.width,
      height: payload.attachment.height,
      duration: payload.attachment.durationMs,
    };
  }

  async uploadMedia(file: File | Blob): Promise<string> {
    const attachment = await this.uploadAttachment(file);
    return attachment.url;
  }

  async sendMessage(params: {
    text: string;
    contentType?: ClawbotChannelMessage['contentType'];
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaMetadata?: ClawbotChannelMessage['mediaMetadata'];
    attachments?: NativeMessageAttachmentInput[];
    clientMessageId?: string;
  }): Promise<string> {
    const session = this.requireSession();
    if (!this.isConnected()) {
      await this.connect();
    }

    const uploadedAttachmentIds: string[] = [];
    const inlineAttachments: Array<{
      kind?: NativeUploadAttachment['kind'];
      url?: string;
      mimeType?: string;
      fileName?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    }> = [];

    const normalizedAttachments = params.attachments?.length
      ? params.attachments
      : params.mediaUrl
        ? [
            {
              url: params.mediaUrl,
              mimeType: params.mediaMimeType,
              kind: inferAttachmentKind(params.mediaMimeType, params.mediaMetadata?.originalName as string | undefined),
              fileName: params.mediaMetadata?.originalName as string | undefined,
              width: params.mediaMetadata?.width,
              height: params.mediaMetadata?.height,
              duration: typeof params.mediaMetadata?.duration === 'number' ? params.mediaMetadata.duration : undefined,
            },
          ]
        : [];

    for (const attachment of normalizedAttachments) {
      if (attachment.uploadId) {
        uploadedAttachmentIds.push(attachment.uploadId);
        continue;
      }

      inlineAttachments.push({
        kind: attachment.kind,
        url: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        width: attachment.width,
        height: attachment.height,
        durationMs: attachment.duration,
      });
    }

    const clientMessageId = params.clientMessageId || `msg_${generateSecureRandomString(18)}`;
    const response = await fetch(`${session.serverUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: session.conversationId,
        clientToken: session.clientToken,
        direction: 'inbound',
        senderId: session.clientId,
        senderName: session.deviceName || defaultDeviceName(),
        text: params.text,
        attachments: inlineAttachments,
        uploadedAttachmentIds,
        metadata: {
          clientMessageId,
          declaredContentType: params.contentType,
        },
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '发送消息失败' }));
      throw new Error(typeof payload.error === 'string' ? payload.error : '发送消息失败');
    }

    return clientMessageId;
  }

  unpair(): void {
    this.disconnect();
    this.clearSession();
    this.agentOnline = false;
    this.emit('unpaired', undefined);
  }

  private requireSession(): StoredSession {
    const session = this.getSession();
    if (!session) {
      throw new Error('当前设备尚未配对');
    }
    return session;
  }

  private handleSocketMessage(rawData: string): void {
    try {
      const envelope = JSON.parse(rawData) as {
        type: string;
        payload?: unknown;
      };

      if (envelope.type === 'connected') {
        const payload = envelope.payload as { agentOnline?: boolean } | undefined;
        this.agentOnline = Boolean(payload?.agentOnline);
        this.emit('connected', { agentOnline: this.agentOnline });
        if (this.agentOnline) {
          this.emit('bot_online', {
            deviceId: 'openclaw',
            message: 'OpenClaw 已连接',
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (envelope.type === 'agent.status') {
        const payload = envelope.payload as { online?: boolean } | undefined;
        const isOnline = Boolean(payload?.online);
        this.agentOnline = isOnline;
        if (isOnline) {
          this.emit('bot_online', {
            deviceId: 'openclaw',
            message: 'OpenClaw 已连接',
            timestamp: Date.now(),
          });
        } else {
          this.emit('bot_offline', {
            deviceId: 'openclaw',
            message: 'OpenClaw 当前离线',
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (envelope.type === 'message.created') {
        const payload = envelope.payload as { message?: ConversationMessagesResponse['messages'][number] } | undefined;
        if (!payload?.message) {
          return;
        }
        this.emit('message', mapServerMessage(payload.message));
      }
    } catch (error) {
      this.emit('error', {
        message: error instanceof Error ? error.message : '解析服务器消息失败',
      });
    }
  }
}

const trixNativeChannelClient = new TrixNativeChannelClient();

export default trixNativeChannelClient;



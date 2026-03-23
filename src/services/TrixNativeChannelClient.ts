import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { supabase } from '../config/supabase';
import {
  logger,
} from '../utils/logger';
import type {
  ClawbotChannelAttachment,
  ClawbotChannelMessage,
  ErrorPayload,
} from '../types/clawbotChannel';
import type {
  FriendRoomLookupResult,
  StudyRoomAckPayload,
  StudyRoomHostAction,
  StudyRoomState,
  StudyRoomStateEvent,
} from '../types/studyRoom';

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
  study_room_state: StudyRoomStateEvent;
  error: ErrorPayload;
  history: ClawbotChannelMessage[];
};

type NativeSocketEventName = keyof NativeSocketEvents;
type NativeSocketEventPayload<TEvent extends NativeSocketEventName> = NativeSocketEvents[TEvent];
type EventCallback<TPayload> = (payload: TPayload) => void;

type StoredSession = {
  accountId: string;
  appUserId?: string;
  serverUrl: string;
  websocketUrl: string;
  conversationId: string;
  clientToken: string;
  clientId: string;
  deviceName?: string;
  pairingCode?: string;
};

type StoredSessionState = {
  version: 2;
  activeAccountId: string;
  sessions: Record<string, StoredSession>;
};

type ConversationMessagesResponse = {
  messages: Array<{
    id: string;
    conversationId: string;
    direction: 'inbound' | 'outbound' | 'system';
    text: string;
    replyToMessageId?: string | null;
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
  accountId: string;
  conversationId: string;
  clientToken: string;
  peerId: string;
  websocketUrl: string;
  wsUrl?: string;
  uploadUrl: string;
  messagesUrl: string;
  serverUrl?: string;
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

type StudyRoomsListResponse = {
  success?: boolean;
  rooms?: StudyRoomState[];
  error?: string;
};

const STORAGE_KEYS = {
  sessions: 'trix_native_channel_sessions_v2',
  activeAccountId: 'trix_native_channel_active_account',
  legacySession: 'trix_native_channel_session',
  legacyClaim: 'trix_native_last_claim',
  clientId: 'trix_native_channel_client_id',
  legacyPairDeviceId: 'trix_native_pair_device_id',
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

/**
 * 检测 WebSocket URL 是否为内网 IP
 * 内网 IP 范围: 10.x.x.x, 172.16.x.x - 172.31.x.x, 192.168.x.x
 */
function isPrivateWebSocketUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^ws:\/\/10\./.test(url) ||
    /^ws:\/\/172\.(1[6-9]|2\d|3[1-9])\./.test(url) ||
    /^ws:\/\/192\.168\./.test(url);
}

/**
 * 解析 WebSocket URL，优先使用服务器返回的公网地址
 * 如果服务器返回内网 IP，则使用 serverUrl 推导的公网地址
 */
function resolveWebSocketUrl(claimWsUrl: string | undefined, serverUrl: string): string {
  if (claimWsUrl && !isPrivateWebSocketUrl(claimWsUrl)) {
    return claimWsUrl;
  }
  return toWebSocketUrl(serverUrl);
}

function defaultDeviceName(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'Browser' : 'Browser';
  return `TRIX-${platform}`;
}

function resolveConfiguredNativeBaseUrl(): string {
  const endpoints = getClawbotEndpoints();
  return normalizeServerUrl(endpoints.nativePublicUrl || endpoints.nativeServerUrl || '');
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
  // 将 createdAt 转换为毫秒时间戳
  const timestamp = typeof rawMessage.createdAt === 'number'
    ? rawMessage.createdAt
    : new Date(rawMessage.createdAt).getTime();
  return {
    id: rawMessage.id,
    replyToMessageId: rawMessage.replyToMessageId ?? null,
    content: rawMessage.text,
    contentType: deriveContentType(rawMessage.text, attachments),
    mediaUrl: primaryAttachment?.url,
    mediaMimeType: primaryAttachment?.mimeType,
    mediaMetadata: toMediaMetadata(attachments),
    attachments,
    metadata: {
      ...(rawMessage.metadata ?? {}),
      serverMessageId: rawMessage.id,
    },
    timestamp,
    sender: rawMessage.senderId?.startsWith('openclaw:') ? 'bot' : 'user',
  };
}

function normalizeAccountId(accountId: string | undefined | null): string {
  return accountId?.trim() || 'default';
}

function parseQrOrClaimPayload(rawInput: string): { serverUrl?: string; code: string; secret?: string; accountId?: string } {
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
        accountId: typeof parsed.accountId === 'string' ? normalizeAccountId(parsed.accountId) : undefined,
      };
    }
  } catch (error) {
    // Ignore JSON parse failure.
    logger.debug('TrixNativeChannel', 'QR code parsing failed:', error);
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
      accountId: normalizeAccountId(url.searchParams.get('accountId')),
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
  if (/^[A-Z0-9]{6}$/.test(normalizedCode)) {
    return { code: normalizedCode };
  }

  throw new Error('无法解析配对二维码或配对链接');
}

async function readErrorPayload(response: Response, fallbackMessage: string): Promise<string> {
  const payload = await response.json().catch(() => ({ error: fallbackMessage })) as { error?: string };
  return typeof payload.error === 'string' ? payload.error : fallbackMessage;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

class TrixNativeChannelClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<EventCallback<unknown>>>();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private agentOnline = false;
  private currentAuthUserId: string | null = null;

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

  setAuthUser(userId: string | null | undefined): void {
    this.currentAuthUserId = userId?.trim() || null;
  }

  private async getAuthAccessToken(): Promise<string | null> {
    if (!this.currentAuthUserId) {
      return null;
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return session.access_token;
      }
      await wait(250);
    }

    logger.clawbot.warn('[TrixNative] auth token unavailable for native session flow', {
      appUserId: this.currentAuthUserId,
    });
    return null;
  }

  getOrCreateClientId(): string {
    const stored = localStorage.getItem(STORAGE_KEYS.clientId);
    if (stored?.trim()) {
      return stored;
    }
    const legacyStored = localStorage.getItem(STORAGE_KEYS.legacyPairDeviceId);
    if (legacyStored?.trim()) {
      localStorage.setItem(STORAGE_KEYS.clientId, legacyStored);
      return legacyStored;
    }
    const next = `web_${generateSecureRandomString(18)}`;
    localStorage.setItem(STORAGE_KEYS.clientId, next);
    localStorage.setItem(STORAGE_KEYS.legacyPairDeviceId, next);
    return next;
  }

  private normalizeStoredSession(parsed: Partial<StoredSession>): StoredSession | null {
    if (!parsed.serverUrl || !parsed.conversationId || !parsed.clientToken || !parsed.clientId) {
      return null;
    }

    return {
      accountId: normalizeAccountId(parsed.accountId),
      appUserId: parsed.appUserId?.trim() || undefined,
      serverUrl: normalizeServerUrl(parsed.serverUrl),
      websocketUrl: parsed.websocketUrl ? normalizeServerUrl(parsed.websocketUrl) : toWebSocketUrl(parsed.serverUrl),
      conversationId: parsed.conversationId,
      clientToken: parsed.clientToken,
      clientId: parsed.clientId,
      deviceName: parsed.deviceName,
      pairingCode: parsed.pairingCode,
    };
  }

  private normalizeClaimPayload(parsed: Partial<ClaimResponse> & {
    websocketUrl?: string;
    clientId?: string;
    deviceName?: string;
    pairingCode?: string;
    appUserId?: string;
  }): StoredSession | null {
    if (!parsed.conversationId || !parsed.clientToken) {
      return null;
    }

    const serverUrl = normalizeServerUrl(parsed.serverUrl || resolveConfiguredNativeBaseUrl() || '');
    if (!serverUrl) {
      return null;
    }

    const clientId = typeof parsed.clientId === 'string' && parsed.clientId.trim()
      ? parsed.clientId
      : this.getOrCreateClientId();

    return {
      accountId: normalizeAccountId(parsed.accountId),
      appUserId: parsed.appUserId?.trim() || undefined,
      serverUrl,
      websocketUrl: resolveWebSocketUrl(parsed.websocketUrl || parsed.wsUrl, serverUrl),
      conversationId: parsed.conversationId,
      clientToken: parsed.clientToken,
      clientId,
      deviceName: parsed.deviceName,
      pairingCode: parsed.pairingCode || parsed.pairing?.code,
    };
  }

  private readSessionState(): StoredSessionState {
    const raw = localStorage.getItem(STORAGE_KEYS.sessions);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoredSessionState>;
        const sessions = Object.fromEntries(
          Object.entries(parsed.sessions ?? {})
            .map(([accountId, session]) => [normalizeAccountId(accountId), this.normalizeStoredSession(session)])
            .filter((entry): entry is [string, StoredSession] => Boolean(entry[1])),
        );
        const activeAccountId = normalizeAccountId(
          parsed.activeAccountId
          || localStorage.getItem(STORAGE_KEYS.activeAccountId)
          || Object.keys(sessions)[0],
        );

        return {
          version: 2,
          activeAccountId,
          sessions,
        };
      } catch (error) {
        logger.debug('TrixNativeChannel', 'Session state parsing failed:', error);
      }
    }

    const legacyRaw = localStorage.getItem(STORAGE_KEYS.legacySession);
    if (!legacyRaw) {
      return {
        version: 2,
        activeAccountId: 'default',
        sessions: {},
      };
    }

    try {
      const legacyParsed = JSON.parse(legacyRaw) as Partial<StoredSession>;
      const normalized = this.normalizeStoredSession({ ...legacyParsed, accountId: normalizeAccountId(legacyParsed.accountId) });
      if (!normalized) {
        return {
          version: 2,
          activeAccountId: 'default',
          sessions: {},
        };
      }
      const migrated = {
        version: 2 as const,
        activeAccountId: normalized.accountId,
        sessions: {
          [normalized.accountId]: normalized,
        },
      };
      this.writeSessionState(migrated);
      return migrated;
    } catch (error) {
      logger.debug('TrixNativeChannel', 'Legacy session migration failed:', error);
    }

    const legacyClaimRaw = localStorage.getItem(STORAGE_KEYS.legacyClaim);
    if (legacyClaimRaw) {
      try {
        const legacyClaim = JSON.parse(legacyClaimRaw) as Partial<ClaimResponse> & {
          websocketUrl?: string;
          clientId?: string;
          deviceName?: string;
          pairingCode?: string;
        };
        const normalized = this.normalizeClaimPayload(legacyClaim);
        if (normalized) {
          const migrated = {
            version: 2 as const,
            activeAccountId: normalized.accountId,
            sessions: {
              [normalized.accountId]: normalized,
            },
          };
          this.writeSessionState(migrated);
          return migrated;
        }
      } catch (error) {
        logger.debug('TrixNativeChannel', 'Legacy claim migration failed:', error);
      }
    }

    return {
      version: 2,
      activeAccountId: 'default',
      sessions: {},
    };
  }

  private writeSessionState(state: StoredSessionState): void {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEYS.activeAccountId, state.activeAccountId);

    const activeSession = state.sessions[state.activeAccountId];
    if (activeSession) {
      localStorage.setItem(STORAGE_KEYS.legacySession, JSON.stringify(activeSession));
      localStorage.setItem(STORAGE_KEYS.clientId, activeSession.clientId);
      localStorage.setItem(STORAGE_KEYS.legacyPairDeviceId, activeSession.clientId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.legacySession);
    }
  }

  private getActiveAccountId(): string {
    return this.readSessionState().activeAccountId;
  }

  private getStoredSession(accountId?: string): StoredSession | null {
    const state = this.readSessionState();
    const resolvedAccountId = normalizeAccountId(accountId ?? state.activeAccountId);
    return state.sessions[resolvedAccountId] ?? null;
  }

  getSession(accountId?: string): StoredSession | null {
    const session = this.getStoredSession(accountId);
    if (!session) {
      return null;
    }
    if (!this.currentAuthUserId) {
      return null;
    }
    if (session.appUserId !== this.currentAuthUserId) {
      return null;
    }
    return session;
  }

  private saveSession(session: StoredSession): void {
    const scopedSession: StoredSession = {
      ...session,
      appUserId: this.currentAuthUserId ?? session.appUserId,
    };
    const state = this.readSessionState();
    const nextState: StoredSessionState = {
      version: 2,
      activeAccountId: scopedSession.accountId,
      sessions: {
        ...state.sessions,
        [scopedSession.accountId]: scopedSession,
      },
    };
    this.writeSessionState(nextState);
  }

  clearSession(accountId?: string): void {
    const state = this.readSessionState();
    const resolvedAccountId = normalizeAccountId(accountId ?? state.activeAccountId);
    const sessions = { ...state.sessions };
    delete sessions[resolvedAccountId];
    const nextActiveAccountId = sessions[state.activeAccountId]
      ? state.activeAccountId
      : normalizeAccountId(Object.keys(sessions)[0]);

    this.writeSessionState({
      version: 2,
      activeAccountId: Object.keys(sessions).length > 0 ? nextActiveAccountId : 'default',
      sessions,
    });

    if (Object.keys(sessions).length === 0) {
      localStorage.removeItem(STORAGE_KEYS.sessions);
      localStorage.removeItem(STORAGE_KEYS.activeAccountId);
      localStorage.removeItem(STORAGE_KEYS.legacySession);
    }
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

  private async claimPairing(params: {
    serverUrl: string;
    code: string;
    clientId: string;
    deviceName: string;
    accountId?: string;
    secret?: string;
    fallbackError: string;
  }): Promise<ClaimResponse> {
    const requestBody = {
      accountId: params.accountId,
      clientId: params.clientId,
      deviceName: params.deviceName,
      secret: params.secret,
    };

    const accessToken = await this.getAuthAccessToken();

    const runClaim = async (body: typeof requestBody) => {
      const response = await fetch(`${params.serverUrl}/api/pairings/${encodeURIComponent(params.code)}/claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return response;
    };

    let response = await runClaim(requestBody);
    if (!response.ok) {
      const message = await readErrorPayload(response, params.fallbackError);
      const shouldRetryWithoutSecret = Boolean(params.secret) && /invalid pairing secret/i.test(message);
      if (!shouldRetryWithoutSecret) {
        throw new Error(message);
      }

      response = await runClaim({
        ...requestBody,
        secret: undefined,
      });
      if (!response.ok) {
        throw new Error(await readErrorPayload(response, params.fallbackError));
      }
    }

    return await response.json() as ClaimResponse;
  }

  async bindCurrentSessionToAuthUser(): Promise<boolean> {
    if (!this.currentAuthUserId) {
      return false;
    }

    const session = this.getStoredSession();
    if (!session || session.appUserId === this.currentAuthUserId) {
      return Boolean(session?.appUserId === this.currentAuthUserId);
    }

    const accessToken = await this.getAuthAccessToken();
    if (!accessToken) {
      return false;
    }

    const response = await fetch(`${session.serverUrl}/api/client/session/bind`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        conversationId: session.conversationId,
        clientToken: session.clientToken,
      }),
    });

    if (!response.ok) {
      const errorMessage = await readErrorPayload(response, '绑定当前配对会话失败');
      if (response.status === 403 || response.status === 401) {
        this.clearSession(session.accountId);
      }
      throw new Error(errorMessage);
    }

    this.saveSession({
      ...session,
      appUserId: this.currentAuthUserId,
    });
    return true;
  }

  async restoreSession(accountId?: string, deviceName: string = defaultDeviceName()): Promise<StoredSession | null> {
    if (!this.currentAuthUserId) {
      return null;
    }

    const accessToken = await this.getAuthAccessToken();
    if (!accessToken) {
      return null;
    }

    const serverUrl = normalizeServerUrl(resolveConfiguredNativeBaseUrl() || this.getStoredSession(accountId)?.serverUrl || '');
    if (!serverUrl) {
      return null;
    }

    const clientId = this.getOrCreateClientId();
    const resolvedAccountId = normalizeAccountId(accountId);
    const response = await fetch(`${serverUrl}/api/client/session/restore`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        accountId: resolvedAccountId,
        clientId,
        deviceName,
      }),
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await readErrorPayload(response, '恢复已配对会话失败'));
    }

    const payload = await response.json() as ClaimResponse & {
      pairingCode?: string;
      serverUrl?: string;
    };

    const finalServerUrl = payload.serverUrl || serverUrl;
    const restored: StoredSession = {
      accountId: normalizeAccountId(payload.accountId ?? resolvedAccountId),
      appUserId: this.currentAuthUserId,
      serverUrl: finalServerUrl,
      websocketUrl: resolveWebSocketUrl(payload.websocketUrl || payload.wsUrl, finalServerUrl),
      conversationId: payload.conversationId,
      clientToken: payload.clientToken,
      clientId,
      deviceName,
      pairingCode: payload.pairingCode || payload.pairing?.code,
    };

    this.saveSession(restored);
    this.agentOnline = Boolean(payload.agentOnline);
    return restored;
  }

  async pairWithCode(code: string, deviceName: string = defaultDeviceName(), secret?: string, accountId?: string): Promise<{ success: boolean }> {
    const session = this.getSession();
    const serverUrl = normalizeServerUrl(resolveConfiguredNativeBaseUrl() || session?.serverUrl || '');
    if (!serverUrl) {
      throw new Error('未配置 TRIX Native Server 地址，请先设置 VITE_TRIX_NATIVE_SERVER_URL');
    }

    const clientId = this.getOrCreateClientId();
    const claim = await this.claimPairing({
      serverUrl,
      code,
      clientId,
      deviceName,
      accountId: accountId ? normalizeAccountId(accountId) : undefined,
      secret,
      fallbackError: '配对失败',
    });
    const finalServerUrl = claim.serverUrl || serverUrl;
    this.saveSession({
      accountId: normalizeAccountId(claim.accountId),
      serverUrl: finalServerUrl,
      websocketUrl: resolveWebSocketUrl(claim.websocketUrl, finalServerUrl),
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
    const serverUrl = normalizeServerUrl(parsed.serverUrl || resolveConfiguredNativeBaseUrl() || this.getSession()?.serverUrl || '');
    if (!serverUrl) {
      throw new Error('二维码没有包含服务器地址，且当前环境未配置 VITE_TRIX_NATIVE_SERVER_URL');
    }

    const clientId = this.getOrCreateClientId();
    const claim = await this.claimPairing({
      serverUrl,
      code: parsed.code,
      clientId,
      deviceName,
      accountId: parsed.accountId,
      secret: parsed.secret,
      fallbackError: '二维码配对失败',
    });
    const finalServerUrl = claim.serverUrl || serverUrl;
    this.saveSession({
      accountId: normalizeAccountId(claim.accountId),
      serverUrl: finalServerUrl,
      websocketUrl: resolveWebSocketUrl(claim.websocketUrl, finalServerUrl),
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

  async createStudyRoom(params: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    maxMembers?: number;
  }): Promise<StudyRoomState> {
    const payload = await this.requestJson<StudyRoomAckPayload>('/api/study-rooms', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
    }, '创建房间失败');

    if (!payload.success || !payload.room) {
      throw new Error(payload.error || '创建房间失败');
    }
    return payload.room;
  }

  async joinStudyRoom(
    roomCode: string,
    params: {
      userId: string;
      displayName: string;
      avatarUrl?: string;
    },
  ): Promise<StudyRoomState> {
    const payload = await this.requestJson<StudyRoomAckPayload>(
      `/api/study-rooms/${encodeURIComponent(roomCode)}/join`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(params),
      },
      '加入房间失败',
    );

    if (!payload.success || !payload.room) {
      throw new Error(payload.error || '加入房间失败');
    }
    return payload.room;
  }

  async leaveStudyRoom(roomCode: string, userId: string): Promise<void> {
    const payload = await this.requestJson<StudyRoomAckPayload>(
      `/api/study-rooms/${encodeURIComponent(roomCode)}/leave`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      },
      '离开房间失败',
    );

    if (!payload.success) {
      throw new Error(payload.error || '离开房间失败');
    }
  }

  async hostActionStudyRoom(
    roomCode: string,
    params: {
      userId: string;
      action: StudyRoomHostAction;
      durationMinutes?: number;
    },
  ): Promise<StudyRoomState> {
    const payload = await this.requestJson<StudyRoomAckPayload>(
      `/api/study-rooms/${encodeURIComponent(roomCode)}/action`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(params),
      },
      '房间控制失败',
    );

    if (!payload.success || !payload.room) {
      throw new Error(payload.error || '房间控制失败');
    }
    return payload.room;
  }

  async getStudyRoomState(params: { userId: string; roomCode?: string }): Promise<StudyRoomState> {
    if (params.roomCode?.trim()) {
      const payload = await this.requestJson<StudyRoomAckPayload>(
        `/api/study-rooms/${encodeURIComponent(params.roomCode.trim())}`,
        undefined,
        '获取房间状态失败',
      );
      if (!payload.success || !payload.room) {
        throw new Error(payload.error || '获取房间状态失败');
      }
      return payload.room;
    }

    const payload = await this.requestJson<StudyRoomsListResponse>('/api/study-rooms', undefined, '获取房间状态失败');
    const room = (payload.rooms ?? []).find((entry) =>
      entry.members.some((member) => member.userId === params.userId),
    );
    if (!room) {
      throw new Error('NOT_IN_ROOM');
    }
    return room;
  }

  async lookupStudyRoomsByUsers(userIds: string[]): Promise<{ users: FriendRoomLookupResult[] }> {
    if (userIds.length === 0) {
      return { users: [] };
    }

    const payload = await this.requestJson<StudyRoomsListResponse>('/api/study-rooms', undefined, '查询好友房间失败');
    const users = userIds.map<FriendRoomLookupResult>((userId) => {
      const room = (payload.rooms ?? []).find((entry) =>
        entry.members.some((member) => member.userId === userId),
      );
      if (!room) {
        return { userId, inRoom: false };
      }
      return {
        userId,
        inRoom: true,
        roomCode: room.roomCode,
        sessionState: room.sessionState,
        memberCount: room.members.length,
      };
    });

    return { users };
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
        text: params.text,
        localId: clientMessageId,
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
    const session = this.getSession();
    this.disconnect();
    if (session) {
      void fetch(`${session.serverUrl}/api/pairings/${encodeURIComponent(session.clientId)}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${session.clientToken}`,
        },
      }).catch((error: unknown) => {
        logger.warn('TrixNativeChannel', 'Server-side unpair failed:', error);
      });
    }
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

  private async requestJson<T>(path: string, init?: RequestInit, fallbackMessage = '请求失败'): Promise<T> {
    const session = this.requireSession();
    const headers = new Headers(init?.headers);
    headers.set('x-trix-client-token', session.clientToken);
    headers.set('x-trix-conversation-id', session.conversationId);

    const response = await fetch(`${session.serverUrl}${path}`, {
      ...init,
      headers,
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : fallbackMessage);
    }
    return (payload ?? {}) as T;
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
        return;
      }

      if (envelope.type === 'study_room_state') {
        const payload = envelope.payload as StudyRoomStateEvent | undefined;
        if (!payload?.roomCode) {
          return;
        }
        this.emit('study_room_state', payload);
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

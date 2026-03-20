import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { AttachmentStore } from '../attachments/AttachmentStore.js';
import { PairingService } from '../pairing/PairingService.js';
import { JsonStateStore } from '../storage/JsonStateStore.js';
import type {
  AttachmentDescriptor,
  ClientEnvelope,
  ConversationRecord,
  CreateMessageInput,
  MessageRecord,
  NativeChannelState,
  PairingCreatedResponse,
  PairingRecord,
  ServiceCreateMessageInput,
  ServerConfig,
  ServerRateLimitName,
  ServerRateLimitRule,
  StudyRoom,
  StudyRoomAckPayload,
  StudyRoomStateEvent,
  UserCreateMessageInput,
} from '../types.js';
import { randomId, randomToken } from '../utils/ids.js';
import { buildPublicBaseUrl } from '../utils/network.js';
import { parseUrl, readBinaryBody, readJsonBody, sendJson, sendNoContent } from '../utils/http.js';
import { DEFAULT_RATE_LIMITS, getRequestIp, isIpAllowed, MemoryRateLimiter, parseCommaSeparatedList } from './accessControl.js';

type SocketMeta = {
  role: 'user' | 'service' | 'agent';
  accountId?: string;
  conversationId?: string;
  clientId?: string;
};

const ATTACHMENT_URL_TTL_MS = 24 * 60 * 60 * 1000;
const LEGACY_AGENT_WS_ENV = 'TRIX_NATIVE_ENABLE_LEGACY_AGENT_WS';
const SERVICE_ALLOWLIST_ENV = 'TRIX_NATIVE_SERVICE_ALLOWLIST';

const RATE_LIMIT_ENV_KEYS: Record<ServerRateLimitName, { max: string; windowMs: string }> = {
  claim: {
    max: 'TRIX_NATIVE_RATE_LIMIT_CLAIM_MAX',
    windowMs: 'TRIX_NATIVE_RATE_LIMIT_CLAIM_WINDOW_MS',
  },
  userMessages: {
    max: 'TRIX_NATIVE_RATE_LIMIT_USER_MESSAGES_MAX',
    windowMs: 'TRIX_NATIVE_RATE_LIMIT_USER_MESSAGES_WINDOW_MS',
  },
  userUploads: {
    max: 'TRIX_NATIVE_RATE_LIMIT_USER_UPLOADS_MAX',
    windowMs: 'TRIX_NATIVE_RATE_LIMIT_USER_UPLOADS_WINDOW_MS',
  },
  serviceMessages: {
    max: 'TRIX_NATIVE_RATE_LIMIT_SERVICE_MESSAGES_MAX',
    windowMs: 'TRIX_NATIVE_RATE_LIMIT_SERVICE_MESSAGES_WINDOW_MS',
  },
  serviceUploads: {
    max: 'TRIX_NATIVE_RATE_LIMIT_SERVICE_UPLOADS_MAX',
    windowMs: 'TRIX_NATIVE_RATE_LIMIT_SERVICE_UPLOADS_WINDOW_MS',
  },
};

class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class TrixNativeServer {
  readonly stateStore: JsonStateStore;
  private readonly host: string;
  private readonly port: number;
  private readonly storageDir: string;
  private readonly publicBaseUrl: string;
  private readonly adminTokenOverride?: string;
  private readonly serviceTokenOverride?: string;
  private readonly attachmentSigningSecretOverride?: string;
  private readonly enableLegacyAgentWs: boolean;
  private readonly serviceAllowlist: string[];
  private readonly rateLimits: Record<ServerRateLimitName, ServerRateLimitRule>;
  private readonly pairingService: PairingService;
  private readonly attachmentStore: AttachmentStore;
  private readonly server: http.Server;
  private readonly wss: WebSocketServer;
  private readonly sockets = new Map<WebSocket, SocketMeta>();
  private readonly rateLimiter = new MemoryRateLimiter();

  constructor(config: ServerConfig = {}) {
    this.host = config.host ?? '0.0.0.0';
    this.port = config.port ?? 8788;
    this.storageDir = path.resolve(config.storageDir ?? path.join(process.cwd(), '.trix-native-channel'));
    this.publicBaseUrl = buildPublicBaseUrl(this.host, this.port, config.publicBaseUrl ?? process.env.TRIX_NATIVE_PUBLIC_BASE_URL);
    this.adminTokenOverride = config.adminToken;
    this.serviceTokenOverride = config.serviceToken;
    this.attachmentSigningSecretOverride = config.attachmentSigningSecret;
    this.enableLegacyAgentWs = config.enableLegacyAgentWs ?? process.env[LEGACY_AGENT_WS_ENV] === '1';
    this.serviceAllowlist = config.serviceAllowlist ?? parseCommaSeparatedList(process.env[SERVICE_ALLOWLIST_ENV]);
    this.rateLimits = this.resolveRateLimits(config.rateLimits);
    this.stateStore = new JsonStateStore(this.storageDir);
    this.pairingService = new PairingService(this.stateStore);
    this.attachmentStore = new AttachmentStore(this.storageDir, this.publicBaseUrl);
    this.server = http.createServer(this.handleRequest.bind(this));
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (request, socket, head) => {
      const url = parseUrl(request);
      if (url.pathname !== '/ws' && url.pathname !== '/api/service/ws') {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.handleSocket(ws, request, url.pathname, url.searchParams).catch((error: unknown) => {
          const code = error instanceof HttpError ? 1008 : 1011;
          const reason = error instanceof Error ? error.message : String(error);
          ws.close(code, reason.slice(0, 120));
        });
      });
    });
  }

  async start(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await this.attachmentStore.ensure();
    await this.stateStore.ensure();

    await this.stateStore.update((state) => ({
      ...state,
      adminToken: state.adminToken || this.adminTokenOverride || process.env.TRIX_NATIVE_ADMIN_TOKEN || randomToken(24),
      serviceTokens: {
        default: state.serviceTokens.default || this.serviceTokenOverride || process.env.TRIX_NATIVE_SERVICE_TOKEN || randomToken(32),
        ...state.serviceTokens,
      },
      attachmentSigningSecret: state.attachmentSigningSecret || this.attachmentSigningSecretOverride || randomToken(32),
    }));

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.port, this.host, () => resolve());
      this.server.once('error', reject);
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets.keys()) {
      socket.close(1000, 'server stop');
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  getBaseUrl(): string {
    return this.publicBaseUrl;
  }

  async createPairing(input: { accountId?: string; label?: string; ttlMs?: number; openClawSessionKey?: string } = {}): Promise<PairingCreatedResponse> {
    return this.pairingService.create({
      ...input,
      accountId: input.accountId ?? 'default',
      publicBaseUrl: this.publicBaseUrl,
    });
  }

  private getUserWebSocketUrl(): string {
    return `${this.publicBaseUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws`;
  }

  private serializePairingForCreate(pairing: PairingCreatedResponse) {
    return {
      code: pairing.code,
      accountId: pairing.accountId,
      label: pairing.label,
      createdAt: pairing.createdAt,
      expiresAt: pairing.expiresAt,
      status: pairing.status,
      conversationId: pairing.conversationId,
      claimUrl: pairing.claimUrl,
      qrDataUrl: pairing.qrDataUrl,
      pairedAt: pairing.pairedAt,
      pairedClientId: pairing.pairedClientId,
      pairedDeviceName: pairing.pairedDeviceName,
      peerId: pairing.peerId,
      websocketUrl: pairing.websocketUrl,
    };
  }

  private serializePairingForInspection(pairing: PairingRecord | undefined) {
    if (!pairing) {
      return pairing;
    }
    return {
      code: pairing.code,
      accountId: pairing.accountId,
      label: pairing.label,
      createdAt: pairing.createdAt,
      expiresAt: pairing.expiresAt,
      status: pairing.status,
      conversationId: pairing.conversationId,
      pairedAt: pairing.pairedAt,
      pairedClientId: pairing.pairedClientId,
      pairedDeviceName: pairing.pairedDeviceName,
      peerId: pairing.peerId,
    };
  }

  private resolveAccountId(searchParams: URLSearchParams | null | undefined, fallback = 'default'): string {
    return searchParams?.get('accountId')?.trim() || fallback;
  }

  private readHeader(request: http.IncomingMessage, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private readBearerToken(request: http.IncomingMessage): string | undefined {
    const authorization = this.readHeader(request, 'authorization');
    if (!authorization) {
      return undefined;
    }
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim();
  }

  private resolveRateLimits(overrides?: Partial<Record<ServerRateLimitName, ServerRateLimitRule>>): Record<ServerRateLimitName, ServerRateLimitRule> {
    const resolved = { ...DEFAULT_RATE_LIMITS };
    const scopes = Object.keys(DEFAULT_RATE_LIMITS) as ServerRateLimitName[];
    for (const scope of scopes) {
      const envKeys = RATE_LIMIT_ENV_KEYS[scope];
      const override = overrides?.[scope];
      const max = Number(override?.max ?? process.env[envKeys.max] ?? resolved[scope].max);
      const windowMs = Number(override?.windowMs ?? process.env[envKeys.windowMs] ?? resolved[scope].windowMs);
      resolved[scope] = {
        max: Number.isFinite(max) ? max : DEFAULT_RATE_LIMITS[scope].max,
        windowMs: Number.isFinite(windowMs) ? windowMs : DEFAULT_RATE_LIMITS[scope].windowMs,
      };
    }
    return resolved;
  }

  private assertRateLimit(request: http.IncomingMessage, scope: ServerRateLimitName, subject = ''): void {
    const ip = getRequestIp(request) ?? 'unknown';
    const key = subject ? `${ip}:${subject}` : ip;
    if (!this.rateLimiter.consume(scope, key, this.rateLimits[scope])) {
      throw new HttpError(429, `Rate limit exceeded for ${scope}`);
    }
  }

  private assertServiceNetworkAccess(request: http.IncomingMessage): void {
    if (!this.serviceAllowlist.length) {
      return;
    }

    const requestIp = getRequestIp(request);
    if (!isIpAllowed(requestIp, this.serviceAllowlist)) {
      throw new HttpError(403, 'Service access denied for source IP');
    }
  }

  private async handleRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    try {
      const url = parseUrl(request);
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { ok: true, baseUrl: this.publicBaseUrl, agentOnline: this.isServiceOnline() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/service/probe') {
        const accountId = this.resolveAccountId(url.searchParams);
        await this.assertServiceToken(request, accountId);
        sendJson(response, 200, {
          ok: true,
          service: 'trix-service',
          accounts: {
            [accountId]: {
              wsConnected: this.isServiceOnline(accountId),
              lastEventAt: Date.now(),
            },
          },
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/pairings') {
        const accountId = this.resolveAccountId(url.searchParams);
        await this.assertPairingAccess(request, accountId);
        const pairings = (await this.pairingService.list())
          .filter((entry) => entry.accountId === accountId)
          .map((entry) => this.serializePairingForInspection(entry));
        sendJson(response, 200, pairings);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/pairings') {
        const body = await readJsonBody<{ accountId?: string; label?: string; ttlMs?: number; openClawSessionKey?: string }>(request);
        const accountId = body.accountId ?? this.resolveAccountId(url.searchParams);
        await this.assertPairingAccess(request, accountId);
        const pairing = await this.createPairing(body);
        sendJson(response, 201, this.serializePairingForCreate(pairing));
        return;
      }

      const pairingMatch = url.pathname.match(/^\/api\/pairings\/([^/]+)$/);
      if (request.method === 'GET' && pairingMatch) {
        const pairing = await this.pairingService.get(pairingMatch[1]!);
        if (!pairing) {
          sendJson(response, 404, { error: 'Pairing not found' });
          return;
        }
        await this.assertPairingAccess(request, pairing.accountId);
        sendJson(response, 200, this.serializePairingForInspection(pairing));
        return;
      }

      if (request.method === 'DELETE' && pairingMatch) {
        const token = this.readBearerToken(request) ?? this.readHeader(request, 'x-trix-client-token');
        await this.unpairClient(pairingMatch[1]!, token);
        sendNoContent(response);
        return;
      }

      const pairingClaimMatch = url.pathname.match(/^\/api\/pairings\/([^/]+)\/claim$/);
      if (request.method === 'POST' && pairingClaimMatch) {
        this.assertRateLimit(request, 'claim');
        const body = await readJsonBody<{ accountId?: string; secret?: string; clientId: string; deviceName?: string }>(request);
        let result;
        try {
          result = await this.pairingService.claim(
            {
              code: pairingClaimMatch[1]!,
              accountId: body.accountId,
              secret: body.secret,
              clientId: body.clientId,
              deviceName: body.deviceName,
            },
            {
              websocketUrl: this.getUserWebSocketUrl(),
              uploadUrl: `${this.publicBaseUrl}/api/uploads`,
              messagesUrl: `${this.publicBaseUrl}/api/messages`,
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message === 'Pairing code not found') {
            throw new HttpError(404, message);
          }
          if (message === 'Pairing code expired') {
            throw new HttpError(410, message);
          }
          throw new HttpError(409, message);
        }
        await this.broadcast(
          {
            type: 'pairing.updated',
            payload: { ...result, agentOnline: this.isServiceOnline(result.accountId) },
          },
          { role: 'service', accountId: result.accountId },
        );
        sendJson(response, 200, { ...result, serverUrl: this.publicBaseUrl, agentOnline: this.isServiceOnline(result.accountId) });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/uploads') {
        this.assertRateLimit(request, 'userUploads');
        await this.assertAttachmentUploadAccess(request);
        const conversationId = this.readHeader(request, 'x-trix-conversation-id');
        const conversation = conversationId ? await this.getConversation(conversationId) : undefined;
        const kind = (request.headers['x-attachment-kind'] as string | undefined) ?? undefined;
        const encodedFileName = (request.headers['x-file-name'] as string | undefined) ?? 'upload.bin';
        const fileName = decodeURIComponent(encodedFileName);
        const mimeType = (request.headers['x-mime-type'] as string | undefined) ?? 'application/octet-stream';
        const buffer = await readBinaryBody(request);
        const upload = await this.attachmentStore.createUploadResponse({
          buffer,
          fileName,
          mimeType,
          kind: kind as AttachmentDescriptor['kind'] | undefined,
          conversationId,
          accountId: conversation?.accountId,
        });
        const nextState = await this.stateStore.update((state) => ({
          ...state,
          uploads: [upload.attachment, ...state.uploads.filter((entry) => entry.id !== upload.attachment.id)],
        }));
        sendJson(response, 201, {
          attachment: this.serializeAttachmentForUser(nextState, {
            accountId: conversation?.accountId ?? upload.attachment.accountId ?? 'default',
            conversationId: conversationId ?? upload.attachment.conversationId,
          }, upload.attachment),
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/service/uploads') {
        const accountId = this.resolveAccountId(url.searchParams);
        this.assertRateLimit(request, 'serviceUploads', accountId);
        await this.assertServiceToken(request, accountId);
        const kind = (this.readHeader(request, 'x-attachment-kind') as AttachmentDescriptor['kind'] | undefined) ?? undefined;
        const encodedFileName = this.readHeader(request, 'x-file-name') ?? 'service-upload.bin';
        const fileName = decodeURIComponent(encodedFileName);
        const mimeType = this.readHeader(request, 'x-mime-type') ?? 'application/octet-stream';
        const buffer = await readBinaryBody(request);
        const upload = await this.attachmentStore.createUploadResponse({
          buffer,
          fileName,
          mimeType,
          kind,
          accountId,
        });
        const nextState = await this.stateStore.update((state) => ({
          ...state,
          uploads: [upload.attachment, ...state.uploads.filter((entry) => entry.id !== upload.attachment.id)],
        }));
        sendJson(response, 201, {
          attachment: this.serializeAttachmentForService(nextState, {
            accountId,
            conversationId: upload.attachment.conversationId,
          }, upload.attachment),
        });
        return;
      }

      const attachmentMatch = url.pathname.match(/^\/api\/(?:service\/)?attachments\/([^/]+)$/);
      if (request.method === 'GET' && attachmentMatch) {
        const state = await this.stateStore.read();
        const attachment = this.findAttachmentById(state, attachmentMatch[1]!);
        if (!attachment) {
          sendJson(response, 404, { error: 'Attachment not found' });
          return;
        }
        await this.assertAttachmentReadAccess(request, state, attachment, url.pathname.startsWith('/api/service/'));
        const buffer = await fs.readFile(attachment.storagePath);
        response.writeHead(200, {
          'content-type': attachment.mimeType,
          'content-length': buffer.byteLength,
          'access-control-allow-origin': '*',
        });
        response.end(buffer);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/messages') {
        this.assertRateLimit(request, 'userMessages');
        const body = await readJsonBody<UserCreateMessageInput>(request);
        const message = await this.createUserMessage(body);
        sendJson(response, 201, { message });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/service/messages') {
        const body = await readJsonBody<ServiceCreateMessageInput>(request);
        const accountId = body.accountId ?? this.resolveAccountId(url.searchParams);
        this.assertRateLimit(request, 'serviceMessages', accountId);
        await this.assertServiceToken(request, accountId);
        const message = await this.createServiceMessage({
          accountId,
          ...body,
        });
        sendJson(response, 201, { message });
        return;
      }

      const serviceConversationMatch = url.pathname.match(/^\/api\/service\/conversations\/([^/]+)$/);
      if (request.method === 'GET' && serviceConversationMatch) {
        const state = await this.stateStore.read();
        const conversation = state.conversations.find((entry) => entry.id === serviceConversationMatch[1]);
        if (!conversation) {
          sendJson(response, 404, { error: 'Conversation not found' });
          return;
        }
        await this.assertServiceToken(request, conversation.accountId);
        const messages = state.messages
          .filter((entry) => entry.conversationId === conversation.id)
          .map((entry) => this.serializeMessageForService(state, conversation, entry));
        sendJson(response, 200, { conversation, messages });
        return;
      }

      const serviceConversationByPeerMatch = url.pathname.match(/^\/api\/service\/conversations\/by-peer\/([^/]+)$/);
      if (request.method === 'GET' && serviceConversationByPeerMatch) {
        const accountId = this.resolveAccountId(url.searchParams);
        await this.assertServiceToken(request, accountId);
        const state = await this.stateStore.read();
        const conversation = [...state.conversations]
          .filter((entry) => entry.accountId === accountId && entry.peerId === serviceConversationByPeerMatch[1])
          .sort((left, right) => right.updatedAt - left.updatedAt)[0];
        if (!conversation) {
          sendJson(response, 404, { error: 'Conversation not found' });
          return;
        }
        sendJson(response, 200, { conversation });
        return;
      }

      const conversationMessagesMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (request.method === 'GET' && conversationMessagesMatch) {
        await this.assertConversationAccess(request, conversationMessagesMatch[1]!);
        const state = await this.stateStore.read();
        const conversation = state.conversations.find((entry) => entry.id === conversationMessagesMatch[1]);
        if (!conversation) {
          sendJson(response, 404, { error: 'Conversation not found' });
          return;
        }
        const messages = state.messages
          .filter((entry) => entry.conversationId === conversationMessagesMatch[1])
          .map((entry) => this.serializeMessageForUser(state, conversation, entry));
        sendJson(response, 200, { messages, agentOnline: this.isServiceOnline() });
        return;
      }

      // GET /api/messages/:conversationId (legacy)
      const legacyMessagesMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
      if (request.method === 'GET' && legacyMessagesMatch) {
        await this.assertConversationAccess(request, legacyMessagesMatch[1]!);
        const state = await this.stateStore.read();
        const conversation = state.conversations.find((entry) => entry.id === legacyMessagesMatch[1]);
        if (!conversation) {
          sendJson(response, 404, { error: 'Conversation not found' });
          return;
        }
        const messages = state.messages
          .filter((entry) => entry.conversationId === legacyMessagesMatch[1])
          .map((entry) => this.serializeMessageForUser(state, conversation, entry));
        sendJson(response, 200, { messages, agentOnline: this.isServiceOnline() });
        return;
      }

      // ============================================================
      // Study Room HTTP Endpoints
      // ============================================================

      // POST /api/study-rooms - Create a study room
      if (request.method === 'POST' && url.pathname === '/api/study-rooms') {
        await this.assertStudyRoomAccess(request);
        const body = await readJsonBody<{ userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }>(request);
        const room = await this.createStudyRoom(body);
        sendJson(response, 201, { success: true, room } as StudyRoomAckPayload);
        return;
      }

      // GET /api/study-rooms - List all study rooms
      if (request.method === 'GET' && url.pathname === '/api/study-rooms') {
        await this.assertStudyRoomAccess(request);
        const state = await this.stateStore.read();
        sendJson(response, 200, { success: true, rooms: state.studyRooms });
        return;
      }

      // GET /api/study-rooms/:roomCode - Get a specific study room
      const getRoomMatch = url.pathname.match(/^\/api\/study-rooms\/([^/]+)$/);
      if (request.method === 'GET' && getRoomMatch) {
        await this.assertStudyRoomAccess(request);
        const room = await this.getStudyRoom(getRoomMatch[1]!);
        if (!room) {
          sendJson(response, 404, { success: false, error: 'Room not found' });
          return;
        }
        sendJson(response, 200, { success: true, room } as StudyRoomAckPayload);
        return;
      }

      // POST /api/study-rooms/:roomCode/join - Join a study room
      if (request.method === 'POST' && url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/join$/)) {
        await this.assertStudyRoomAccess(request);
        const roomCode = url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/join$/)![1]!;
        const body = await readJsonBody<{ userId: string; displayName: string; avatarUrl?: string }>(request);
        const room = await this.joinStudyRoom(roomCode, body);
        if (!room) {
          sendJson(response, 404, { success: false, error: 'Room not found' });
          return;
        }
        sendJson(response, 200, { success: true, room } as StudyRoomAckPayload);
        return;
      }

      // POST /api/study-rooms/:roomCode/leave - Leave a study room
      if (request.method === 'POST' && url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/leave$/)) {
        await this.assertStudyRoomAccess(request);
        const roomCode = url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/leave$/)![1]!;
        const body = await readJsonBody<{ userId: string }>(request);
        await this.leaveStudyRoom(roomCode, body.userId);
        sendJson(response, 200, { success: true } as StudyRoomAckPayload);
        return;
      }

      // POST /api/study-rooms/:roomCode/action - Host action (start_focus, pause, end)
      if (request.method === 'POST' && url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/action$/)) {
        await this.assertStudyRoomAccess(request);
        const roomCode = url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/action$/)![1]!;
        const body = await readJsonBody<{ userId: string; action: 'start_focus' | 'pause' | 'end'; durationMinutes?: number }>(request);
        const room = await this.studyRoomHostAction(roomCode, body);
        if (!room) {
          sendJson(response, 404, { success: false, error: 'Room not found' });
          return;
        }
        sendJson(response, 200, { success: true, room } as StudyRoomAckPayload);
        return;
      }

      // DELETE /api/study-rooms/:roomCode - Delete a study room
      if (request.method === 'DELETE' && getRoomMatch) {
        await this.assertStudyRoomAccess(request);
        await this.deleteStudyRoom(getRoomMatch[1]!);
        sendJson(response, 200, { success: true } as StudyRoomAckPayload);
        return;
      }

      // POST /api/study-rooms/lookup-by-users - Look up active rooms for a list of user IDs
      if (request.method === 'POST' && url.pathname === '/api/study-rooms/lookup-by-users') {
        await this.assertStudyRoomAccess(request);
        const body = await readJsonBody<{ userIds: string[] }>(request);
        const result = await this.lookupStudyRoomsByUsers(body.userIds ?? []);
        sendJson(response, 200, { success: true, ...result });
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const conversation = await this.getConversation(input.conversationId);
    if (!conversation) {
      throw new HttpError(404, `Conversation not found: ${input.conversationId}`);
    }

    const inlineAttachments = input.attachments ?? [];
    const persistedInlineAttachments = [] as AttachmentDescriptor[];
    for (const attachment of inlineAttachments) {
      persistedInlineAttachments.push(await this.attachmentStore.saveFromInput({
        ...attachment,
        accountId: input.accountId ?? conversation.accountId,
        conversationId: input.conversationId,
      }));
    }

    let createdMessage: MessageRecord | undefined;
    const now = Date.now();

    await this.stateStore.update((state) => {
      const currentConversation = state.conversations.find((entry) => entry.id === input.conversationId);
      if (!currentConversation) {
        throw new HttpError(404, `Conversation not found: ${input.conversationId}`);
      }

      const uploadedAttachments = (input.uploadedAttachmentIds ?? []).map((attachmentId) => {
        const attachment = state.uploads.find((entry) => entry.id === attachmentId);
        if (!attachment) {
          throw new HttpError(404, `Uploaded attachment not found: ${attachmentId}`);
        }
        return {
          ...attachment,
          accountId: attachment.accountId ?? currentConversation.accountId,
          conversationId: attachment.conversationId ?? input.conversationId,
        };
      });

      createdMessage = {
        id: randomId('msg', 8),
        accountId: input.accountId ?? currentConversation.accountId,
        conversationId: input.conversationId,
        direction: input.direction,
        text: input.text ?? '',
        attachments: [...uploadedAttachments, ...persistedInlineAttachments],
        senderId: input.senderId,
        senderName: input.senderName,
        createdAt: now,
        replyToMessageId: input.replyToMessageId ?? null,
        metadata: input.metadata,
      };

      return {
        ...state,
        messages: [...state.messages, createdMessage],
        conversations: state.conversations.map((entry) =>
          entry.id === input.conversationId
            ? {
                ...entry,
                updatedAt: now,
                participants: entry.participants.map((participant) =>
                  participant.clientId === (input.metadata?.clientId as string | undefined)
                    ? { ...participant, lastSeenAt: now }
                    : participant,
                ),
              }
            : entry,
        ),
      };
    });

    if (!createdMessage) {
      throw new Error('Failed to create message');
    }

    return createdMessage;
  }

  private async createUserMessage(input: UserCreateMessageInput): Promise<MessageRecord> {
    const { conversation, participant } = await this.resolveClientContext(input.conversationId, input.clientToken);
    const message = await this.createMessage({
      accountId: conversation.accountId,
      conversationId: input.conversationId,
      clientToken: input.clientToken,
      direction: 'inbound',
      senderId: conversation.peerId,
      senderName: conversation.peerDisplayName ?? participant.deviceName ?? conversation.peerId,
      text: input.text ?? '',
      replyToMessageId: input.replyToMessageId ?? null,
      attachments: input.attachments,
      uploadedAttachmentIds: input.uploadedAttachmentIds,
      metadata: {
        ...input.metadata,
        clientId: participant.clientId,
        localId: input.localId ?? null,
        peerId: conversation.peerId,
      },
    });
    const state = await this.stateStore.read();
    await this.broadcast(this.buildUserMessageEnvelope(state, conversation, message), { role: 'user', conversationId: message.conversationId });
    await this.broadcast(this.buildServiceMessageEnvelope(state, conversation, message), { role: 'service', accountId: conversation.accountId });
    return message;
  }

  private async createServiceMessage(input: ServiceCreateMessageInput & { accountId: string }): Promise<MessageRecord> {
    const conversation = await this.getConversation(input.conversationId);
    if (!conversation) {
      throw new HttpError(404, `Conversation not found: ${input.conversationId}`);
    }
    if (conversation.accountId !== input.accountId) {
      throw new HttpError(403, `Conversation ${input.conversationId} does not belong to account ${input.accountId}`);
    }

    const idempotencyKey = input.message.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await this.findServiceMessageByIdempotencyKey({
        accountId: input.accountId,
        conversationId: input.conversationId,
        idempotencyKey,
      });
      if (existing) {
        return existing;
      }
    }

    const message = await this.createMessage({
      accountId: input.accountId,
      conversationId: input.conversationId,
      direction: 'outbound',
      senderId: `openclaw:${input.accountId}`,
      senderName: 'OpenClaw',
      text: input.message.text ?? '',
      replyToMessageId: input.message.replyToMessageId ?? null,
      attachments: input.message.attachments,
      metadata: idempotencyKey ? { idempotencyKey } : undefined,
    });
    const state = await this.stateStore.read();
    await this.broadcast(this.buildUserMessageEnvelope(state, conversation, message), { role: 'user', conversationId: message.conversationId });
    return message;
  }

  private async assertAdminToken(tokenHeader: string | string[] | undefined): Promise<void> {
    const state = await this.stateStore.read();
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!state.adminToken || token !== state.adminToken) {
      throw new HttpError(401, 'Invalid admin token');
    }
  }

  private async assertServiceTokenValue(tokenHeader: string | string[] | undefined, accountId = 'default'): Promise<void> {
    const state = await this.stateStore.read();
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    const expected = state.serviceTokens[accountId];
    if (!token) {
      throw new HttpError(401, `Service token required for account ${accountId}`);
    }
    if (!expected || token !== expected) {
      throw new HttpError(401, `Invalid service token for account ${accountId}`);
    }
  }

  private async assertServiceToken(request: http.IncomingMessage, accountId = 'default'): Promise<void> {
    this.assertServiceNetworkAccess(request);
    await this.assertServiceTokenValue(this.readBearerToken(request), accountId);
  }

  private async assertPairingAccess(request: http.IncomingMessage, accountId = 'default'): Promise<void> {
    const adminToken = this.readHeader(request, 'x-trix-admin-token');
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }
    await this.assertServiceToken(request, accountId);
  }

  private async resolveClientContext(conversationId: string, token: string | undefined): Promise<{
    conversation: ConversationRecord;
    participant: ConversationRecord['participants'][number];
  }> {
    const state = await this.stateStore.read();
    const conversation = state.conversations.find((entry) => entry.id === conversationId);
    if (!conversation) {
      throw new HttpError(404, 'Conversation not found');
    }
    const participant = conversation.participants.find((entry) => entry.clientToken && entry.clientToken === token);
    if (!participant) {
      throw new HttpError(401, 'Invalid client token');
    }
    return { conversation, participant };
  }

  private async assertClientToken(conversationId: string, token: string | undefined): Promise<void> {
    await this.resolveClientContext(conversationId, token);
  }

  private async assertConversationAccess(request: http.IncomingMessage, conversationId: string): Promise<void> {
    const adminToken = this.readHeader(request, 'x-trix-admin-token');
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const token = this.readHeader(request, 'x-trix-client-token');
    await this.assertClientToken(conversationId, token);
  }

  private async assertStudyRoomAccess(request: http.IncomingMessage): Promise<void> {
    const adminToken = this.readHeader(request, 'x-trix-admin-token');
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const conversationId = this.readHeader(request, 'x-trix-conversation-id');
    if (!conversationId) {
      throw new HttpError(400, 'Conversation id required for study room access');
    }

    const token = this.readHeader(request, 'x-trix-client-token');
    await this.assertClientToken(conversationId, token);
  }

  private async assertAttachmentUploadAccess(request: http.IncomingMessage): Promise<void> {
    const adminToken = this.readHeader(request, 'x-trix-admin-token');
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const conversationId = this.readHeader(request, 'x-trix-conversation-id');
    if (!conversationId) {
      throw new HttpError(400, 'Conversation id required for attachment upload');
    }

    const token = this.readHeader(request, 'x-trix-client-token');
    await this.assertClientToken(conversationId, token);
  }

  private async unpairClient(clientId: string, token: string | undefined): Promise<void> {
    if (!token) {
      throw new HttpError(401, 'Client token required');
    }

    let closedConversationId: string | undefined;

    await this.stateStore.update((state) => {
      let matched = false;
      const now = Date.now();
      const conversations = state.conversations.map((conversation) => {
        const hasParticipant = conversation.participants.some((participant) =>
          participant.clientId === clientId && participant.clientToken === token,
        );
        if (!hasParticipant) {
          return conversation;
        }

        matched = true;
        closedConversationId = conversation.id;
        return {
          ...conversation,
          updatedAt: now,
          participants: conversation.participants.filter((participant) =>
            !(participant.clientId === clientId && participant.clientToken === token),
          ),
        };
      });

      if (!matched) {
        throw new HttpError(401, 'Invalid client token');
      }

      return {
        ...state,
        conversations,
      };
    });

    for (const [socket, meta] of this.sockets.entries()) {
      if (meta.role === 'user' && meta.clientId === clientId && (!closedConversationId || meta.conversationId === closedConversationId)) {
        socket.close(1000, 'pairing removed');
      }
    }
  }

  private async getConversation(conversationId: string): Promise<ConversationRecord | undefined> {
    const state = await this.stateStore.read();
    return state.conversations.find((entry) => entry.id === conversationId);
  }

  private async findServiceMessageByIdempotencyKey(params: {
    accountId: string;
    conversationId: string;
    idempotencyKey: string;
  }): Promise<MessageRecord | undefined> {
    const state = await this.stateStore.read();
    return state.messages.find((entry) =>
      entry.accountId === params.accountId
      && entry.conversationId === params.conversationId
      && entry.senderId === `openclaw:${params.accountId}`
      && entry.metadata?.idempotencyKey === params.idempotencyKey,
    );
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private buildAttachmentSignature(
    state: NativeChannelState,
    params: {
      attachment: AttachmentDescriptor;
      audience: 'user' | 'service';
      expiresAt: number;
    },
  ): string {
    const payload = [
      params.audience,
      params.attachment.id,
      params.attachment.accountId ?? '',
      params.attachment.conversationId ?? '',
      String(params.expiresAt),
    ].join(':');
    return crypto.createHmac('sha256', state.attachmentSigningSecret).update(payload).digest('hex');
  }

  private buildSignedAttachmentUrl(
    state: NativeChannelState,
    params: {
      attachment: AttachmentDescriptor;
      audience: 'user' | 'service';
    },
  ): string {
    const expiresAt = Date.now() + ATTACHMENT_URL_TTL_MS;
    const signature = this.buildAttachmentSignature(state, {
      attachment: params.attachment,
      audience: params.audience,
      expiresAt,
    });
    const basePath = params.audience === 'service'
      ? `/api/service/attachments/${params.attachment.id}`
      : `/api/attachments/${params.attachment.id}`;
    const url = new URL(basePath, `${this.publicBaseUrl.replace(/\/$/, '')}/`);
    url.searchParams.set('exp', String(expiresAt));
    url.searchParams.set('sig', signature);
    return url.toString();
  }

  private hasValidAttachmentSignature(
    request: http.IncomingMessage,
    state: NativeChannelState,
    params: {
      attachment: AttachmentDescriptor;
      audience: 'user' | 'service';
    },
  ): boolean {
    const url = parseUrl(request);
    const expiresAt = Number(url.searchParams.get('exp') ?? '');
    const signature = url.searchParams.get('sig') ?? '';
    if (!Number.isFinite(expiresAt) || !signature || expiresAt < Date.now()) {
      return false;
    }

    const expected = this.buildAttachmentSignature(state, {
      attachment: params.attachment,
      audience: params.audience,
      expiresAt,
    });
    return this.safeCompare(expected, signature);
  }

  private materializeAttachment(
    attachment: AttachmentDescriptor,
    context: { accountId: string; conversationId?: string },
  ): AttachmentDescriptor {
    return {
      ...attachment,
      accountId: attachment.accountId ?? context.accountId,
      conversationId: attachment.conversationId ?? context.conversationId,
    };
  }

  private serializeAttachmentForUser(
    state: NativeChannelState,
    context: { accountId: string; conversationId?: string },
    attachment: AttachmentDescriptor,
  ) {
    const scoped = this.materializeAttachment(attachment, context);
    return {
      id: scoped.id,
      kind: scoped.kind,
      mimeType: scoped.mimeType,
      fileName: scoped.fileName,
      sizeBytes: scoped.sizeBytes,
      publicUrl: this.buildSignedAttachmentUrl(state, {
        attachment: scoped,
        audience: 'user',
      }),
      width: scoped.width,
      height: scoped.height,
      durationMs: scoped.durationMs,
    };
  }

  private serializeAttachmentForService(
    state: NativeChannelState,
    context: { accountId: string; conversationId?: string },
    attachment: AttachmentDescriptor,
  ) {
    const scoped = this.materializeAttachment(attachment, context);
    const signedUrl = this.buildSignedAttachmentUrl(state, {
      attachment: scoped,
      audience: 'service',
    });
    return {
      id: scoped.id,
      kind: scoped.kind,
      mimeType: scoped.mimeType,
      fileName: scoped.fileName,
      sizeBytes: scoped.sizeBytes,
      publicUrl: signedUrl,
      url: signedUrl,
      width: scoped.width,
      height: scoped.height,
      durationMs: scoped.durationMs,
    };
  }

  private serializeMessageForUser(
    state: NativeChannelState,
    conversation: ConversationRecord,
    message: MessageRecord,
  ) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      text: message.text,
      attachments: message.attachments.map((attachment) =>
        this.serializeAttachmentForUser(state, {
          accountId: conversation.accountId,
          conversationId: conversation.id,
        }, attachment)),
      senderId: message.senderId,
      senderName: message.senderName,
      createdAt: message.createdAt,
      replyToMessageId: message.replyToMessageId ?? null,
      metadata: message.metadata,
    };
  }

  private serializeMessageForService(
    state: NativeChannelState,
    conversation: ConversationRecord,
    message: MessageRecord,
  ) {
    return {
      id: message.id,
      accountId: message.accountId,
      conversationId: message.conversationId,
      direction: message.direction,
      text: message.text,
      attachments: message.attachments.map((attachment) =>
        this.serializeAttachmentForService(state, {
          accountId: conversation.accountId,
          conversationId: conversation.id,
        }, attachment)),
      senderId: message.senderId,
      senderName: message.senderName,
      createdAt: message.createdAt,
      replyToMessageId: message.replyToMessageId ?? null,
      metadata: message.metadata,
    };
  }

  private async assertAttachmentReadAccess(
    request: http.IncomingMessage,
    state: NativeChannelState,
    attachment: AttachmentDescriptor,
    isServicePath: boolean,
  ): Promise<void> {
    const audience = isServicePath ? 'service' : 'user';
    if (this.hasValidAttachmentSignature(request, state, { attachment, audience })) {
      return;
    }

    const adminToken = this.readHeader(request, 'x-trix-admin-token');
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const bearerToken = this.readBearerToken(request);
    if (bearerToken && isServicePath) {
      await this.assertServiceTokenValue(bearerToken, attachment.accountId ?? 'default');
      return;
    }

    const clientToken = this.readHeader(request, 'x-trix-client-token');
    if (clientToken && attachment.conversationId) {
      await this.assertClientToken(attachment.conversationId, clientToken);
      return;
    }

    throw new HttpError(401, 'Signed attachment URL or valid token required');
  }

  private buildUserMessageEnvelope(
    state: NativeChannelState,
    conversation: ConversationRecord,
    message: MessageRecord,
  ): ClientEnvelope {
    return {
      type: 'message.created',
      payload: {
        conversationId: conversation.id,
        message: this.serializeMessageForUser(state, conversation, message),
        agentOnline: this.isServiceOnline(conversation.accountId),
      },
    };
  }

  private buildServiceMessageEnvelope(
    state: NativeChannelState,
    conversation: ConversationRecord,
    message: MessageRecord,
  ): ClientEnvelope {
    const serializedAttachments = message.attachments.map((attachment) =>
      this.serializeAttachmentForService(state, {
        accountId: conversation.accountId,
        conversationId: conversation.id,
      }, attachment));
    return {
      type: 'message.created',
      payload: {
        accountId: conversation.accountId,
        conversationId: conversation.id,
        chatType: 'direct',
        peer: {
          id: conversation.peerId,
          displayName: conversation.peerDisplayName ?? conversation.peerId,
        },
        message: {
          id: message.id,
          text: message.text,
          replyToMessageId: message.replyToMessageId ?? null,
          attachments: serializedAttachments.map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes,
            url: attachment.url,
          })),
          timestamp: message.createdAt,
        },
      },
    };
  }

  private async handleSocket(
    socket: WebSocket,
    request: http.IncomingMessage,
    pathname: string,
    searchParams: URLSearchParams,
  ): Promise<void> {
    let role = (searchParams.get('role') as SocketMeta['role'] | null) ?? 'user';
    const accountId = this.resolveAccountId(searchParams);
    if (pathname === '/api/service/ws') {
      role = 'service';
      await this.assertServiceToken(request, accountId);
    } else if (role === 'agent') {
      if (!this.enableLegacyAgentWs) {
        throw new HttpError(403, 'Legacy agent websocket disabled; use /api/service/ws');
      }
      if (searchParams.get('serviceToken')) {
        await this.assertServiceTokenValue(searchParams.get('serviceToken') ?? undefined, accountId);
      } else {
        await this.assertAdminToken(searchParams.get('adminToken') ?? undefined);
      }
      role = 'service';
    }

    const conversationId = searchParams.get('conversationId') ?? undefined;
    const clientId = searchParams.get('clientId') ?? undefined;
    if (role === 'user') {
      if (!conversationId) {
        throw new HttpError(400, 'conversationId required');
      }
      await this.assertClientToken(conversationId, searchParams.get('clientToken') ?? undefined);
    }

    this.sockets.set(socket, {
      role,
      accountId,
      conversationId,
      clientId,
    });

    // 响应客户端 ping，保持连接活跃
    socket.on('ping', () => {
      socket.pong();
    });

    socket.send(
      JSON.stringify({
        type: 'connected',
        payload: {
          role,
          accountId,
          conversationId,
          agentOnline: this.isServiceOnline(accountId),
        },
      } satisfies ClientEnvelope<{ role: SocketMeta['role']; accountId?: string; conversationId?: string; agentOnline: boolean }>),
    );

    if (role === 'service') {
      await this.broadcast({ type: 'agent.status', payload: { online: true } }, { role: 'user' });
    }

    socket.on('close', () => {
      const closingMeta = this.sockets.get(socket);
      this.sockets.delete(socket);
      if (closingMeta?.role === 'service' && !this.isServiceOnline(closingMeta.accountId)) {
        void this.broadcast({ type: 'agent.status', payload: { online: false } }, { role: 'user' });
      }
    });
  }

  private async broadcast(envelope: ClientEnvelope, target: { accountId?: string; conversationId?: string; role?: SocketMeta['role'] }): Promise<void> {
    const data = JSON.stringify(envelope);
    for (const [socket, meta] of this.sockets.entries()) {
      if (target.role && meta.role !== target.role) {
        continue;
      }
      if (target.accountId && meta.accountId !== target.accountId) {
        continue;
      }
      if (target.conversationId && meta.role === 'user' && meta.conversationId !== target.conversationId) {
        continue;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    }
  }

  private isServiceOnline(accountId?: string): boolean {
    for (const meta of this.sockets.values()) {
      if (meta.role === 'service' && (!accountId || meta.accountId === accountId)) {
        return true;
      }
    }
    return false;
  }

  private findAttachmentById(state: NativeChannelState, attachmentId: string): AttachmentDescriptor | undefined {
    return state.uploads.find((entry) => entry.id === attachmentId)
      ?? state.messages.flatMap((entry) => entry.attachments).find((entry) => entry.id === attachmentId);
  }

  // ============================================================
  // Study Room Methods
  // ============================================================

  private async createStudyRoom(input: { userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }): Promise<StudyRoom> {
    const roomCode = randomId('room', 6).toUpperCase();
    const now = Date.now();

    const room: StudyRoom = {
      roomCode,
      hostUserId: input.userId,
      sessionState: 'idle',
      members: [{
        userId: input.userId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        joinedAt: now,
        lastActiveAt: now,
        status: 'online',
      }],
      maxMembers: input.maxMembers ?? 10,
      version: 1,
      createdAt: now,
      updatedAt: now,
      timer: null,
    };

    await this.stateStore.update((state) => ({
      ...state,
      studyRooms: [...(state.studyRooms || []), room],
    }));

    // Broadcast room state event
    await this.broadcastStudyRoomEvent({
      roomCode,
      reason: 'created',
      room,
      serverTs: now,
    });

    return room;
  }

  private async getStudyRoom(roomCode: string): Promise<StudyRoom | null> {
    const state = await this.stateStore.read();
    return state.studyRooms.find((r) => r.roomCode === roomCode) ?? null;
  }

  private async joinStudyRoom(roomCode: string, input: { userId: string; displayName: string; avatarUrl?: string }): Promise<StudyRoom | null> {
    const state = await this.stateStore.read();
    const roomIndex = state.studyRooms.findIndex((r) => r.roomCode === roomCode);

    if (roomIndex === -1) {
      return null;
    }

    const now = Date.now();
    const currentRoom = state.studyRooms[roomIndex];
    if (!currentRoom) {
      return null;
    }
    const room: StudyRoom = {
      ...currentRoom,
      members: currentRoom.members.map((member) => ({ ...member })),
    };

    // Check if already a member
    const existingMemberIndex = room.members.findIndex((m) => m.userId === input.userId);
    if (existingMemberIndex >= 0) {
      // Update existing member status
      const currentMember = room.members[existingMemberIndex];
      if (!currentMember) {
        throw new Error('Study room member missing');
      }
      room.members[existingMemberIndex] = {
        ...currentMember,
        lastActiveAt: now,
        status: 'online',
      };
    } else {
      // Add new member
      if (room.members.length >= room.maxMembers) {
        throw new Error('Room is full');
      }
      room.members.push({
        userId: input.userId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        joinedAt: now,
        lastActiveAt: now,
        status: 'online',
      });
    }

    room.version++;
    room.updatedAt = now;

    await this.stateStore.update((s) => ({
      ...s,
      studyRooms: [
        ...s.studyRooms.slice(0, roomIndex),
        room,
        ...s.studyRooms.slice(roomIndex + 1),
      ],
    }));

    // Broadcast room state event
    await this.broadcastStudyRoomEvent({
      roomCode,
      reason: 'member_joined',
      room,
      serverTs: now,
    });

    return room;
  }

  private async leaveStudyRoom(roomCode: string, userId: string): Promise<void> {
    const state = await this.stateStore.read();
    const roomIndex = state.studyRooms.findIndex((r) => r.roomCode === roomCode);

    if (roomIndex === -1) {
      return;
    }

    const now = Date.now();
    const currentRoom = state.studyRooms[roomIndex];
    if (!currentRoom) {
      return;
    }
    const room: StudyRoom = {
      ...currentRoom,
      members: currentRoom.members.map((member) => ({ ...member })),
    };

    room.members = room.members.filter((m) => m.userId !== userId);
    room.version++;
    room.updatedAt = now;

    // If no members left or host left, delete the room
    if (room.members.length === 0 || room.hostUserId === userId) {
      await this.deleteStudyRoom(roomCode);
      return;
    }

    await this.stateStore.update((s) => ({
      ...s,
      studyRooms: [
        ...s.studyRooms.slice(0, roomIndex),
        room,
        ...s.studyRooms.slice(roomIndex + 1),
      ],
    }));

    // Broadcast room state event
    await this.broadcastStudyRoomEvent({
      roomCode,
      reason: 'member_left',
      room,
      serverTs: now,
    });
  }

  private async studyRoomHostAction(
    roomCode: string,
    input: { userId: string; action: 'start_focus' | 'pause' | 'end'; durationMinutes?: number },
  ): Promise<StudyRoom | null> {
    const state = await this.stateStore.read();
    const roomIndex = state.studyRooms.findIndex((r) => r.roomCode === roomCode);

    if (roomIndex === -1) {
      return null;
    }

    const currentRoom = state.studyRooms[roomIndex];
    if (!currentRoom) {
      return null;
    }
    const room: StudyRoom = {
      ...currentRoom,
      members: currentRoom.members.map((member) => ({ ...member })),
      timer: currentRoom.timer ? { ...currentRoom.timer } : null,
    };

    // Only host can perform actions
    if (room.hostUserId !== input.userId) {
      throw new Error('Only host can perform this action');
    }

    const now = Date.now();

    switch (input.action) {
      case 'start_focus':
        const durationMinutes = Math.max(1, Math.min(180, Math.floor(input.durationMinutes ?? 25)));
        const durationSeconds = durationMinutes * 60;
        room.sessionState = 'focusing';
        room.timer = {
          durationSeconds,
          startedAt: now,
          endsAt: now + (durationSeconds * 1000),
          remainingSeconds: durationSeconds,
        };
        // Update all members to focusing status
        room.members.forEach((m) => {
          m.status = 'focusing';
          m.lastActiveAt = now;
        });
        break;

      case 'pause':
        if (room.sessionState === 'focusing' && room.timer) {
          room.sessionState = 'resting';
          // Update all members to resting status
          room.members.forEach((m) => {
            m.status = 'resting';
            m.lastActiveAt = now;
          });
        }
        break;

      case 'end':
        room.sessionState = 'idle';
        room.timer = null;
        // Update all members to online status
        room.members.forEach((m) => {
          m.status = 'online';
          m.lastActiveAt = now;
        });
        break;
    }

    room.version++;
    room.updatedAt = now;

    await this.stateStore.update((s) => ({
      ...s,
      studyRooms: [
        ...s.studyRooms.slice(0, roomIndex),
        room,
        ...s.studyRooms.slice(roomIndex + 1),
      ],
    }));

    // Broadcast room state event
    await this.broadcastStudyRoomEvent({
      roomCode,
      reason: 'state_changed',
      room,
      serverTs: now,
    });

    return room;
  }

  private async deleteStudyRoom(roomCode: string): Promise<void> {
    const state = await this.stateStore.read();
    const roomIndex = state.studyRooms.findIndex((r) => r.roomCode === roomCode);

    if (roomIndex === -1) {
      return;
    }

    const room = state.studyRooms[roomIndex];
    if (!room) {
      return;
    }

    await this.stateStore.update((s) => ({
      ...s,
      studyRooms: s.studyRooms.filter((r) => r.roomCode !== roomCode),
    }));

    // Broadcast room deleted event
    await this.broadcastStudyRoomEvent({
      roomCode,
      reason: 'deleted',
      room: null,
      serverTs: Date.now(),
    });
  }

  private async lookupStudyRoomsByUsers(userIds: string[]): Promise<{ users: Array<{
    userId: string;
    inRoom: boolean;
    roomCode?: string;
    sessionState?: string;
    memberCount?: number;
  }> }> {
    const state = await this.stateStore.read();
    const rooms = state.studyRooms ?? [];

    const results = userIds.map((userId) => {
      const room = rooms.find((r) =>
        r.members.some((m) => m.userId === userId),
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

    return { users: results };
  }

  private async broadcastStudyRoomEvent(event: StudyRoomStateEvent): Promise<void> {
    await this.broadcast(
      { type: 'study_room_state', payload: event },
      { role: 'user' }
    );
  }
}

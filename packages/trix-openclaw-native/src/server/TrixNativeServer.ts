import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  ServiceCreateMessageInput,
  ServerConfig,
  StudyRoom,
  StudyRoomAckPayload,
  StudyRoomStateEvent,
  UserCreateMessageInput,
} from '../types.js';
import { randomId, randomToken } from '../utils/ids.js';
import { buildPublicBaseUrl } from '../utils/network.js';
import { parseUrl, readBinaryBody, readJsonBody, sendJson, sendNoContent } from '../utils/http.js';

type SocketMeta = {
  role: 'user' | 'service' | 'agent';
  accountId?: string;
  conversationId?: string;
  clientId?: string;
};

export class TrixNativeServer {
  readonly stateStore: JsonStateStore;
  private readonly host: string;
  private readonly port: number;
  private readonly storageDir: string;
  private readonly publicBaseUrl: string;
  private readonly pairingService: PairingService;
  private readonly attachmentStore: AttachmentStore;
  private readonly server: http.Server;
  private readonly wss: WebSocketServer;
  private readonly sockets = new Map<WebSocket, SocketMeta>();

  constructor(config: ServerConfig = {}) {
    this.host = config.host ?? '0.0.0.0';
    this.port = config.port ?? 8788;
    this.storageDir = path.resolve(config.storageDir ?? path.join(process.cwd(), '.trix-native-channel'));
    this.publicBaseUrl = buildPublicBaseUrl(this.host, this.port, config.publicBaseUrl ?? process.env.TRIX_NATIVE_PUBLIC_BASE_URL);
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
          ws.close(1011, String(error));
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
      adminToken: state.adminToken || process.env.TRIX_NATIVE_ADMIN_TOKEN || randomToken(24),
      serviceTokens: {
        default: state.serviceTokens.default || process.env.TRIX_NATIVE_SERVICE_TOKEN || randomToken(32),
        ...state.serviceTokens,
      },
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

  async createPairing(input: { accountId?: string; label?: string; ttlMs?: number; openClawSessionKey?: string } = {}): Promise<unknown> {
    return this.pairingService.create({
      ...input,
      accountId: input.accountId ?? 'default',
      publicBaseUrl: this.publicBaseUrl,
    });
  }

  private getUserWebSocketUrl(): string {
    return `${this.publicBaseUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws`;
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
        await this.assertPairingAccess(request, this.resolveAccountId(url.searchParams));
        const pairings = await this.pairingService.list();
        sendJson(response, 200, pairings);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/pairings') {
        const body = await readJsonBody<{ accountId?: string; label?: string; ttlMs?: number; openClawSessionKey?: string }>(request);
        const accountId = body.accountId ?? this.resolveAccountId(url.searchParams);
        await this.assertPairingAccess(request, accountId);
        const pairing = await this.createPairing(body);
        sendJson(response, 201, pairing);
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
        sendJson(response, 200, pairing);
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
        const body = await readJsonBody<{ secret?: string; clientId: string; deviceName?: string }>(request);
        const result = await this.pairingService.claim(
          {
            code: pairingClaimMatch[1]!,
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
        await this.broadcast(
          {
            type: 'pairing.updated',
            payload: { ...result, agentOnline: this.isServiceOnline() },
          },
          { role: 'service' },
        );
        sendJson(response, 200, { ...result, serverUrl: this.publicBaseUrl, agentOnline: this.isServiceOnline() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/uploads') {
        await this.assertAttachmentUploadAccess(request);
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
        });
        await this.stateStore.update((state) => ({
          ...state,
          uploads: [upload.attachment, ...state.uploads.filter((entry) => entry.id !== upload.attachment.id)],
        }));
        sendJson(response, 201, upload);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/service/uploads') {
        const accountId = this.resolveAccountId(url.searchParams);
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
        });
        await this.stateStore.update((state) => ({
          ...state,
          uploads: [upload.attachment, ...state.uploads.filter((entry) => entry.id !== upload.attachment.id)],
        }));
        sendJson(response, 201, upload);
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
        const body = await readJsonBody<UserCreateMessageInput>(request);
        const message = await this.createUserMessage(body);
        sendJson(response, 201, { message });
        return;
      }

      if (request.method === 'POST' && (url.pathname === '/api/service/messages' || url.pathname === '/api/messages/service/messages')) {
        const body = await readJsonBody<ServiceCreateMessageInput>(request);
        const accountId = body.accountId ?? this.resolveAccountId(url.searchParams);
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
        const messages = state.messages.filter((entry) => entry.conversationId === conversation.id);
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
        const messages = state.messages.filter((entry) => entry.conversationId === conversationMessagesMatch[1]);
        sendJson(response, 200, { messages, agentOnline: this.isServiceOnline() });
        return;
      }

      // GET /api/messages/:conversationId (legacy)
      const legacyMessagesMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
      if (request.method === 'GET' && legacyMessagesMatch) {
        await this.assertConversationAccess(request, legacyMessagesMatch[1]!);
        const state = await this.stateStore.read();
        const messages = state.messages.filter((entry) => entry.conversationId === legacyMessagesMatch[1]);
        sendJson(response, 200, { messages, agentOnline: this.isServiceOnline() });
        return;
      }

      // ============================================================
      // Study Room HTTP Endpoints
      // ============================================================

      // POST /api/study-rooms - Create a study room
      if (request.method === 'POST' && url.pathname === '/api/study-rooms') {
        const body = await readJsonBody<{ userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }>(request);
        const room = await this.createStudyRoom(body);
        sendJson(response, 201, { success: true, room } as StudyRoomAckPayload);
        return;
      }

      // GET /api/study-rooms - List all study rooms
      if (request.method === 'GET' && url.pathname === '/api/study-rooms') {
        const state = await this.stateStore.read();
        sendJson(response, 200, { success: true, rooms: state.studyRooms });
        return;
      }

      // GET /api/study-rooms/:roomCode - Get a specific study room
      const getRoomMatch = url.pathname.match(/^\/api\/study-rooms\/([^/]+)$/);
      if (request.method === 'GET' && getRoomMatch) {
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
        const roomCode = url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/leave$/)![1]!;
        const body = await readJsonBody<{ userId: string }>(request);
        await this.leaveStudyRoom(roomCode, body.userId);
        sendJson(response, 200, { success: true } as StudyRoomAckPayload);
        return;
      }

      // POST /api/study-rooms/:roomCode/action - Host action (start_focus, pause, end)
      if (request.method === 'POST' && url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/action$/)) {
        const roomCode = url.pathname.match(/^\/api\/study-rooms\/([^/]+)\/action$/)![1]!;
        const body = await readJsonBody<{ userId: string; action: 'start_focus' | 'pause' | 'end' }>(request);
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
        await this.deleteStudyRoom(getRoomMatch[1]!);
        sendJson(response, 200, { success: true } as StudyRoomAckPayload);
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const inlineAttachments = input.attachments ?? [];
    const persistedInlineAttachments = [] as AttachmentDescriptor[];

    for (const attachment of inlineAttachments) {
      persistedInlineAttachments.push(await this.attachmentStore.saveFromInput(attachment));
    }

    let createdMessage: MessageRecord | undefined;
    const now = Date.now();

    await this.stateStore.update((state) => {
      const conversation = state.conversations.find((entry) => entry.id === input.conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${input.conversationId}`);
      }

      const uploadedAttachments = (input.uploadedAttachmentIds ?? []).map((attachmentId) => {
        const attachment = state.uploads.find((entry) => entry.id === attachmentId);
        if (!attachment) {
          throw new Error(`Uploaded attachment not found: ${attachmentId}`);
        }
        return attachment;
      });

      createdMessage = {
        id: randomId('msg', 8),
        accountId: input.accountId ?? conversation.accountId,
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
    await this.broadcast({ type: 'message.created', payload: { message } }, { role: 'user', conversationId: message.conversationId });
    await this.broadcast(this.buildServiceMessageEnvelope(conversation, message), { role: 'service', accountId: conversation.accountId });
    return message;
  }

  private async createServiceMessage(input: ServiceCreateMessageInput & { accountId: string }): Promise<MessageRecord> {
    const conversation = await this.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${input.conversationId}`);
    }
    if (conversation.accountId !== input.accountId) {
      throw new Error(`Conversation ${input.conversationId} does not belong to account ${input.accountId}`);
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
    await this.broadcast({ type: 'message.created', payload: { message } }, { role: 'user', conversationId: message.conversationId });
    return message;
  }

  private async assertAdminToken(tokenHeader: string | string[] | undefined): Promise<void> {
    const state = await this.stateStore.read();
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!state.adminToken || token !== state.adminToken) {
      throw new Error('Invalid admin token');
    }
  }

  private async assertServiceTokenValue(tokenHeader: string | string[] | undefined, accountId = 'default'): Promise<void> {
    const state = await this.stateStore.read();
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    const expected = state.serviceTokens[accountId];
    if (!expected || token !== expected) {
      throw new Error(`Invalid service token for account ${accountId}`);
    }
  }

  private async assertServiceToken(request: http.IncomingMessage, accountId = 'default'): Promise<void> {
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
      throw new Error('Conversation not found');
    }
    const participant = conversation.participants.find((entry) => entry.clientToken && entry.clientToken === token);
    if (!participant) {
      throw new Error('Invalid client token');
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

    const conversation = await this.getConversation(conversationId);
    if (this.readBearerToken(request)) {
      await this.assertServiceToken(request, conversation?.accountId ?? 'default');
      return;
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

    if (this.readBearerToken(request)) {
      await this.assertServiceToken(request);
      return;
    }

    const conversationId = this.readHeader(request, 'x-trix-conversation-id');
    if (!conversationId) {
      throw new Error('Conversation id required for attachment upload');
    }

    const token = this.readHeader(request, 'x-trix-client-token');
    await this.assertClientToken(conversationId, token);
  }

  private async unpairClient(clientId: string, token: string | undefined): Promise<void> {
    if (!token) {
      throw new Error('Client token required');
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
        throw new Error('Invalid client token');
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

  private buildServiceMessageEnvelope(conversation: ConversationRecord, message: MessageRecord): ClientEnvelope {
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
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes,
            url: attachment.publicUrl ?? `${this.publicBaseUrl}/api/service/attachments/${attachment.id}`,
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
        throw new Error('conversationId required');
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
      room.members[existingMemberIndex] = {
        ...room.members[existingMemberIndex],
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

  private async studyRoomHostAction(roomCode: string, input: { userId: string; action: 'start_focus' | 'pause' | 'end' }): Promise<StudyRoom | null> {
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
        room.sessionState = 'focusing';
        room.timer = {
          durationSeconds: 25 * 60, // 25 minutes (Pomodoro)
          startedAt: now,
          endsAt: now + (25 * 60 * 1000),
          remainingSeconds: 25 * 60,
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

  private async broadcastStudyRoomEvent(event: StudyRoomStateEvent): Promise<void> {
    await this.broadcast(
      { type: 'study_room_state', payload: event },
      { role: 'user' }
    );
  }
}

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
  CreateMessageInput,
  MessageRecord,
  NativeChannelState,
  ServerConfig,
  StudyRoom,
  StudyRoomAckPayload,
  StudyRoomStateEvent,
} from '../types.js';
import { randomId, randomToken } from '../utils/ids.js';
import { buildPublicBaseUrl } from '../utils/network.js';
import { parseUrl, readBinaryBody, readJsonBody, sendJson, sendNoContent } from '../utils/http.js';

type SocketMeta = {
  role: 'user' | 'agent';
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
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.handleSocket(ws, url.searchParams).catch((error: unknown) => {
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

  async createPairing(input: { label?: string; ttlMs?: number; openClawSessionKey?: string } = {}): Promise<unknown> {
    return this.pairingService.create({
      ...input,
      publicBaseUrl: this.publicBaseUrl,
    });
  }

  private async handleRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    try {
      const url = parseUrl(request);
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { ok: true, baseUrl: this.publicBaseUrl, agentOnline: this.isAgentOnline() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/pairings') {
        await this.assertAdminToken(request.headers['x-trix-admin-token']);
        const pairings = await this.pairingService.list();
        sendJson(response, 200, pairings);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/pairings') {
        await this.assertAdminToken(request.headers['x-trix-admin-token']);
        const body = await readJsonBody<{ label?: string; ttlMs?: number; openClawSessionKey?: string }>(request);
        const pairing = await this.createPairing(body);
        sendJson(response, 201, pairing);
        return;
      }

      const pairingMatch = url.pathname.match(/^\/api\/pairings\/([^/]+)$/);
      if (request.method === 'GET' && pairingMatch) {
        await this.assertAdminToken(request.headers['x-trix-admin-token']);
        const pairing = await this.pairingService.get(pairingMatch[1]!);
        if (!pairing) {
          sendJson(response, 404, { error: 'Pairing not found' });
          return;
        }
        sendJson(response, 200, pairing);
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
          `${this.publicBaseUrl.replace(/^http/i, 'ws')}/ws`,
        );
        await this.broadcast(
          {
            type: 'pairing.updated',
            payload: { ...result, agentOnline: this.isAgentOnline() },
          },
          { role: 'agent' },
        );
        sendJson(response, 200, { ...result, serverUrl: this.publicBaseUrl, agentOnline: this.isAgentOnline() });
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

      const attachmentMatch = url.pathname.match(/^\/api\/attachments\/([^/]+)$/);
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
        const isAgentRequest = Boolean(request.headers['x-trix-admin-token']);
        if (isAgentRequest) {
          await this.assertAdminToken(request.headers['x-trix-admin-token']);
        }
        const body = await readJsonBody<CreateMessageInput>(request);
        if (!isAgentRequest) {
          await this.assertClientToken(body.conversationId, body.clientToken);
        }
        const message = await this.createMessage(body);
        await this.broadcast({ type: 'message.created', payload: { message } }, { conversationId: message.conversationId });
        sendJson(response, 201, { message });
        return;
      }

      const conversationMessagesMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (request.method === 'GET' && conversationMessagesMatch) {
        await this.assertConversationAccess(request, conversationMessagesMatch[1]!);
        const state = await this.stateStore.read();
        const messages = state.messages.filter((entry) => entry.conversationId === conversationMessagesMatch[1]);
        sendJson(response, 200, { messages, agentOnline: this.isAgentOnline() });
        return;
      }

      // GET /api/messages/:conversationId (legacy)
      const legacyMessagesMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
      if (request.method === 'GET' && legacyMessagesMatch) {
        await this.assertConversationAccess(request, legacyMessagesMatch[1]!);
        const state = await this.stateStore.read();
        const messages = state.messages.filter((entry) => entry.conversationId === legacyMessagesMatch[1]);
        sendJson(response, 200, { messages, agentOnline: this.isAgentOnline() });
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
      const uploadedAttachments = (input.uploadedAttachmentIds ?? []).map((attachmentId) => {
        const attachment = state.uploads.find((entry) => entry.id === attachmentId);
        if (!attachment) {
          throw new Error(`Uploaded attachment not found: ${attachmentId}`);
        }
        return attachment;
      });

      createdMessage = {
        id: randomId('msg', 8),
        conversationId: input.conversationId,
        direction: input.direction,
        text: input.text ?? '',
        attachments: [...uploadedAttachments, ...persistedInlineAttachments],
        senderId: input.senderId,
        senderName: input.senderName,
        createdAt: now,
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
                  participant.clientId === input.senderId
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

  private async assertAdminToken(tokenHeader: string | string[] | undefined): Promise<void> {
    const state = await this.stateStore.read();
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!state.adminToken || token !== state.adminToken) {
      throw new Error('Invalid admin token');
    }
  }

  private async assertClientToken(conversationId: string, token: string | undefined): Promise<void> {
    const state = await this.stateStore.read();
    const conversation = state.conversations.find((entry) => entry.id === conversationId);
    const allowed = conversation?.participants.some((entry) => entry.clientToken && entry.clientToken === token);
    if (!allowed) {
      throw new Error('Invalid client token');
    }
  }

  private async assertConversationAccess(request: http.IncomingMessage, conversationId: string): Promise<void> {
    const adminToken = request.headers['x-trix-admin-token'];
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const tokenHeader = request.headers['x-trix-client-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    await this.assertClientToken(conversationId, token);
  }

  private async assertAttachmentUploadAccess(request: http.IncomingMessage): Promise<void> {
    const adminToken = request.headers['x-trix-admin-token'];
    if (adminToken) {
      await this.assertAdminToken(adminToken);
      return;
    }

    const conversationHeader = request.headers['x-trix-conversation-id'];
    const conversationId = Array.isArray(conversationHeader) ? conversationHeader[0] : conversationHeader;
    if (!conversationId) {
      throw new Error('Conversation id required for attachment upload');
    }

    const tokenHeader = request.headers['x-trix-client-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    await this.assertClientToken(conversationId, token);
  }

  private async handleSocket(socket: WebSocket, searchParams: URLSearchParams): Promise<void> {
    const role = (searchParams.get('role') as SocketMeta['role'] | null) ?? 'user';
    if (role === 'agent') {
      await this.assertAdminToken(searchParams.get('adminToken') ?? undefined);
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
          conversationId,
          agentOnline: this.isAgentOnline(),
        },
      } satisfies ClientEnvelope<{ role: SocketMeta['role']; conversationId?: string; agentOnline: boolean }>),
    );

    if (role === 'agent') {
      await this.broadcast({ type: 'agent.status', payload: { online: true } }, { role: 'user' });
    }

    socket.on('close', () => {
      const closingMeta = this.sockets.get(socket);
      this.sockets.delete(socket);
      if (closingMeta?.role === 'agent' && !this.isAgentOnline()) {
        void this.broadcast({ type: 'agent.status', payload: { online: false } }, { role: 'user' });
      }
    });
  }

  private async broadcast(envelope: ClientEnvelope, target: { conversationId?: string; role?: SocketMeta['role'] }): Promise<void> {
    const data = JSON.stringify(envelope);
    for (const [socket, meta] of this.sockets.entries()) {
      if (target.role && meta.role !== target.role) {
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

  private isAgentOnline(): boolean {
    for (const meta of this.sockets.values()) {
      if (meta.role === 'agent') {
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
    const room = state.studyRooms[roomIndex];

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
    const room = state.studyRooms[roomIndex];

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

    const room = state.studyRooms[roomIndex];

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



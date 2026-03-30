import http from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TrixNativeServer } from '../src/server/TrixNativeServer.js';
import type { ServerConfig } from '../src/types.js';

const servers: TrixNativeServer[] = [];
const authServers: http.Server[] = [];

function createTestServer(port: number, config: ServerConfig = {}): TrixNativeServer {
  return new TrixNativeServer({
    port,
    publicBaseUrl: `http://127.0.0.1:${port}`,
    storageDir: path.join(process.cwd(), '.tmp', 'trix-native-tests', `${port}-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    ...config,
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.stop().catch(() => undefined)));
  await Promise.all(authServers.splice(0).map(async (server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

async function createAuthStubServer(port: number): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    if (request.url !== '/auth/v1/user') {
      response.writeHead(404).end();
      return;
    }

    const authorization = request.headers.authorization ?? '';
    if (authorization === 'Bearer valid-user-a') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'user-a' }));
      return;
    }

    if (authorization === 'Bearer valid-user-b') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'user-b' }));
      return;
    }

    response.writeHead(401, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'invalid token' }));
  });

  authServers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return server;
}

describe('TrixNativeServer', () => {
  it('creates pairing and accepts inbound message flow', async () => {
    const server = createTestServer(8799);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const createResponse = await fetch('http://127.0.0.1:8799/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trix-admin-token': state.adminToken,
      },
      body: JSON.stringify({ label: 'Browser' }),
    });

    const pairing = await createResponse.json() as { code: string; conversationId: string };
    expect(pairing.code).toHaveLength(6);

    const claimResponse = await fetch(`http://127.0.0.1:8799/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-1',
        deviceName: 'Browser',
      }),
    });
    const claim = await claimResponse.json() as { accountId: string; conversationId: string; clientToken: string };
    expect(claim.accountId).toBe('default');

    const messageResponse = await fetch('http://127.0.0.1:8799/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'hello multimodal',
      }),
    });
    expect(messageResponse.status).toBe(201);

    const messagesResponse = await fetch(`http://127.0.0.1:8799/api/conversations/${claim.conversationId}/messages`);
    const messagesPayload = await fetch(`http://127.0.0.1:8799/api/conversations/${claim.conversationId}/messages`, {
      headers: {
        'x-trix-client-token': claim.clientToken,
      },
    }).then((response) => response.json()) as { messages: Array<{ text: string }> };
    expect(messagesPayload.messages).toHaveLength(1);
    expect(messagesPayload.messages[0].text).toBe('hello multimodal');
  });

  it('accepts uploaded attachments and serves them back via message records', async () => {
    const server = createTestServer(8800);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const createResponse = await fetch('http://127.0.0.1:8800/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trix-admin-token': state.adminToken,
      },
      body: JSON.stringify({ label: 'Browser' }),
    });
    const pairing = await createResponse.json() as { code: string };

    const claimResponse = await fetch(`http://127.0.0.1:8800/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-2',
        deviceName: 'Browser',
      }),
    });
    const claim = await claimResponse.json() as { conversationId: string; clientToken: string };

    const uploadResponse = await fetch('http://127.0.0.1:8800/api/uploads', {
      method: 'POST',
      headers: {
        'x-file-name': 'deck.pdf',
        'x-mime-type': 'application/pdf',
        'x-attachment-kind': 'file',
        'x-trix-conversation-id': claim.conversationId,
        'x-trix-client-token': claim.clientToken,
      },
      body: Buffer.from('pdf-binary', 'utf8'),
    });
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = await uploadResponse.json() as { attachment: { id: string; publicUrl: string } };

    const messageResponse = await fetch('http://127.0.0.1:8800/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'attached',
        uploadedAttachmentIds: [uploadPayload.attachment.id],
      }),
    });
    expect(messageResponse.status).toBe(201);

    const attachmentResponse = await fetch(uploadPayload.attachment.publicUrl);
    expect(attachmentResponse.status).toBe(200);
    expect(await attachmentResponse.text()).toBe('pdf-binary');

    const unsignedAttachmentResponse = await fetch(`http://127.0.0.1:8800/api/attachments/${encodeURIComponent(uploadPayload.attachment.id)}`);
    expect(unsignedAttachmentResponse.status).toBe(401);
  });

  it('includes servicePath on service websocket attachment events', async () => {
    const server = createTestServer(8804);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8804/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8804/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-attachments-1',
        deviceName: 'Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const uploadPayload = await fetch('http://127.0.0.1:8804/api/uploads', {
      method: 'POST',
      headers: {
        'x-file-name': 'image.png',
        'x-mime-type': 'image/png',
        'x-attachment-kind': 'image',
        'x-trix-conversation-id': claim.conversationId,
        'x-trix-client-token': claim.clientToken,
      },
      body: Buffer.from('png-binary', 'utf8'),
    }).then((response) => response.json()) as { attachment: { id: string } };

    const serviceMessagePromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = new WebSocket('ws://127.0.0.1:8804/api/service/ws?accountId=default', {
        headers: {
          authorization: `Bearer ${state.serviceTokens.default}`,
        },
      });

      socket.once('message', () => {
        // Ignore "connected".
      });

      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw)) as { type?: string };
        if (event.type === 'message.created') {
          const payload = event as { payload?: { message?: { id?: string } } };
          socket.send(JSON.stringify({
            type: 'message.ack',
            payload: {
              accountId: 'default',
              messageId: payload.payload?.message?.id,
            },
          }));
          socket.close();
          resolve(event as Record<string, unknown>);
        }
      });

      socket.once('error', reject);
    });

    await fetch('http://127.0.0.1:8804/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'image inbound',
        uploadedAttachmentIds: [uploadPayload.attachment.id],
      }),
    });

    const serviceEvent = await serviceMessagePromise as {
      payload: {
        message: {
          attachments: Array<{
            id: string;
            servicePath?: string;
          }>;
        };
      };
    };

    expect(serviceEvent.payload.message.attachments).toHaveLength(1);
    expect(serviceEvent.payload.message.attachments[0]?.id).toBe(uploadPayload.attachment.id);
    expect(serviceEvent.payload.message.attachments[0]?.servicePath).toBe(`/api/service/attachments/${uploadPayload.attachment.id}`);
  });

  it('replays pending inbound messages when the service websocket reconnects', async () => {
    const server = createTestServer(8805);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8805/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Replay Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8805/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-replay-1',
        deviceName: 'Replay Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const createMessageResponse = await fetch('http://127.0.0.1:8805/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'replay me after reconnect',
      }),
    });
    expect(createMessageResponse.status).toBe(201);
    const createdMessage = await createMessageResponse.json() as { message: { id: string } };

    const stateAfterCreate = await server.stateStore.read();
    const pendingMessage = stateAfterCreate.messages.find((message) => message.id === createdMessage.message.id);
    expect(pendingMessage?.metadata?.serviceDispatchPending).toBe(true);

    const replayedEvent = await new Promise<{
      payload: {
        conversationId: string;
        message: { id: string; text: string };
      };
    }>((resolve, reject) => {
      const socket = new WebSocket('ws://127.0.0.1:8805/api/service/ws?accountId=default', {
        headers: {
          authorization: `Bearer ${state.serviceTokens.default}`,
        },
      });

      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw)) as { type?: string };
        if (event.type === 'message.created') {
          const payload = event as { payload?: { message?: { id?: string } } };
          socket.send(JSON.stringify({
            type: 'message.ack',
            payload: {
              accountId: 'default',
              messageId: payload.payload?.message?.id,
            },
          }));
          socket.close();
          resolve(event as {
            payload: {
              conversationId: string;
              message: { id: string; text: string };
            };
          });
        }
      });

      socket.once('error', reject);
    });

    expect(replayedEvent.payload.conversationId).toBe(claim.conversationId);
    expect(replayedEvent.payload.message.id).toBe(createdMessage.message.id);
    expect(replayedEvent.payload.message.text).toBe('replay me after reconnect');

    let pendingState: boolean | undefined = true;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const stateAfterReplay = await server.stateStore.read();
      pendingState = stateAfterReplay.messages.find((message) => message.id === createdMessage.message.id)?.metadata?.serviceDispatchPending as boolean | undefined;
      if (pendingState === false) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(pendingState).toBe(false);
    const stateAfterReplay = await server.stateStore.read();
    const deliveredMessage = stateAfterReplay.messages.find((message) => message.id === createdMessage.message.id);
    expect(typeof deliveredMessage?.metadata?.serviceDeliveredAt).toBe('number');
  });

  it('removes a claimed device session when the client unpairs', async () => {
    const server = createTestServer(8802);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8802/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'iPhone' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8802/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'ios-device-1',
        deviceName: 'iPhone',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const unpairResponse = await fetch('http://127.0.0.1:8802/api/pairings/ios-device-1', {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${claim.clientToken}`,
      },
    });
    expect(unpairResponse.status).toBe(204);

    const updatedState = await server.stateStore.read();
    const conversation = updatedState.conversations.find((entry) => entry.id === claim.conversationId);
    expect(conversation?.participants.find((participant) => participant.clientId === 'ios-device-1')).toBeUndefined();
  });

  it('requires a paired native session for study room endpoints', async () => {
    const server = createTestServer(8803);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8803/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8803/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-study-1',
        deviceName: 'Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const unauthorizedListResponse = await fetch('http://127.0.0.1:8803/api/study-rooms');
    expect(unauthorizedListResponse.status).toBe(400);

    const createRoomResponse = await fetch('http://127.0.0.1:8803/api/study-rooms', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trix-conversation-id': claim.conversationId,
        'x-trix-client-token': claim.clientToken,
      },
      body: JSON.stringify({
        userId: 'supabase-user-1',
        displayName: 'Browser',
      }),
    });
    expect(createRoomResponse.status).toBe(201);

    const listResponse = await fetch('http://127.0.0.1:8803/api/study-rooms', {
      headers: {
        'x-trix-conversation-id': claim.conversationId,
        'x-trix-client-token': claim.clientToken,
      },
    });
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json() as { rooms: Array<{ hostUserId: string }> };
    expect(listPayload.rooms[0]?.hostUserId).toBe('supabase-user-1');
  });

  it('lookupStudyRoomsByUsers returns correct room info for each user', async () => {
    const server = createTestServer(8810);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();

    // Create pairing and claim
    const pairing = await fetch('http://127.0.0.1:8810/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((r) => r.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8810/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'browser-study-lookup', deviceName: 'Browser' }),
    }).then((r) => r.json()) as { conversationId: string; clientToken: string };

    const headers = {
      'content-type': 'application/json',
      'x-trix-conversation-id': claim.conversationId,
      'x-trix-client-token': claim.clientToken,
    };

    // Create room as Alice
    const createResponse = await fetch('http://127.0.0.1:8810/api/study-rooms', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: 'alice', displayName: 'Alice' }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { room: { roomCode: string } };
    const roomCode = created.room.roomCode;

    // Join room as Bob
    await fetch(`http://127.0.0.1:8810/api/study-rooms/${roomCode}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: 'bob', displayName: 'Bob' }),
    });

    // Lookup all three users: Alice (in room), Bob (in same room), Charlie (not in any room)
    const lookupResponse = await fetch('http://127.0.0.1:8810/api/study-rooms/lookup-by-users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIds: ['alice', 'bob', 'charlie'] }),
    });

    expect(lookupResponse.status).toBe(200);
    const lookup = await lookupResponse.json() as {
      success: boolean;
      users: Array<{ userId: string; inRoom: boolean; roomCode?: string; memberCount?: number }>;
    };

    expect(lookup.success).toBe(true);
    expect(lookup.users).toHaveLength(3);

    const alice = lookup.users.find((u) => u.userId === 'alice');
    expect(alice?.inRoom).toBe(true);
    expect(alice?.roomCode).toBe(roomCode);
    expect(alice?.memberCount).toBe(2);

    const bob = lookup.users.find((u) => u.userId === 'bob');
    expect(bob?.inRoom).toBe(true);
    expect(bob?.roomCode).toBe(roomCode);

    const charlie = lookup.users.find((u) => u.userId === 'charlie');
    expect(charlie?.inRoom).toBe(false);
  });

  it('lookupStudyRoomsByUsers returns empty array for empty userIds', async () => {
    const server = createTestServer(8811);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();

    const pairing = await fetch('http://127.0.0.1:8811/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((r) => r.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8811/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'browser-lookup-empty', deviceName: 'Browser' }),
    }).then((r) => r.json()) as { conversationId: string; clientToken: string };

    const headers = {
      'content-type': 'application/json',
      'x-trix-conversation-id': claim.conversationId,
      'x-trix-client-token': claim.clientToken,
    };

    const lookupResponse = await fetch('http://127.0.0.1:8811/api/study-rooms/lookup-by-users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userIds: [] }),
    });

    expect(lookupResponse.status).toBe(200);
    const lookup = await lookupResponse.json() as { users: unknown[] };
    expect(lookup.users).toHaveLength(0);
  });

  it('delivers user messages to the service plane and accepts OpenClaw replies', async () => {
    const server = createTestServer(8801);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8801/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8801/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-3',
        deviceName: 'Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const serviceMessagePromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = new WebSocket('ws://127.0.0.1:8801/api/service/ws?accountId=default', {
        headers: {
          authorization: `Bearer ${state.serviceTokens.default}`,
        },
      });

      socket.once('message', () => {
        // Ignore "connected".
      });

      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw)) as { type?: string };
        if (event.type === 'message.created') {
          const payload = event as { payload?: { message?: { id?: string } } };
          socket.send(JSON.stringify({
            type: 'message.ack',
            payload: {
              accountId: 'default',
              messageId: payload.payload?.message?.id,
            },
          }));
          socket.close();
          resolve(event as Record<string, unknown>);
        }
      });

      socket.once('error', reject);
    });

    await fetch('http://127.0.0.1:8801/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'hello from user',
      }),
    });

    const serviceEvent = await serviceMessagePromise as {
      payload: {
        conversationId: string;
        peer: { id: string };
        message: { text: string };
      };
    };
    expect(serviceEvent.payload.conversationId).toBe(claim.conversationId);
    expect(serviceEvent.payload.peer.id).toMatch(/^user_/);
    expect(serviceEvent.payload.message.text).toBe('hello from user');

    const replyResponse = await fetch('http://127.0.0.1:8801/api/service/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({
        accountId: 'default',
        conversationId: claim.conversationId,
        message: {
          idempotencyKey: 'reply-1',
          text: 'hello from bot',
        },
      }),
    });

    expect(replyResponse.status).toBe(201);

    const history = await fetch(`http://127.0.0.1:8801/api/conversations/${claim.conversationId}/messages`, {
      headers: {
        'x-trix-client-token': claim.clientToken,
      },
    }).then((response) => response.json()) as { messages: Array<{ text: string }> };

    expect(history.messages.map((message) => message.text)).toEqual(['hello from user', 'hello from bot']);
  });

  it('marks inbound service dispatch complete when a reply references replyToMessageId', async () => {
    const server = createTestServer(8812);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8812/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Reply Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8812/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-reply-1',
        deviceName: 'Reply Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const inboundResponse = await fetch('http://127.0.0.1:8812/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
        text: 'clear me on reply',
      }),
    });
    expect(inboundResponse.status).toBe(201);
    const inboundPayload = await inboundResponse.json() as { message: { id: string } };

    const createdState = await server.stateStore.read();
    const pendingInbound = createdState.messages.find((message) => message.id === inboundPayload.message.id);
    expect(pendingInbound?.metadata?.serviceDispatchPending).toBe(true);

    const replyResponse = await fetch('http://127.0.0.1:8812/api/service/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({
        accountId: 'default',
        conversationId: claim.conversationId,
        message: {
          idempotencyKey: 'reply-clears-pending',
          text: 'reply delivered',
          replyToMessageId: inboundPayload.message.id,
        },
      }),
    });

    expect(replyResponse.status).toBe(201);

    const finalState = await server.stateStore.read();
    const deliveredInbound = finalState.messages.find((message) => message.id === inboundPayload.message.id);
    expect(deliveredInbound?.metadata?.serviceDispatchPending).toBe(false);
    expect(typeof deliveredInbound?.metadata?.serviceDeliveredAt).toBe('number');
  });

  it('deduplicates concurrent service replies with the same idempotency key', async () => {
    const server = createTestServer(8814);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8814/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Concurrent Reply Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8814/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-concurrent-reply-1',
        deviceName: 'Concurrent Reply Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch('http://127.0.0.1:8814/api/service/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${state.serviceTokens.default}`,
          },
          body: JSON.stringify({
            accountId: 'default',
            conversationId: claim.conversationId,
            message: {
              idempotencyKey: 'reply-concurrent-1',
              text: 'hello from bot once',
            },
          }),
        }),
      ),
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);

    const payloads = await Promise.all(
      responses.map((response) => response.json()),
    ) as Array<{ message: { id: string; text: string } }>;

    expect(new Set(payloads.map((payload) => payload.message.id)).size).toBe(1);
    expect(new Set(payloads.map((payload) => payload.message.text))).toEqual(new Set(['hello from bot once']));

    const finalState = await server.stateStore.read();
    const matchingOutbound = finalState.messages.filter((message) =>
      message.accountId === 'default'
      && message.conversationId === claim.conversationId
      && message.senderId === 'openclaw:default'
      && message.metadata?.idempotencyKey === 'reply-concurrent-1',
    );

    expect(matchingOutbound).toHaveLength(1);
  });

  it('filters pairing inspection by account and strips sensitive claim state', async () => {
    const server = createTestServer(8803);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    await fetch('http://127.0.0.1:8803/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Default Device' }),
    });

    await fetch('http://127.0.0.1:8803/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trix-admin-token': state.adminToken,
      },
      body: JSON.stringify({ accountId: 'secondary', label: 'Secondary Device' }),
    });

    const listResponse = await fetch('http://127.0.0.1:8803/api/pairings?accountId=default', {
      headers: {
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
    });
    expect(listResponse.status).toBe(200);

    const pairings = await listResponse.json() as Array<Record<string, unknown>>;
    expect(pairings).toHaveLength(1);
    expect(pairings[0]?.accountId).toBe('default');
    expect(pairings[0]).not.toHaveProperty('secret');
    expect(pairings[0]).not.toHaveProperty('clientToken');
    expect(pairings[0]).not.toHaveProperty('claimUrl');
    expect(pairings[0]).not.toHaveProperty('qrDataUrl');
  });

  it('rejects pairing claims that specify the wrong account', async () => {
    const server = createTestServer(8808);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8808/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trix-admin-token': state.adminToken,
      },
      body: JSON.stringify({ accountId: 'bot-b', label: 'Bot B Device' }),
    }).then((response) => response.json()) as { code: string };

    const claimResponse = await fetch(`http://127.0.0.1:8808/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountId: 'default',
        clientId: 'browser-account-mismatch',
        deviceName: 'Browser',
      }),
    });

    expect(claimResponse.status).toBe(409);
    const payload = await claimResponse.json() as { error: string };
    expect(payload.error).toContain('Pairing code does not belong to account default');
  });

  it('rejects cross-plane token reuse and expired attachment signatures', async () => {
    const server = createTestServer(8805);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8805/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8805/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-auth-1',
        deviceName: 'Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const crossPlaneServiceResponse = await fetch('http://127.0.0.1:8805/api/service/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${claim.clientToken}`,
      },
      body: JSON.stringify({
        accountId: 'default',
        conversationId: claim.conversationId,
        message: {
          idempotencyKey: 'bad-cross-plane',
          text: 'should fail',
        },
      }),
    });
    expect(crossPlaneServiceResponse.status).toBe(401);

    const crossPlaneUserResponse = await fetch('http://127.0.0.1:8805/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: state.serviceTokens.default,
        text: 'should fail',
      }),
    });
    expect(crossPlaneUserResponse.status).toBe(401);

    const uploadResponse = await fetch('http://127.0.0.1:8805/api/uploads', {
      method: 'POST',
      headers: {
        'x-file-name': 'expiring.png',
        'x-mime-type': 'image/png',
        'x-attachment-kind': 'image',
        'x-trix-conversation-id': claim.conversationId,
        'x-trix-client-token': claim.clientToken,
      },
      body: Buffer.from('png-binary', 'utf8'),
    });
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = await uploadResponse.json() as { attachment: { publicUrl: string } };

    const expiredUrl = new URL(uploadPayload.attachment.publicUrl);
    expiredUrl.searchParams.set('exp', String(Date.now() - 1_000));
    const expiredAttachmentResponse = await fetch(expiredUrl);
    expect(expiredAttachmentResponse.status).toBe(401);
  });

  it('rejects the legacy agent websocket by default', async () => {
    const server = createTestServer(8804);
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:8804/ws?role=agent&accountId=default&serviceToken=${encodeURIComponent(state.serviceTokens.default)}`);
      socket.once('close', (code, reason) => resolve({ code, reason: String(reason) }));
      socket.once('error', reject);
    });

    expect(closeEvent.code).toBe(1008);
    expect(closeEvent.reason).toContain('Legacy agent websocket disabled');
  });

  it('rate limits pairing claims per source IP', async () => {
    const server = createTestServer(8806, {
      rateLimits: {
        claim: { max: 1, windowMs: 60_000 },
      },
    });
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${state.serviceTokens.default}`,
    };

    const pairingOne = await fetch('http://127.0.0.1:8806/api/pairings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId: 'default', label: 'First Browser' }),
    }).then((response) => response.json()) as { code: string };

    const pairingTwo = await fetch('http://127.0.0.1:8806/api/pairings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId: 'default', label: 'Second Browser' }),
    }).then((response) => response.json()) as { code: string };

    const firstClaim = await fetch(`http://127.0.0.1:8806/api/pairings/${pairingOne.code}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.20',
      },
      body: JSON.stringify({
        clientId: 'browser-rate-1',
        deviceName: 'Browser One',
      }),
    });
    expect(firstClaim.status).toBe(200);

    const secondClaim = await fetch(`http://127.0.0.1:8806/api/pairings/${pairingTwo.code}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.20',
      },
      body: JSON.stringify({
        clientId: 'browser-rate-2',
        deviceName: 'Browser Two',
      }),
    });
    expect(secondClaim.status).toBe(429);
  });

  it('supports service endpoint IP allowlists when configured', async () => {
    const server = createTestServer(8807, {
      serviceAllowlist: ['198.51.100.10', '203.0.113.0/24'],
    });
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();

    const rejected = await fetch('http://127.0.0.1:8807/api/service/probe', {
      headers: {
        authorization: `Bearer ${state.serviceTokens.default}`,
        'x-forwarded-for': '192.0.2.88',
      },
    });
    expect(rejected.status).toBe(403);

    const allowedExact = await fetch('http://127.0.0.1:8807/api/service/probe', {
      headers: {
        authorization: `Bearer ${state.serviceTokens.default}`,
        'x-forwarded-for': '198.51.100.10',
      },
    });
    expect(allowedExact.status).toBe(200);

    const allowedCidr = await fetch('http://127.0.0.1:8807/api/service/probe', {
      headers: {
        authorization: `Bearer ${state.serviceTokens.default}`,
        'x-forwarded-for': '203.0.113.45',
      },
    });
    expect(allowedCidr.status).toBe(200);
  });

  it('restores a paired session for the same authenticated app user on another client', async () => {
    await createAuthStubServer(8891);

    const server = createTestServer(8812, {
      supabaseUrl: 'http://127.0.0.1:8891',
      supabaseAnonKey: 'anon-key',
    });
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8812/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8812/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-a',
      },
      body: JSON.stringify({
        clientId: 'browser-user-a-1',
        deviceName: 'Browser A',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const restoreResponse = await fetch('http://127.0.0.1:8812/api/client/session/restore', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-a',
      },
      body: JSON.stringify({
        accountId: 'default',
        clientId: 'browser-user-a-2',
        deviceName: 'Browser B',
      }),
    });

    expect(restoreResponse.status).toBe(200);
    const restored = await restoreResponse.json() as {
      conversationId: string;
      clientToken: string;
      pairingCode?: string;
    };
    expect(restored.conversationId).toBe(claim.conversationId);
    expect(restored.clientToken).not.toBe(claim.clientToken);
    expect(restored.pairingCode).toBe(pairing.code);

    const updatedState = await server.stateStore.read();
    const conversation = updatedState.conversations.find((entry) => entry.id === claim.conversationId);
    expect(conversation?.appUserId).toBe('user-a');
    expect(conversation?.participants.some((participant) => participant.clientId === 'browser-user-a-2')).toBe(true);

    const wrongUserRestore = await fetch('http://127.0.0.1:8812/api/client/session/restore', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-b',
      },
      body: JSON.stringify({
        accountId: 'default',
        clientId: 'browser-user-b-1',
        deviceName: 'Wrong User Browser',
      }),
    });
    expect(wrongUserRestore.status).toBe(404);
  });

  it('binds an existing local paired session to the authenticated app user and blocks cross-user rebinding', async () => {
    await createAuthStubServer(8892);

    const server = createTestServer(8813, {
      supabaseUrl: 'http://127.0.0.1:8892',
      supabaseAnonKey: 'anon-key',
    });
    servers.push(server);
    await server.start();

    const state = await server.stateStore.read();
    const pairing = await fetch('http://127.0.0.1:8813/api/pairings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.serviceTokens.default}`,
      },
      body: JSON.stringify({ accountId: 'default', label: 'Browser' }),
    }).then((response) => response.json()) as { code: string };

    const claim = await fetch(`http://127.0.0.1:8813/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'legacy-browser',
        deviceName: 'Legacy Browser',
      }),
    }).then((response) => response.json()) as { conversationId: string; clientToken: string };

    const bindResponse = await fetch('http://127.0.0.1:8813/api/client/session/bind', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-a',
      },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
      }),
    });
    expect(bindResponse.status).toBe(200);

    let updatedState = await server.stateStore.read();
    expect(updatedState.conversations.find((entry) => entry.id === claim.conversationId)?.appUserId).toBe('user-a');

    const reboundResponse = await fetch('http://127.0.0.1:8813/api/client/session/bind', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-b',
      },
      body: JSON.stringify({
        conversationId: claim.conversationId,
        clientToken: claim.clientToken,
      }),
    });
    expect(reboundResponse.status).toBe(403);

    updatedState = await server.stateStore.read();
    expect(updatedState.conversations.find((entry) => entry.id === claim.conversationId)?.appUserId).toBe('user-a');
  });

  it('serves synthesized TTS audio for authenticated app users', async () => {
    await createAuthStubServer(8893);

    const server = createTestServer(8814, {
      supabaseUrl: 'http://127.0.0.1:8893',
      supabaseAnonKey: 'anon-key',
      ttsSynthesizer: async ({ text, scene, messageId, userId }) => ({
        buffer: Buffer.from(JSON.stringify({ text, scene, messageId, userId }), 'utf8'),
        contentType: 'audio/mpeg',
      }),
    });
    servers.push(server);
    await server.start();

    const response = await fetch('http://127.0.0.1:8814/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-user-a',
      },
      body: JSON.stringify({
        text: '你好，测试一下 TTS',
        scene: 'bot_reply',
        messageId: 'msg-tts-1',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('audio/mpeg');
    const payload = JSON.parse(await response.text()) as { text: string; scene: string; messageId?: string; userId?: string };
    expect(payload.text).toBe('你好，测试一下 TTS');
    expect(payload.scene).toBe('bot_reply');
    expect(payload.messageId).toBe('msg-tts-1');
    expect(payload.userId).toBe('user-a');
  });

  it('rejects unauthenticated TTS synthesis requests', async () => {
    const server = createTestServer(8815, {
      ttsSynthesizer: async ({ text }) => ({
        buffer: Buffer.from(text, 'utf8'),
        contentType: 'audio/mpeg',
      }),
    });
    servers.push(server);
    await server.start();

    const response = await fetch('http://127.0.0.1:8815/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: 'unauthorized',
        scene: 'status',
      }),
    });

    expect(response.status).toBe(401);
  });
});

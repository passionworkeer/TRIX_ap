import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TrixNativeServer } from '../src/server/TrixNativeServer.js';
import type { ServerConfig } from '../src/types.js';

const servers: TrixNativeServer[] = [];

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
});

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
});

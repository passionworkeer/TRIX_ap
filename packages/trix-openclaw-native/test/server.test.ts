import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TrixNativeServer } from '../src/server/TrixNativeServer.js';

const servers: TrixNativeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.stop().catch(() => undefined)));
});

describe('TrixNativeServer', () => {
  it('creates pairing and accepts inbound message flow', async () => {
    const server = new TrixNativeServer({ port: 8799, publicBaseUrl: 'http://127.0.0.1:8799' });
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
    expect(pairing.code).toHaveLength(8);

    const claimResponse = await fetch(`http://127.0.0.1:8799/api/pairings/${pairing.code}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: 'browser-1',
        deviceName: 'Browser',
      }),
    });
    const claim = await claimResponse.json() as { conversationId: string; clientToken: string };

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
    const server = new TrixNativeServer({ port: 8800, publicBaseUrl: 'http://127.0.0.1:8800' });
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
  });

  it('removes a claimed device session when the client unpairs', async () => {
    const server = new TrixNativeServer({ port: 8802, publicBaseUrl: 'http://127.0.0.1:8802' });
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

  it('delivers user messages to the service plane and accepts OpenClaw replies', async () => {
    const server = new TrixNativeServer({ port: 8801, publicBaseUrl: 'http://127.0.0.1:8801' });
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
});

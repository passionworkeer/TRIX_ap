import { afterEach, describe, expect, it } from 'vitest';
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
        direction: 'inbound',
        senderId: 'browser-1',
        senderName: 'Browser',
        text: 'hello multimodal',
      }),
    });
    expect(messageResponse.status).toBe(201);

    const messagesResponse = await fetch(`http://127.0.0.1:8799/api/conversations/${claim.conversationId}/messages`);
    const messagesPayload = await messagesResponse.json() as { messages: Array<{ text: string }> };
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
        direction: 'inbound',
        senderId: 'browser-2',
        senderName: 'Browser',
        text: 'attached',
        uploadedAttachmentIds: [uploadPayload.attachment.id],
      }),
    });
    expect(messageResponse.status).toBe(201);

    const attachmentResponse = await fetch(uploadPayload.attachment.publicUrl);
    expect(attachmentResponse.status).toBe(200);
    expect(await attachmentResponse.text()).toBe('pdf-binary');
  });
});

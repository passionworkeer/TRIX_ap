import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { monitorTrixProvider } from '../src/monitor.js';

async function createTestServer(
  onAttachmentRequest?: (request: http.IncomingMessage, response: http.ServerResponse) => void,
) {
  const server = http.createServer((request, response) => {
    if (request.url === '/api/service/attachments/att_1' && onAttachmentRequest) {
      onAttachmentRequest(request, response);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const wss = new WebSocketServer({ server, path: '/api/service/ws' });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address');
  }

  return {
    port: address.port,
    server,
    wss,
    close: async () => {
      await new Promise<void>((resolve, reject) => wss.close((error) => (error ? reject(error) : resolve())));
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

describe('monitorTrixProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves raw slash command text for command routing', async () => {
    const testServer = await createTestServer();
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_1',
            chatType: 'direct',
            peer: { id: 'user_1', displayName: 'Alice' },
            message: {
              id: 'msg_1',
              text: '/help',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        resolve();
      });
    });

    const finalizeInboundContext = vi.fn((ctx) => ctx);
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async () => undefined);
    const recordInboundSession = vi.fn(async () => undefined);
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        channels: {
          'trix-native': {
            accounts: {
              default: {
                enabled: true,
                serviceUrl: `http://127.0.0.1:${testServer.port}`,
                serviceToken: 'service-token',
                transport: 'ws',
              },
            },
          },
        },
      },
      abortSignal: abortController.signal,
      channelRuntime: {
        reply: {
          dispatchReplyWithBufferedBlockDispatcher,
          finalizeInboundContext,
        },
        routing: {
          resolveAgentRoute: () => ({ sessionKey: 'session_1', accountId: 'default', agentId: 'agent_1' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession,
        },
        media: {
          fetchRemoteMedia: vi.fn(),
          saveMediaBuffer: vi.fn(),
        },
      },
      runtime: {},
      statusSink: () => undefined,
    });

    await connectionReady;
    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
    });

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.RawBody).toBe('/help');
    expect(call.ctx.CommandBody).toBe('/help');
    expect(call.ctx.BodyForCommands).toBe('/help');
    expect(call.ctx.BodyForAgent).toBe('/help');
    expect(call.ctx.CommandSource).toBe('text');

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  });

  it('downloads servicePath attachments with bearer auth before dispatch', async () => {
    const onAttachmentRequest = vi.fn((request: http.IncomingMessage, response: http.ServerResponse) => {
      expect(request.headers.authorization).toBe('Bearer service-token');
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(Buffer.from('png-data'));
    });
    const testServer = await createTestServer(onAttachmentRequest);

    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_media',
            chatType: 'direct',
            peer: { id: 'user_media', displayName: 'Alice' },
            message: {
              id: 'msg_media',
              text: '请看图片',
              attachments: [{
                id: 'att_1',
                kind: 'image',
                mimeType: 'image/png',
                fileName: 'photo.png',
                servicePath: '/api/service/attachments/att_1',
                url: 'https://signed.example.com/att_1',
              }],
              timestamp: Date.now(),
            },
          },
        }));
        resolve();
      });
    });

    const saveMediaBuffer = vi.fn(async () => ({ path: '/tmp/inbound/photo.png', contentType: 'image/png' }));
    const fetchRemoteMedia = vi.fn();
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async () => undefined);
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        channels: {
          'trix-native': {
            accounts: {
              default: {
                enabled: true,
                serviceUrl: `http://127.0.0.1:${testServer.port}`,
                serviceToken: 'service-token',
                transport: 'ws',
              },
            },
          },
        },
      },
      abortSignal: abortController.signal,
      channelRuntime: {
        reply: {
          dispatchReplyWithBufferedBlockDispatcher,
          finalizeInboundContext: (ctx) => ctx,
        },
        routing: {
          resolveAgentRoute: () => ({ sessionKey: 'session_media', accountId: 'default', agentId: 'agent_1' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        media: {
          fetchRemoteMedia,
          saveMediaBuffer,
        },
      },
      runtime: {},
      statusSink: () => undefined,
    });

    await connectionReady;
    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
    });

    expect(onAttachmentRequest).toHaveBeenCalledTimes(1);
    expect(fetchRemoteMedia).not.toHaveBeenCalled();
    expect(saveMediaBuffer).toHaveBeenCalledTimes(1);

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.RawBody).toBe('请看图片');
    expect(call.ctx.CommandBody).toBe('请看图片');
    expect(call.ctx.BodyForCommands).toBe('请看图片');
    expect(call.ctx.MediaPath).toBe('/tmp/inbound/photo.png');
    expect(call.ctx.MediaType).toBe('image/png');

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  });
});

import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { monitorTrixProvider } from '../src/monitor.js';

const EXPECTED_AGENT_PREAMBLE = 'TRIX live chat turn.';

async function createTestServer(
  onAttachmentRequest?: (request: http.IncomingMessage, response: http.ServerResponse) => void,
  onServiceMessageRequest?: (request: http.IncomingMessage, body: string) => void,
) {
  const server = http.createServer((request, response) => {
    if (request.url === '/api/service/attachments/att_1' && onAttachmentRequest) {
      onAttachmentRequest(request, response);
      return;
    }
    if (request.url === '/api/service/messages' && request.method === 'POST') {
      const chunks = [] as Buffer[];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        onServiceMessageRequest?.(request, Buffer.concat(chunks).toString('utf8'));
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          message: {
            id: 'msg_reply_1',
          },
        }));
      });
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
    const serviceMessages: string[] = [];
    const testServer = await createTestServer(undefined, (_request, body) => {
      serviceMessages.push(body);
    });
    const acknowledgements: Array<{ type?: string; payload?: { messageId?: string; accountId?: string } }> = [];
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.on('message', (raw) => {
          acknowledgements.push(JSON.parse(String(raw)) as { type?: string; payload?: { messageId?: string; accountId?: string } });
        });
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
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async ({ dispatcherOptions }: { dispatcherOptions: { deliver: (payload: Record<string, unknown>) => Promise<void> } }) => {
      await dispatcherOptions.deliver({
        text: 'Help reply',
        replyToId: 'msg_1',
      });
    });
    const recordInboundSession = vi.fn(async () => undefined);
    const readAllowFromStore = vi.fn(async () => []);
    const shouldComputeCommandAuthorized = vi.fn(() => true);
    const resolveCommandAuthorizedFromAuthorizers = vi.fn(({ useAccessGroups, authorizers }) => {
      if (!useAccessGroups) {
        return true;
      }
      return authorizers.some((entry: { configured: boolean; allowed: boolean }) => entry.configured && entry.allowed);
    });
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        commands: {
          useAccessGroups: true,
        },
        channels: {
          'trix-native': {
            dmPolicy: 'open',
            allowFrom: ['*'],
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
        pairing: {
          readAllowFromStore,
        },
        commands: {
          shouldComputeCommandAuthorized,
          resolveCommandAuthorizedFromAuthorizers,
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
    }, { timeout: 10_000 });

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.RawBody).toBe('/help');
    expect(call.ctx.CommandBody).toBe('/help');
    expect(call.ctx.BodyForCommands).toBe('/help');
    expect(call.ctx.BodyForAgent).toBe('/help');
    expect(call.ctx.CommandSource).toBe('text');
    expect(call.ctx.CommandAuthorized).toBe(true);
    expect(shouldComputeCommandAuthorized).toHaveBeenCalledWith('/help', expect.any(Object));
    expect(readAllowFromStore).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(serviceMessages).toHaveLength(1);
    }, { timeout: 10_000 });
    await vi.waitFor(() => {
      expect(acknowledgements).toContainEqual({
        type: 'message.ack',
        payload: {
          accountId: 'default',
          messageId: 'msg_1',
        },
      });
    }, { timeout: 10_000 });

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

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
    const readAllowFromStore = vi.fn(async () => []);
    const shouldComputeCommandAuthorized = vi.fn(() => false);
    const resolveCommandAuthorizedFromAuthorizers = vi.fn(() => false);
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
        pairing: {
          readAllowFromStore,
        },
        commands: {
          shouldComputeCommandAuthorized,
          resolveCommandAuthorizedFromAuthorizers,
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
    }, { timeout: 10_000 });

    expect(onAttachmentRequest).toHaveBeenCalledTimes(1);
    expect(fetchRemoteMedia).not.toHaveBeenCalled();
    expect(saveMediaBuffer).toHaveBeenCalledTimes(1);

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.RawBody).toBe('请看图片');
    expect(call.ctx.CommandBody).toBe('请看图片');
    expect(call.ctx.BodyForCommands).toBe('请看图片');
    expect(call.ctx.BodyForAgent).toContain(EXPECTED_AGENT_PREAMBLE);
    expect(call.ctx.BodyForAgent).toContain('User content:\n请看图片');
    expect(call.ctx.MediaPath).toBe('/tmp/inbound/photo.png');
    expect(call.ctx.MediaType).toBe('image/png');
    expect(call.ctx.CommandAuthorized).toBeUndefined();
    expect(readAllowFromStore).not.toHaveBeenCalled();

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('authorizes slash commands under pairing policy via the Trix service plane', async () => {
    const testServer = await createTestServer();
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_pairing_cmd',
            chatType: 'direct',
            peer: { id: 'user_pairing', displayName: 'Alice' },
            message: {
              id: 'msg_pairing_cmd',
              text: '/status',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        resolve();
      });
    });

    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async () => undefined);
    const readAllowFromStore = vi.fn(async () => []);
    const shouldComputeCommandAuthorized = vi.fn(() => true);
    const resolveCommandAuthorizedFromAuthorizers = vi.fn(() => false);
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        channels: {
          'trix-native': {
            dmPolicy: 'pairing',
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
          resolveAgentRoute: () => ({ sessionKey: 'session_pairing_cmd', accountId: 'default', agentId: 'agent_pairing_cmd' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        pairing: {
          readAllowFromStore,
        },
        commands: {
          shouldComputeCommandAuthorized,
          resolveCommandAuthorizedFromAuthorizers,
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
    }, { timeout: 10_000 });

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.CommandAuthorized).toBe(true);
    expect(readAllowFromStore).not.toHaveBeenCalled();
    expect(resolveCommandAuthorizedFromAuthorizers).not.toHaveBeenCalled();

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('does not acknowledge inbound delivery until a reply is delivered', async () => {
    const testServer = await createTestServer();
    const acknowledgements: Array<{ type?: string; payload?: { messageId?: string; accountId?: string } }> = [];
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.on('message', (raw) => {
          acknowledgements.push(JSON.parse(String(raw)) as { type?: string; payload?: { messageId?: string; accountId?: string } });
        });
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_2',
            chatType: 'direct',
            peer: { id: 'user_2', displayName: 'Bob' },
            message: {
              id: 'msg_2',
              text: 'hello',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        resolve();
      });
    });

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
          resolveAgentRoute: () => ({ sessionKey: 'session_2', accountId: 'default', agentId: 'agent_2' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn(() => false),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => false),
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
    }, { timeout: 10_000 });

    expect(acknowledgements).toEqual([]);

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('debounces rapid text-only inbound messages into a single dispatch', async () => {
    const testServer = await createTestServer();
    const acknowledgements: Array<{ type?: string; payload?: { messageId?: string; accountId?: string } }> = [];
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.on('message', (raw) => {
          acknowledgements.push(JSON.parse(String(raw)) as { type?: string; payload?: { messageId?: string; accountId?: string } });
        });
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_batch',
            chatType: 'direct',
            peer: { id: 'user_batch', displayName: 'Alice' },
            message: {
              id: 'msg_batch_1',
              text: '第一句',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_batch',
            chatType: 'direct',
            peer: { id: 'user_batch', displayName: 'Alice' },
            message: {
              id: 'msg_batch_2',
              text: '第二句',
              attachments: [],
              timestamp: Date.now() + 10,
            },
          },
        }));
        resolve();
      });
    });

    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async ({ dispatcherOptions }: { dispatcherOptions: { deliver: (payload: Record<string, unknown>) => Promise<void> } }) => {
      await dispatcherOptions.deliver({
        text: 'Combined reply',
        replyToId: 'msg_batch_2',
      });
    });
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        messages: {
          inbound: {
            debounceMs: 25,
          },
        },
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
          resolveAgentRoute: () => ({ sessionKey: 'session_batch', accountId: 'default', agentId: 'agent_batch' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn(() => false),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => false),
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
    }, { timeout: 10_000 });

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.BodyForAgent).toContain(EXPECTED_AGENT_PREAMBLE);
    expect(call.ctx.BodyForAgent).toContain('User content:\n第一句\n第二句');
    expect(call.ctx.TrixMessageIds).toEqual(['msg_batch_1', 'msg_batch_2']);

    await vi.waitFor(() => {
      expect(acknowledgements).toContainEqual({
        type: 'message.ack',
        payload: {
          accountId: 'default',
          messageId: 'msg_batch_1',
        },
      });
      expect(acknowledgements).toContainEqual({
        type: 'message.ack',
        payload: {
          accountId: 'default',
          messageId: 'msg_batch_2',
        },
      });
    }, { timeout: 10_000 });

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('serializes same-session inbound dispatches', async () => {
    const testServer = await createTestServer();
    let releaseFirstDispatch: (() => void) | null = null;
    const firstDispatchReleased = new Promise<void>((resolve) => {
      releaseFirstDispatch = resolve;
    });

    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_serial',
            chatType: 'direct',
            peer: { id: 'user_serial', displayName: 'Alice' },
            message: {
              id: 'msg_serial_1',
              text: '第一条',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        setTimeout(() => {
          socket.send(JSON.stringify({
            type: 'message.created',
            payload: {
              accountId: 'default',
              conversationId: 'conv_serial',
              chatType: 'direct',
              peer: { id: 'user_serial', displayName: 'Alice' },
              message: {
                id: 'msg_serial_2',
                text: '/status',
                attachments: [],
                timestamp: Date.now() + 10,
              },
            },
          }));
        }, 5);
        resolve();
      });
    });

    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async ({ ctx, dispatcherOptions }: {
      ctx: Record<string, unknown>;
      dispatcherOptions: { deliver: (payload: Record<string, unknown>) => Promise<void> };
    }) => {
      if (ctx.MessageSid === 'msg_serial_1') {
        await firstDispatchReleased;
      }
      await dispatcherOptions.deliver({
        text: `reply:${ctx.MessageSid as string}`,
        replyToId: ctx.MessageSid,
      });
    });
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        messages: {
          inbound: {
            debounceMs: 0,
          },
        },
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
          resolveAgentRoute: () => ({ sessionKey: 'session_serial', accountId: 'default', agentId: 'agent_serial' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn((text: string) => text.startsWith('/')),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => true),
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
    }, { timeout: 10_000 });
    expect((dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> }).ctx.MessageSid).toBe('msg_serial_1');

    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
    }, { timeout: 100 });

    releaseFirstDispatch?.();

    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(2);
    }, { timeout: 10_000 });
    expect((dispatchReplyWithBufferedBlockDispatcher.mock.calls[1]?.[0] as { ctx: Record<string, unknown> }).ctx.MessageSid).toBe('msg_serial_2');

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('runs configured slash status commands concurrently when the session is otherwise idle', async () => {
    const testServer = await createTestServer();
    let releaseDispatches: (() => void) | null = null;
    const dispatchGate = new Promise<void>((resolve) => {
      releaseDispatches = resolve;
    });

    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_parallel_status',
            chatType: 'direct',
            peer: { id: 'user_parallel_status', displayName: 'Alice' },
            message: {
              id: 'msg_parallel_status_1',
              text: '/status first',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_parallel_status',
            chatType: 'direct',
            peer: { id: 'user_parallel_status', displayName: 'Alice' },
            message: {
              id: 'msg_parallel_status_2',
              text: '/status second',
              attachments: [],
              timestamp: Date.now() + 1,
            },
          },
        }));
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_parallel_status',
            chatType: 'direct',
            peer: { id: 'user_parallel_status', displayName: 'Alice' },
            message: {
              id: 'msg_parallel_status_3',
              text: '/status third',
              attachments: [],
              timestamp: Date.now() + 2,
            },
          },
        }));
        resolve();
      });
    });

    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async ({ ctx, dispatcherOptions }: {
      ctx: Record<string, unknown>;
      dispatcherOptions: { deliver: (payload: Record<string, unknown>) => Promise<void> };
    }) => {
      await dispatchGate;
      await dispatcherOptions.deliver({
        text: `reply:${ctx.MessageSid as string}`,
        replyToId: ctx.MessageSid,
      });
    });
    const recordInboundSession = vi.fn(async () => undefined);
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        messages: {
          inbound: {
            debounceMs: 0,
            parallelSlashCommands: ['/status'],
          },
        },
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
          resolveAgentRoute: () => ({ sessionKey: 'session_parallel_status', accountId: 'default', agentId: 'agent_parallel_status' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession,
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn((text: string) => text.startsWith('/')),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => true),
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
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(3);
    }, { timeout: 10_000 });
    expect(recordInboundSession).not.toHaveBeenCalled();

    releaseDispatches?.();

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('waits for in-flight slash status commands before processing a normal turn in the same session', async () => {
    const testServer = await createTestServer();
    let releaseStatusDispatch: (() => void) | null = null;
    const statusDispatchGate = new Promise<void>((resolve) => {
      releaseStatusDispatch = resolve;
    });

    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_parallel_then_normal',
            chatType: 'direct',
            peer: { id: 'user_parallel_then_normal', displayName: 'Alice' },
            message: {
              id: 'msg_parallel_then_normal_1',
              text: '/status',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        setTimeout(() => {
          socket.send(JSON.stringify({
            type: 'message.created',
            payload: {
              accountId: 'default',
              conversationId: 'conv_parallel_then_normal',
              chatType: 'direct',
              peer: { id: 'user_parallel_then_normal', displayName: 'Alice' },
              message: {
                id: 'msg_parallel_then_normal_2',
                text: 'normal follow-up',
                attachments: [],
                timestamp: Date.now() + 10,
              },
            },
          }));
        }, 5);
        resolve();
      });
    });

    const dispatchReplyWithBufferedBlockDispatcher = vi.fn(async ({ ctx, dispatcherOptions }: {
      ctx: Record<string, unknown>;
      dispatcherOptions: { deliver: (payload: Record<string, unknown>) => Promise<void> };
    }) => {
      if (ctx.MessageSid === 'msg_parallel_then_normal_1') {
        await statusDispatchGate;
      }
      await dispatcherOptions.deliver({
        text: `reply:${ctx.MessageSid as string}`,
        replyToId: ctx.MessageSid,
      });
    });
    const recordInboundSession = vi.fn(async () => undefined);
    const abortController = new AbortController();

    const monitorPromise = monitorTrixProvider({
      config: {
        messages: {
          inbound: {
            debounceMs: 0,
            parallelSlashCommands: ['/status'],
          },
        },
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
          resolveAgentRoute: () => ({ sessionKey: 'session_parallel_then_normal', accountId: 'default', agentId: 'agent_parallel_then_normal' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession,
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn((text: string) => text.startsWith('/')),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => true),
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
    }, { timeout: 10_000 });
    expect((dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> }).ctx.MessageSid).toBe('msg_parallel_then_normal_1');
    expect(recordInboundSession).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
    }, { timeout: 100 });

    releaseStatusDispatch?.();

    await vi.waitFor(() => {
      expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(2);
    }, { timeout: 10_000 });
    expect((dispatchReplyWithBufferedBlockDispatcher.mock.calls[1]?.[0] as { ctx: Record<string, unknown> }).ctx.MessageSid).toBe('msg_parallel_then_normal_2');
    expect(recordInboundSession).toHaveBeenCalledTimes(1);

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);

  it('hardens normal inbound turns against heartbeat contamination', async () => {
    const testServer = await createTestServer();
    const connectionReady = new Promise<void>((resolve) => {
      testServer.wss.once('connection', (socket) => {
        socket.send(JSON.stringify({
          type: 'message.created',
          payload: {
            accountId: 'default',
            conversationId: 'conv_guard',
            chatType: 'direct',
            peer: { id: 'user_guard', displayName: 'Alice' },
            message: {
              id: 'msg_guard',
              text: 'just a normal user message',
              attachments: [],
              timestamp: Date.now(),
            },
          },
        }));
        resolve();
      });
    });

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
          resolveAgentRoute: () => ({ sessionKey: 'session_guard', accountId: 'default', agentId: 'agent_guard' }),
        },
        session: {
          resolveStorePath: () => '/tmp/session-store',
          recordInboundSession: vi.fn(async () => undefined),
        },
        pairing: {
          readAllowFromStore: vi.fn(async () => []),
        },
        commands: {
          shouldComputeCommandAuthorized: vi.fn(() => false),
          resolveCommandAuthorizedFromAuthorizers: vi.fn(() => false),
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
    }, { timeout: 10_000 });

    const call = dispatchReplyWithBufferedBlockDispatcher.mock.calls[0]?.[0] as { ctx: Record<string, unknown> };
    expect(call.ctx.BodyForAgent).toContain(EXPECTED_AGENT_PREAMBLE);
    expect(call.ctx.BodyForAgent).toContain('Never reply with HEARTBEAT_OK unless the user explicitly asked for that exact text.');
    expect(call.ctx.BodyForAgent).toContain('User content:\njust a normal user message');
    expect(call.ctx.RawBody).toBe('just a normal user message');

    abortController.abort();
    await monitorPromise;
    await testServer.close();
  }, 15_000);
});

import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTrixPluginConfigProvider } from '../src/account.js';
import { sendPayloadTrix } from '../src/outbound.js';

const servers: http.Server[] = [];

async function createStubServer(
  handler: (
    request: http.IncomingMessage,
    body: string,
    attempt: number,
  ) => { status: number; body: unknown; statusText?: string } | null,
): Promise<number> {
  let attempts = 0;
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => {
      attempts += 1;
      const result = handler(request, Buffer.concat(chunks).toString('utf8'), attempts);
      if (!result) {
        return;
      }
      response.writeHead(result.status, result.statusText, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.body));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve stub server address');
  }
  return address.port;
}

describe('trix-native outbound delivery', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setTrixPluginConfigProvider(() => ({}));
    await Promise.all(servers.splice(0).map(async (server) => new Promise<void>((resolve) => {
      server.close(() => resolve());
    })));
  });

  it('retries transient network failures with the same idempotency key', async () => {
    const attempts: Array<{ authorization: string | undefined; payload: any }> = [];
    const port = await createStubServer((request, body, attempt) => {
      const payload = JSON.parse(body);
      attempts.push({
        authorization: request.headers.authorization,
        payload,
      });
      if (attempt === 1) {
        request.socket.destroy();
        return null;
      }
      return {
        status: 201,
        body: {
          message: { id: 'msg_retry_ok' },
        },
      };
    });

    setTrixPluginConfigProvider(() => ({
      channels: {
        'trix-native': {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              name: 'TRIX Bot',
              serviceUrl: `http://127.0.0.1:${port}`,
              serviceToken: 'secret-token',
              transport: 'ws',
            },
          },
        },
      },
    }));

    const result = await sendPayloadTrix({
      cfg: {
        channels: {
          'trix-native': {
            enabled: true,
            accounts: {
              default: {
                enabled: true,
                name: 'TRIX Bot',
                serviceUrl: `http://127.0.0.1:${port}`,
                serviceToken: 'secret-token',
                transport: 'ws',
              },
            },
          },
        },
      },
      accountId: 'default',
      conversationId: 'conv_retry',
      payload: {
        text: 'hello retry',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg_retry_ok');
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.authorization).toBe('Bearer secret-token');
    expect(attempts[0]?.payload.message.idempotencyKey).toBeTruthy();
    expect(attempts[1]?.payload.message.idempotencyKey).toBe(attempts[0]?.payload.message.idempotencyKey);
  });

  it('retries 5xx service responses before succeeding', async () => {
    let attempts = 0;
    const port = await createStubServer((_request, _body, attempt) => {
      attempts = attempt;
      if (attempt === 1) {
        return {
          status: 503,
          statusText: 'Service Unavailable',
          body: { error: 'temporary outage' },
        };
      }
      return {
        status: 201,
        body: {
          message: { id: 'msg_retry_5xx' },
        },
      };
    });

    const result = await sendPayloadTrix({
      cfg: {
        channels: {
          'trix-native': {
            enabled: true,
            accounts: {
              default: {
                enabled: true,
                name: 'TRIX Bot',
                serviceUrl: `http://127.0.0.1:${port}`,
                serviceToken: 'secret-token',
                transport: 'ws',
              },
            },
          },
        },
      },
      accountId: 'default',
      conversationId: 'conv_retry_5xx',
      payload: {
        text: 'hello retry 5xx',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg_retry_5xx');
    expect(attempts).toBe(2);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTrixPluginConfigProvider } from '../src/account.js';
import { sendPayloadTrix } from '../src/outbound.js';

describe('trix-native outbound delivery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setTrixPluginConfigProvider(() => ({}));
  });

  it('retries transient network failures with the same idempotency key', async () => {
    setTrixPluginConfigProvider(() => ({
      channels: {
        'trix-native': {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              name: 'TRIX Bot',
              serviceUrl: 'http://127.0.0.1:8788',
              serviceToken: 'secret-token',
              transport: 'ws',
            },
          },
        },
      },
    }));

    const transient = new TypeError('fetch failed');
    Object.assign(transient, {
      cause: {
        code: 'ECONNRESET',
      },
    });

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: { id: 'msg_retry_ok' },
      }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendPayloadTrix({
      cfg: {
        channels: {
          'trix-native': {
            enabled: true,
            accounts: {
              default: {
                enabled: true,
                name: 'TRIX Bot',
                serviceUrl: 'http://127.0.0.1:8788',
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
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect(firstBody.message.idempotencyKey).toBeTruthy();
    expect(secondBody.message.idempotencyKey).toBe(firstBody.message.idempotencyKey);
  });

  it('retries 5xx service responses before succeeding', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporary outage', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: { id: 'msg_retry_5xx' },
      }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendPayloadTrix({
      cfg: {
        channels: {
          'trix-native': {
            enabled: true,
            accounts: {
              default: {
                enabled: true,
                name: 'TRIX Bot',
                serviceUrl: 'http://127.0.0.1:8788',
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

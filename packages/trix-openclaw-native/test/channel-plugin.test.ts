import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTrixPluginConfigProvider } from '../src/account.js';
import { trixPlugin } from '../src/channel.js';

describe('trix-native channel plugin config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTrixPluginConfigProvider(() => ({}));
  });

  it('exposes inspectAccount without leaking runtime secrets', () => {
    const cfg = {
      channels: {
        'trix-native': {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              name: 'TRIX Bot',
              serviceUrl: 'http://127.0.0.1:8788',
              publicBaseUrl: 'https://chat.example.com',
              serviceToken: 'secret-token',
              transport: 'ws',
            },
          },
        },
      },
    };

    const inspected = trixPlugin.config.inspectAccount?.(cfg as never, 'default') as Record<string, unknown>;

    expect(inspected).toMatchObject({
      accountId: 'default',
      enabled: true,
      configured: true,
      name: 'TRIX Bot',
      serviceUrl: 'http://127.0.0.1:8788',
      publicBaseUrl: 'https://chat.example.com',
      transport: 'ws',
      serviceTokenStatus: 'available',
      serviceTokenSource: 'config',
    });
    expect(inspected).not.toHaveProperty('serviceToken');
    expect(inspected).not.toHaveProperty('adminToken');
  });

  it('reports incomplete configuration through inspectAccount', () => {
    const cfg = {
      channels: {
        'trix-native': {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              name: 'Broken Account',
              serviceUrl: 'http://127.0.0.1:8788',
            },
          },
        },
      },
    };

    const inspected = trixPlugin.config.inspectAccount?.(cfg as never, 'default') as Record<string, unknown>;

    expect(inspected).toMatchObject({
      accountId: 'default',
      configured: false,
      serviceTokenStatus: 'missing',
      serviceTokenSource: 'unset',
    });
  });

  it('retries transient pairing poll failures during login', async () => {
    setTrixPluginConfigProvider(() => ({
      channels: {
        'trix-native': {
          enabled: true,
          accounts: {
            default: {
              enabled: true,
              name: 'TRIX Bot',
              serviceUrl: 'https://trix.love',
              serviceToken: 'secret-token',
              transport: 'ws',
            },
          },
        },
      },
    }));

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PAIR123' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('temporary outage', { status: 503, statusText: 'Service Temporarily Unavailable' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'paired' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const runtime = { log: vi.fn() };
    await expect(trixPlugin.auth?.login?.({
      accountId: 'default',
      runtime,
      verbose: false,
    } as never)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(runtime.log).toHaveBeenCalledWith('TRIX device paired.');
  });
});

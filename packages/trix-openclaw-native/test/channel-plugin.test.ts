import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockQrGenerate } = vi.hoisted(() => ({
  mockQrGenerate: vi.fn((input: string, _options: Record<string, unknown>, cb?: (output: string) => void) => {
    cb?.(`QR:${input}`);
  }),
}));

vi.mock('qrcode-terminal', () => ({
  default: {
    generate: mockQrGenerate,
  },
}));

import { setTrixPluginConfigProvider } from '../src/account.js';
import { trixPlugin } from '../src/channel.js';

describe('trix-native channel plugin config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTrixPluginConfigProvider(() => ({}));
    mockQrGenerate.mockClear();
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
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'))).not.toHaveProperty('ttlMs');
    expect(runtime.log).toHaveBeenCalledWith('TRIX device paired.');
  });

  it('renders a terminal QR when claimUrl is available during login', async () => {
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
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'PAIR123',
        claimUrl: 'https://trix.love/pair?code=PAIR123',
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'paired' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const runtime = { log: vi.fn() };
    await expect(trixPlugin.auth?.login?.({
      accountId: 'default',
      runtime,
      verbose: true,
    } as never)).resolves.toBeUndefined();

    expect(mockQrGenerate).toHaveBeenCalledWith(
      'https://trix.love/pair?code=PAIR123',
      { small: true },
      expect.any(Function),
    );
    expect(runtime.log).toHaveBeenCalledWith('TRIX scan QR:');
    expect(runtime.log).toHaveBeenCalledWith('QR:https://trix.love/pair?code=PAIR123');
  });
});

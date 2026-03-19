import { describe, expect, it } from 'vitest';
import { trixPlugin } from '../src/channel.js';

describe('trix-native channel plugin config', () => {
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
});

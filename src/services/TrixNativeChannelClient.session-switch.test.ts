import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageStore: Record<string, string> = {};
const sessionStorageStore: Record<string, string> = {};
const mockFetch = vi.fn();

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readonly protocols?: string | string[];
  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSING;
  });

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    });
  }

  emitClose(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: () => ({
    nativeServerUrl: 'http://127.0.0.1:8788',
    nativePublicUrl: 'http://127.0.0.1:8788',
  }),
}));

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'supabase-access-token',
          },
        },
      })),
    },
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clawbot: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

const jsonResponse = (payload: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    json: async () => payload,
  }) as Response;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('TrixNativeChannelClient session switching', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    MockWebSocket.instances.length = 0;

    Object.keys(localStorageStore).forEach((key) => {
      delete localStorageStore[key];
    });
    Object.keys(sessionStorageStore).forEach((key) => {
      delete sessionStorageStore[key];
    });

    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(localStorageStore).forEach((key) => {
          delete localStorageStore[key];
        });
      }),
      key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
      get length() {
        return Object.keys(localStorageStore).length;
      },
    });
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        sessionStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete sessionStorageStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(sessionStorageStore).forEach((key) => {
          delete sessionStorageStore[key];
        });
      }),
      key: vi.fn((index: number) => Object.keys(sessionStorageStore)[index] ?? null),
      get length() {
        return Object.keys(sessionStorageStore).length;
      },
    });
    vi.stubGlobal('window', globalThis);

    localStorage.setItem(
      'trix_native_channel_sessions_v2',
      JSON.stringify({
        version: 2,
        activeAccountId: 'default',
        sessions: {
          default: {
            accountId: 'default',
            appUserId: 'user-123',
            serverUrl: 'http://127.0.0.1:8788',
            websocketUrl: 'ws://127.0.0.1:8788/ws',
            conversationId: 'conv_old',
            clientId: 'web_client_1',
            deviceName: 'TRIX-Test',
            pairingCode: 'OLD111',
          },
        },
      }),
    );
    localStorage.setItem('trix_native_channel_active_account', 'default');
    localStorage.setItem('trix_native_channel_client_id', 'web_client_1');
    sessionStorage.setItem('trix_native_channel_token:default:conv_old:web_client_1', 'token_old');
  });

  afterEach(async () => {
    const { default: client } = await import('./TrixNativeChannelClient');
    client.disconnect();
    vi.unstubAllGlobals();
  });

  it('reconnects the realtime socket when pairing switches to a new conversation', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/conversations/conv_old/messages')) {
        return Promise.resolve(jsonResponse({ messages: [], agentOnline: true }));
      }
      if (url.endsWith('/api/conversations/conv_new/messages')) {
        return Promise.resolve(jsonResponse({ messages: [], agentOnline: true }));
      }
      if (url.includes('/api/pairings/ABC123/claim')) {
        return Promise.resolve(jsonResponse({
          accountId: 'default',
          conversationId: 'conv_new',
          clientToken: 'token_new',
          websocketUrl: 'ws://127.0.0.1:8788/ws',
          pairing: {
            code: 'ABC123',
          },
          agentOnline: true,
        }));
      }
      if (url.endsWith('/api/client/session/bind')) {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { default: client } = await import('./TrixNativeChannelClient');
    client.setAuthUser('user-123');

    await client.connect();
    await flushMicrotasks();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.url).toContain('conversationId=conv_old');
    expect(MockWebSocket.instances[0]?.url).not.toContain('clientToken=');
    expect(MockWebSocket.instances[0]?.protocols).toEqual(expect.arrayContaining(['trix-user']));

    const staleSocket = MockWebSocket.instances[0];
    await client.pairWithCode('ABC123', 'TRIX-Test');
    await flushMicrotasks();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(staleSocket?.close).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances[1]?.url).toContain('conversationId=conv_new');
    expect(MockWebSocket.instances[1]?.url).not.toContain('clientToken=');
    expect(client.isConnected()).toBe(true);

    staleSocket?.emitClose(1006);
    await flushMicrotasks();

    expect(client.isConnected()).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/api/conversations/conv_new/messages',
      expect.objectContaining({
        headers: {
          'x-trix-client-token': 'token_new',
        },
      }),
    );
  });
});

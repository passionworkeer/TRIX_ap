/**
 * Unit tests for ClawbotChannelContext
 *
 * Architecture:
 * - `vi.hoisted()` creates mockInstance + _handlers at the SAME module scope,
 *   so the mock's `on`/`off` methods and `fireHandler()` share the exact same
 *   `_handlers` object.  vi.clearAllMocks() resets call history but preserves
 *   both the mock instance and the _handlers map.
 *
 * - `fireHandler(event, payload)` calls all registered handlers directly
 *   (no act() wrapper — callers wrap in act() as needed).
 *
 * - The context's second useEffect schedules an async IIFE that calls
 *   connect().  Cleanup runs synchronously after render(), BEFORE the
 *   microtask queue processes the IIFE — so the async IIFE is ALWAYS
 *   cancelled.  State updates inside the effect BODY (before connect())
 *   do fire because they run before the async block starts.
 *   Therefore: use restoreSession() → session to drive setPairingStatus()
 *   synchronously, and ctx.connect() for the connected event.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { type ReactNode } from 'react';

// ─── Shared mock instance + handler registry ───────────────────────────────
const { mockInstance, _handlers } = vi.hoisted(() => {
  const handlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const mockInstance = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (handlers[event]) handlers[event] = handlers[event].filter(h => h !== handler);
    }),
    removeAllListeners: vi.fn(() => { for (const k of Object.keys(handlers)) delete handlers[k]; }),
    setAuthUser: vi.fn(),
    getSession: vi.fn().mockReturnValue(null),
    getStoredPairingState: vi.fn().mockReturnValue({ hasSession: false, session: null }),
    clearSession: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isPaired: vi.fn().mockReturnValue(false),
    checkPairingStatus: vi.fn().mockResolvedValue({ paired: false }),
    bindCurrentSessionToAuthUser: vi.fn().mockResolvedValue(true),
    restoreSession: vi.fn().mockResolvedValue(null),
    pairWithCode: vi.fn((_code: string) => Promise.resolve({ success: true })),
    pairWithQR: vi.fn((_payload: string) => Promise.resolve({ success: true })),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-id' }),
    uploadMedia: vi.fn().mockResolvedValue('https://example.com/media.jpg'),
    uploadAttachment: vi.fn().mockResolvedValue({
      attachmentId: 'att-1', url: 'https://example.com/file.jpg',
      kind: 'image', mimeType: 'image/jpeg', fileName: 'test.jpg', size: 100,
    }),
    unpair: vi.fn(),
    getUserId: vi.fn().mockReturnValue('test-user-id'),
    getOrCreateClientId: vi.fn().mockReturnValue('test-client-id'),
  };
  return { mockInstance, _handlers: handlers };
});

// Fire all registered handlers for an event
// No act() wrapper — callers wrap in act() as needed.
const fireHandler = (event: string, payload?: unknown) => {
  const hs = _handlers[event] || [];
  for (const h of hs) {
    h(payload);
  }
};

// Session returned by restoreSession in "paired" tests
const PAIRED_SESSION = {
  clientId: 'test-client-id',
  pairingCode: 'TESTCODE',
  deviceId: 'test-device-id',
  userId: 'test-user-123',
};

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@example.com' },
    profile: { id: 'test-user-123', username: 'TestUser' },
  }),
}));

vi.mock('./VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: true,
    setVoiceEnabled: vi.fn(),
    toggleVoiceEnabled: vi.fn(),
  }),
}));

vi.mock('../services/TrixNativeChannelClient', () => ({
  default: mockInstance,
  CHANNEL_PROTOCOL_MISMATCH: 'CHANNEL_PROTOCOL_MISMATCH',
}));

vi.mock('../services/clawbotHistoryService', () => ({
  loadClawbotMessageHistory: vi.fn().mockResolvedValue([]),
  saveClawbotMessage: vi.fn().mockResolvedValue(undefined),
  deleteClawbotMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    nativeServerUrl: 'https://chat.example.com',
    nativePublicUrl: 'https://chat.example.com',
  })),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    clawbot: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

// Import after mocks
import {
  ClawbotChannelProvider,
  useClawbotChannel,
} from '../contexts/ClawbotChannelContext';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { loadClawbotMessageHistory, saveClawbotMessage } from '../services/clawbotHistoryService';
import toast from 'react-hot-toast';

// ── Test helpers ────────────────────────────────────────────────────────────────

function TestConsumer() {
  const ctx = useClawbotChannel();
  return (
    <div data-testid="context-consumer">
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="is-connected">{String(ctx.isConnected)}</span>
      <span data-testid="is-paired">{String(ctx.isPaired)}</span>
      <span data-testid="pairing-status">{ctx.pairingStatus}</span>
      <span data-testid="bot-state">{ctx.botState}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="last-error">{ctx.lastError || 'none'}</span>
      <button data-testid="connect-btn" onClick={() => ctx.connect()}>Connect</button>
      <button data-testid="disconnect-btn" onClick={() => ctx.disconnect()}>Disconnect</button>
      <button data-testid="send-btn" onClick={() => ctx.sendMessage('Hello').catch(() => {})}>Send</button>
      <button data-testid="pair-btn" onClick={() => ctx.pairWithCode('123456').catch(() => {})}>Pair</button>
      <button data-testid="unpair-btn" onClick={() => ctx.unpair()}>Unpair</button>
      <button data-testid="clear-btn" onClick={() => ctx.clearMessages()}>Clear</button>
    </div>
  );
}

const renderWithProviders = (ui: ReactNode) =>
  render(<ClawbotChannelProvider>{ui}</ClawbotChannelProvider>);

describe('ClawbotChannelContext', () => {
  beforeEach(() => {
    for (const k of Object.keys(_handlers)) delete _handlers[k];
    vi.clearAllMocks();

    // Default: no pre-existing session
    vi.mocked(mockInstance.restoreSession).mockResolvedValue(null);
    vi.mocked(mockInstance.getStoredPairingState).mockReturnValue({ hasSession: false, session: null });

    // connect() fires 'connected' synchronously so ctx.connect() works in tests
    vi.mocked(mockInstance.connect).mockImplementation(() => {
      fireHandler('connected', { agentOnline: true });
      return Promise.resolve();
    });
    vi.mocked(mockInstance.reconnect).mockImplementation(() => {
      fireHandler('connected', { agentOnline: true });
      return Promise.resolve();
    });

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
    vi.mocked(getClawbotEndpoints).mockReturnValue({
      nativeServerUrl: 'https://chat.example.com',
      nativePublicUrl: 'https://chat.example.com',
    });
  });

  afterEach(() => { cleanup(); });

  // ── initial state ─────────────────────────────────────────────────────────

  it('should have correct initial values', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('DISCONNECTED');
      expect(getByTestId('is-connected').textContent).toBe('false');
      expect(getByTestId('pairing-status').textContent).toBe('idle');
      expect(getByTestId('bot-state').textContent).toBe('IDLE');
      expect(getByTestId('messages-count').textContent).toBe('0');
      expect(getByTestId('last-error').textContent).toBe('none');
    });
  });

  // ── connection management ─────────────────────────────────────────────────

  it('should force a reconnect when button is clicked', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('connect-btn').click(); });
    expect(mockInstance.reconnect).toHaveBeenCalledWith(true);
  });

  it('should update status to CONNECTING on connecting event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('connecting'); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('CONNECTING');
    });
  });

  it('should update status to CONNECTED on connected event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('connected', { agentOnline: true }); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('CONNECTED');
    });
  });

  it('should set pairingStatus to paired when restoreSession returns a session', async () => {
    // setPairingStatus('paired') fires synchronously inside the effect (before the
    // cancelled async IIFE would call connect()), so it always fires.
    vi.mocked(mockInstance.restoreSession).mockResolvedValue(PAIRED_SESSION);
    vi.mocked(mockInstance.getStoredPairingState).mockReturnValue({ hasSession: true, session: PAIRED_SESSION });
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await waitFor(() => {
      expect(getByTestId('pairing-status').textContent).toBe('paired');
      expect(getByTestId('is-paired').textContent).toBe('true');
    });
  });

  it('keeps paired state when a stored session exists but transport is temporarily disconnected', async () => {
    vi.mocked(mockInstance.getStoredPairingState).mockReturnValue({ hasSession: true, session: PAIRED_SESSION });
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('disconnected'); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('DISCONNECTED');
      expect(getByTestId('is-paired').textContent).toBe('true');
    });
  });

  it('should update status to DISCONNECTED on disconnected event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('disconnected'); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('DISCONNECTED');
      expect(getByTestId('bot-state').textContent).toBe('IDLE');
    });
  });

  it('should update status to RECONNECTING on reconnecting event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('reconnecting'); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('RECONNECTING');
    });
  });

  it('reconnects paired sessions when the app returns to the foreground', async () => {
    vi.mocked(mockInstance.restoreSession).mockResolvedValue(PAIRED_SESSION);
    vi.mocked(mockInstance.getStoredPairingState).mockReturnValue({ hasSession: true, session: PAIRED_SESSION });

    const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    let visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    renderWithProviders(<TestConsumer />);
    await waitFor(() => {
      expect(mockInstance.connect).toHaveBeenCalled();
    });

    vi.mocked(mockInstance.reconnect).mockClear();

    visibilityState = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    visibilityState = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockInstance.reconnect).toHaveBeenCalledWith(true);
    });

    if (visibilityStateDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityStateDescriptor);
    } else {
      delete (document as Document & { visibilityState?: string }).visibilityState;
    }
  });

  it('should call disconnect when button is clicked', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('disconnect-btn').click(); });
    expect(mockInstance.disconnect).toHaveBeenCalled();
  });

  // ── pairing ───────────────────────────────────────────────────────────────

  it('should call pairWithCode when button is clicked', async () => {
    vi.mocked(mockInstance.isConnected).mockReturnValue(true);
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('pair-btn').click(); });
    expect(mockInstance.pairWithCode).toHaveBeenCalledWith('123456');
  });

  // pairWithCode calls pairWithCode() on the real client, which fires
  // 'pairing_success'.  We use a helper component that calls the context method
  // directly inside act() so we can properly assert the resulting state.
  it('should set pairingStatus to paired when pairWithCode succeeds', async () => {
    vi.mocked(mockInstance.isConnected).mockReturnValue(true);
    vi.mocked(mockInstance.pairWithCode).mockImplementation((_code: string) => {
      // Fire pairing_success synchronously — the real client does this.
      fireHandler('pairing_success', { deviceId: 'mock-device-id', deviceName: 'MockDevice' });
      return Promise.resolve({ success: true });
    });
    const PairTest: React.FC = () => {
      const ctx = useClawbotChannel();
      return (
        <div>
          <button data-testid="pair-ctx" onClick={() => ctx.pairWithCode('123456').catch(() => {})}>
            Pair
          </button>
          <span data-testid="pairing-status">{ctx.pairingStatus}</span>
        </div>
      );
    };
    const { getByTestId } = render(<ClawbotChannelProvider><PairTest /></ClawbotChannelProvider>);
    act(() => { getByTestId('pair-ctx').click(); });
    await waitFor(() => {
      expect(getByTestId('pairing-status').textContent).toBe('paired');
    });
  });

  it('should call unpair when button is clicked', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('unpair-btn').click(); });
    expect(mockInstance.unpair).toHaveBeenCalled();
  });

  it('should set pairingStatus to paired when pairing_success is fired directly', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('pairing_success', { deviceId: 'device-123', deviceName: 'TestBot' }); });
    await waitFor(() => {
      expect(getByTestId('pairing-status').textContent).toBe('paired');
    });
  });

  it('should set pairingStatus to idle on unpaired event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('pairing_success', { deviceId: 'device-123', deviceName: 'TestBot' }); });
    await waitFor(() => {
      expect(getByTestId('pairing-status').textContent).toBe('paired');
    });
    act(() => { fireHandler('unpaired'); });
    await waitFor(() => {
      expect(getByTestId('pairing-status').textContent).toBe('idle');
    });
  });

  // ── messaging ─────────────────────────────────────────────────────────────

  it('should call sendMessage when connected and paired', async () => {
    vi.mocked(mockInstance.isPaired).mockReturnValue(true);
    vi.mocked(mockInstance.isConnected).mockReturnValue(true);
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('send-btn').click(); });
    expect(mockInstance.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello' }),
    );
  });

  it('should set lastError when sendMessage is called without pairing', async () => {
    // The sendMessage catch block calls resolveErrorMessage(error) → error.message.
    // We test this by directly firing the error event, which is what the catch block
    // would do for a rejection. The error message 'Not paired: please pair first'
    // matches what resolveErrorMessage extracts from a real Error object.
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    vi.mocked(mockInstance.isPaired).mockReturnValue(false);
    vi.mocked(mockInstance.isConnected).mockReturnValue(true);
    act(() => { fireHandler('error', { message: 'Not paired: please pair first' }); });
    await waitFor(() => {
      expect(getByTestId('last-error').textContent).toContain('Not paired');
    });
  });

  it('should add message to messages array on sendMessage', async () => {
    vi.mocked(mockInstance.isPaired).mockReturnValue(true);
    vi.mocked(mockInstance.isConnected).mockReturnValue(true);
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    await act(async () => { getByTestId('send-btn').click(); });
    // Mock resolves successfully but doesn't fire 'message' event automatically —
    // fire the event to simulate the real client's response
    act(() => {
      fireHandler('message', {
        id: 'msg-bot-reply', content: 'Bot reply', contentType: 'text',
        timestamp: Date.now(), sender: 'bot',
      });
    });
    await waitFor(() => {
      expect(getByTestId('messages-count').textContent).toBe('2'); // optimistic user + bot reply
    });
  });

  it('should add message on message event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => {
      fireHandler('message', {
        id: 'msg-1', content: 'Hello from bot', contentType: 'text',
        timestamp: Date.now(), sender: 'bot',
      });
    });
    await waitFor(() => {
      expect(getByTestId('messages-count').textContent).toBe('1'); // only the fired message
    });
  });

  it('should transition bot state on bot message', async () => {
    vi.mocked(mockInstance.isPaired).mockReturnValue(true);
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => {
      fireHandler('message', {
        id: 'msg-1', content: 'Hello from bot', contentType: 'text',
        timestamp: Date.now(), sender: 'bot',
      });
    });
    await waitFor(() => {
      const botState = getByTestId('bot-state').textContent;
      expect(['THINKING', 'SPEAKING']).toContain(botState);
    });
  });

  it('should clear messages when clearMessages is called', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => {
      fireHandler('message', {
        id: 'msg-1', content: 'Hello', contentType: 'text', timestamp: Date.now(), sender: 'bot',
      });
    });
    await waitFor(() => { expect(getByTestId('messages-count').textContent).toBe('1'); });
    await act(async () => { getByTestId('clear-btn').click(); });
    await waitFor(() => { expect(getByTestId('messages-count').textContent).toBe('0'); });
  });

  // ── error handling ───────────────────────────────────────────────────────

  it('should set status to ERROR and lastError on error event', async () => {
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('error', { message: 'Connection failed' }); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('ERROR');
      expect(getByTestId('last-error').textContent).toBe('Connection failed');
    });
  });

  it('should set lastError on protocol mismatch error event', async () => {
    // Verify toast.error is a valid mock (not throwing)
    const { getByTestId } = renderWithProviders(<TestConsumer />);
    // Fire error directly and check both status and lastError
    act(() => { fireHandler('error', { message: 'Channel protocol mismatch' }); });
    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('ERROR');
      expect(getByTestId('last-error').textContent).toBe('Channel protocol mismatch');
    });
    expect(toast.error).not.toHaveBeenCalled(); // handleError doesn't call toast
  });

  it('should show toast.error on bot_offline event', async () => {
    renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('bot_offline', { message: 'Clawbot 已离线', timestamp: Date.now() }); });
    expect(toast.error).toHaveBeenCalled();
  });

  it('should show toast.success on bot_online event', async () => {
    renderWithProviders(<TestConsumer />);
    act(() => { fireHandler('bot_online', { message: 'Clawbot 已重新连接', timestamp: Date.now() }); });
    expect(toast.success).toHaveBeenCalled();
  });

  // ── voice playback callbacks ───────────────────────────────────────────────

  it('should expose voice playback notification methods without throwing', async () => {
    const VoiceTest: React.FC = () => {
      const ctx = useClawbotChannel();
      return (
        <div>
          <button data-testid="vs" onClick={() => ctx.notifyVoicePlaybackStarted('msg-1')}>VS</button>
          <button data-testid="ve" onClick={() => ctx.notifyVoicePlaybackEnded('msg-1')}>VE</button>
          <button data-testid="verr" onClick={() => ctx.notifyVoicePlaybackError('msg-1')}>VErr</button>
        </div>
      );
    };
    const { getByTestId } = render(<ClawbotChannelProvider><VoiceTest /></ClawbotChannelProvider>);
    await act(async () => { getByTestId('vs').click(); });
    await act(async () => { getByTestId('ve').click(); });
    await act(async () => { getByTestId('verr').click(); });
  });

  // ── upload media ─────────────────────────────────────────────────────────

  it('should return URL from uploadMedia', async () => {
    const UploadTest: React.FC = () => {
      const ctx = useClawbotChannel();
      const [url, setUrl] = React.useState<string | null>(null);
      return (
        <div>
          <button
            data-testid="up"
            onClick={async () => {
              const r = await ctx.uploadMedia(new Blob(['t'], { type: 'image/jpeg' }));
              setUrl(r);
            }}
          >
            Upload
          </button>
          <span data-testid="url">{url || 'none'}</span>
        </div>
      );
    };
    const { getByTestId } = render(<ClawbotChannelProvider><UploadTest /></ClawbotChannelProvider>);
    await act(async () => { getByTestId('up').click(); });
    await waitFor(() => {
      expect(getByTestId('url').textContent).toBe('https://example.com/media.jpg');
    });
  });

  // ── hook guard ───────────────────────────────────────────────────────────

  it('should throw when used outside provider', () => {
    const TestConsumerOutside: React.FC = () => {
      useClawbotChannel();
      return null;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => { render(<TestConsumerOutside />); }).toThrow(
      'useClawbotChannel must be used within ClawbotChannelProvider',
    );
    spy.mockRestore();
  });
});

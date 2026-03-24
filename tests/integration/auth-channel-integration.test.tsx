/**
 * Integration tests for AuthContext + ClawbotChannelContext cross-context behavior.
 *
 * These tests verify that when auth state changes, the ClawbotChannelContext
 * correctly reacts (connects/disconnects/binds user sessions).
 *
 * Environment: Node (no DOM rendering — tests cross-context/service interactions)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { type ReactNode } from 'react';

// ─── Shared mock instance + handler registry (mirrors ClawbotChannelContext.unit.test) ─

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
    clearSession: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
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

const fireHandler = (event: string, payload?: unknown) => {
  const hs = _handlers[event] || [];
  for (const h of hs) { h(payload); }
};

// ─── AuthContext mocks ────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: { username: 'tester' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
};

const mockSession = {
  access_token: 'access-token-123',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
};

const mockProfile = {
  id: 'user-123',
  username: 'tester',
  avatar_url: null,
  bio: null,
};

const {
  mockSignInWithPassword,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockUpdateLastActive,
  mockFrom,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUpdateLastActive: vi.fn().mockResolvedValue(true),
  mockFrom: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

const {
  mockUpsertSession,
  mockRevokeSession,
  mockCheckSessionValidity,
  mockTouchSession,
  mockClearLocalSessionId,
  mockGetLocalSessionId,
} = vi.hoisted(() => ({
  mockUpsertSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
  mockRevokeSession: vi.fn().mockResolvedValue(undefined),
  mockCheckSessionValidity: vi.fn().mockResolvedValue({ isValid: true, reason: 'valid' }),
  mockTouchSession: vi.fn().mockResolvedValue(undefined),
  mockClearLocalSessionId: vi.fn(),
  mockGetLocalSessionId: vi.fn().mockReturnValue('local-session-1'),
}));

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
  },
  updateLastActive: mockUpdateLastActive,
}));

vi.mock('../services/sessionService', () => ({
  upsertSession: mockUpsertSession,
  revokeSession: mockRevokeSession,
  checkSessionValidity: mockCheckSessionValidity,
  touchSession: mockTouchSession,
  clearLocalSessionId: mockClearLocalSessionId,
  getLocalSessionId: mockGetLocalSessionId,
}));

vi.mock('../utils/errorHandler', () => ({
  handleGlobalError: vi.fn(),
}));

vi.mock('../services/TrixNativeChannelClient', () => ({
  default: mockInstance,
}));

vi.mock('../contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: false,
    setVoiceEnabled: vi.fn(),
    toggleVoiceEnabled: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    clawbot: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    auth: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import {
  ClawbotChannelProvider,
  useClawbotChannel,
} from '../../src/contexts/ClawbotChannelContext';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function BothContextsConsumer({ onRendered }: { onRendered?: () => void }) {
  const auth = useAuth();
  const channel = useClawbotChannel();
  React.useEffect(() => { onRendered?.(); }, [onRendered]);
  return (
    <div>
      <span data-testid="auth-user">{auth.user ? auth.user.id : 'no-user'}</span>
      <span data-testid="auth-loading">{auth.loading ? 'loading' : 'ready'}</span>
      <span data-testid="channel-status">{channel.status}</span>
      <span data-testid="channel-pairing">{channel.pairingStatus}</span>
      <button
        data-testid="signout-btn"
        onClick={() => auth.signOut().catch(() => {})}
      >
        Sign Out
      </button>
    </div>
  );
}

const renderWithBothContexts = (onRendered?: () => void) =>
  render(
    <AuthProvider>
      <ClawbotChannelProvider>
        <BothContextsConsumer onRendered={onRendered} />
      </ClawbotChannelProvider>
    </AuthProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

let authStateChangeHandler: ((event: string, session: typeof mockSession | null) => void | Promise<void>) | null = null;

describe('AuthContext + ClawbotChannelContext integration', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(_handlers)) delete _handlers[k];
    authStateChangeHandler = null;

    // Default auth mocks
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockImplementation((handler) => {
      authStateChangeHandler = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockInstance.bindCurrentSessionToAuthUser.mockResolvedValue(true);
    mockInstance.restoreSession.mockResolvedValue(null);

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ── User login → channel notified of auth state change ──────────────────

  it('channel sets auth user id when user logs in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null });

    renderWithBothContexts();

    await waitFor(() => {
      expect(document.querySelector('[data-testid="auth-loading"]')?.textContent).toBe('ready');
    });

    expect(mockInstance.setAuthUser).toHaveBeenCalledWith(null); // initial call with no user

    // Simulate user signs in
    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(mockInstance.setAuthUser).toHaveBeenCalledWith('user-123');
    });
  });

  it('channel is notified of auth state change via SIGNED_IN event', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockInstance.restoreSession.mockResolvedValue({
      clientId: 'paired-client-id',
      pairingCode: 'ABCDEF',
      deviceId: 'device-1',
      userId: 'user-123',
    });

    const { getByTestId } = renderWithBothContexts();

    await waitFor(() => {
      expect(getByTestId('auth-loading').textContent).toBe('ready');
    });

    // After login, the channel should have restored a paired session
    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(getByTestId('channel-pairing').textContent).toBe('paired');
    });

    expect(mockInstance.bindCurrentSessionToAuthUser).toHaveBeenCalled();
  });

  // ── User logout → channel disconnects ────────────────────────────────────

  it('channel disconnects when user logs out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockInstance.restoreSession.mockResolvedValue(null);

    const { getByTestId } = renderWithBothContexts();

    await waitFor(() => {
      expect(getByTestId('auth-loading').textContent).toBe('ready');
    });

    expect(getByTestId('auth-user').textContent).toBe('user-123');

    // Simulate sign-out event
    await act(async () => {
      await authStateChangeHandler?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(mockInstance.disconnect).toHaveBeenCalled();
    });
  });

  it('channel resets session-scoped state when user is signed out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockInstance.restoreSession.mockResolvedValue(null);

    const { getByTestId } = renderWithBothContexts();

    await waitFor(() => {
      expect(getByTestId('auth-loading').textContent).toBe('ready');
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(getByTestId('channel-pairing').textContent).toBe('idle');
      expect(getByTestId('channel-status').textContent).toBe('DISCONNECTED');
    });
  });

  // ── Session restore → channel reconnects ─────────────────────────────────

  it('channel attempts to reconnect when session is restored', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockGetLocalSessionId.mockReturnValue('local-session-1');

    // Simulate a paired session being restored
    mockInstance.restoreSession.mockResolvedValue({
      clientId: 'restored-client-id',
      pairingCode: 'RESTORE',
      deviceId: 'device-2',
      userId: 'user-123',
    });

    renderWithBothContexts();

    await waitFor(() => {
      expect(document.querySelector('[data-testid="auth-loading"]')?.textContent).toBe('ready');
    });

    // After session restore, bindCurrentSessionToAuthUser should have been called
    expect(mockInstance.bindCurrentSessionToAuthUser).toHaveBeenCalled();
  });

  it('channel does not reconnect if no user is present on session restore', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderWithBothContexts();

    await waitFor(() => {
      expect(document.querySelector('[data-testid="auth-loading"]')?.textContent).toBe('ready');
    });

    // When user is null, bindCurrentSessionToAuthUser is not called
    expect(mockInstance.bindCurrentSessionToAuthUser).not.toHaveBeenCalled();
    expect(mockInstance.disconnect).not.toHaveBeenCalled();
  });

  it('channel preserves pairing status after INITIAL_SESSION event with existing session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockGetLocalSessionId.mockReturnValue('local-session-1');
    mockInstance.restoreSession.mockResolvedValue({
      clientId: 'client-id',
      pairingCode: 'INITIAL',
      deviceId: 'device-x',
      userId: 'user-123',
    });

    const { getByTestId } = renderWithBothContexts();

    await waitFor(() => {
      expect(getByTestId('auth-loading').textContent).toBe('ready');
    });

    // Simulate INITIAL_SESSION event (Supabase restoring session on page load)
    await act(async () => {
      await authStateChangeHandler?.('INITIAL_SESSION', mockSession);
    });

    await waitFor(() => {
      expect(getByTestId('channel-pairing').textContent).toBe('paired');
    });
  });
});

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: { username: 'tester' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
};

const mockSession = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
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
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignOut,
  mockUpdateLastActive,
  mockFrom,
  mockUpsertSession,
  mockRevokeSession,
  mockCheckSessionValidity,
  mockTouchSession,
  mockClearLocalSessionId,
  mockGetLocalSessionId,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockUpdateLastActive: vi.fn().mockResolvedValue(true),
  mockFrom: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            username: 'tester',
            avatar_url: null,
            bio: null,
          },
          error: null,
        }),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
  mockUpsertSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
  mockRevokeSession: vi.fn().mockResolvedValue(undefined),
  mockCheckSessionValidity: vi.fn().mockResolvedValue({ isValid: true, reason: 'valid' }),
  mockTouchSession: vi.fn().mockResolvedValue(undefined),
  mockClearLocalSessionId: vi.fn(),
  mockGetLocalSessionId: vi.fn().mockReturnValue('local-session-1'),
}));

let authStateChangeHandler: ((event: string, session: typeof mockSession | null) => void | Promise<void>) | null = null;

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
  updateLastActive: mockUpdateLastActive,
}));

vi.mock('../lib/authUtils', () => ({
  logger: {
    auth: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    error: vi.fn(),
  },
  upsertSession: mockUpsertSession,
  updateLastActive: mockUpdateLastActive,
  touchSession: mockTouchSession,
  checkSessionValidity: mockCheckSessionValidity,
  forceLogout: vi.fn(),
  getLocalSessionId: mockGetLocalSessionId,
  getOrCreateDeviceId: vi.fn().mockReturnValue('device-123'),
  AuthLogger: class {},
  SESSION_VALIDITY_CHECK_MS: 30_000,
  VALIDITY_CHECK_INTERVAL_HEARTBEATS: 10,
}));

vi.mock('../utils/errorHandler', () => ({
  handleGlobalError: vi.fn(),
}));

const Consumer = () => {
  const { loading, signIn } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <button data-testid="signin" onClick={() => signIn('test@example.com', 'password123')}>
        sign in
      </button>
    </div>
  );
};

describe('AuthContext session stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateChangeHandler = null;

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    mockOnAuthStateChange.mockImplementation((handler) => {
      authStateChangeHandler = handler;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses the existing local session during auth bootstrap', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockGetLocalSessionId.mockReturnValue('local-session-1');

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('does not create a new session for restored SIGNED_IN events', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockGetLocalSessionId.mockReturnValue('local-session-1');

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', mockSession);
    });

    expect(mockUpsertSession).not.toHaveBeenCalled();
  });

  it('keeps the user signed in when heartbeat validity temporarily reports not_found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockGetLocalSessionId.mockReturnValue('local-session-1');
    mockCheckSessionValidity.mockResolvedValue({ isValid: false, reason: 'not_found' });
    const intervalCallbacks: Array<() => Promise<void> | void> = [];
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((handler: TimerHandler) => {
      intervalCallbacks.push(handler as () => Promise<void> | void);
      return 1 as ReturnType<typeof setInterval>;
    }) as typeof setInterval);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    await act(async () => {
      await intervalCallbacks[0]?.();
      await intervalCallbacks[0]?.();
      await intervalCallbacks[0]?.();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearLocalSessionId).not.toHaveBeenCalled();
  });

  it('still creates a session after an interactive sign-in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetLocalSessionId.mockReturnValue(null);
    mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession }, error: null });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    await act(async () => {
      screen.getByTestId('signin').click();
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', mockSession);
    });

    expect(mockUpsertSession).toHaveBeenCalledWith('user-123', undefined, true);
  });
});

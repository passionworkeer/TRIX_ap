import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

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

const { mockInstance, handlers } = vi.hoisted(() => {
  const eventHandlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const instance = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!eventHandlers[event]) {
        return;
      }
      eventHandlers[event] = eventHandlers[event].filter((entry) => entry !== handler);
    }),
    removeAllListeners: vi.fn(),
    setAuthUser: vi.fn(),
    getSession: vi.fn().mockReturnValue(null),
    clearSession: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isPaired: vi.fn().mockReturnValue(false),
    checkPairingStatus: vi.fn().mockResolvedValue({ paired: false, botOnline: false, deviceId: 'device-1' }),
    bindCurrentSessionToAuthUser: vi.fn().mockResolvedValue(true),
    restoreSession: vi.fn().mockResolvedValue(null),
    pairWithCode: vi.fn(),
    pairWithQR: vi.fn(),
    sendMessage: vi.fn(),
    uploadMedia: vi.fn(),
    uploadAttachment: vi.fn(),
    unpair: vi.fn(),
    getUserId: vi.fn().mockReturnValue('user-123'),
    getOrCreateClientId: vi.fn().mockReturnValue('client-123'),
  };

  return { mockInstance: instance, handlers: eventHandlers };
});

const {
  mockSignInWithPassword,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockUpdateLastActive,
  mockFrom,
  mockUpsertSession,
  mockRevokeSession,
  mockCheckSessionValidity,
  mockTouchSession,
  mockClearLocalSessionId,
  mockGetLocalSessionId,
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
  mockUpsertSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
  mockRevokeSession: vi.fn().mockResolvedValue(undefined),
  mockCheckSessionValidity: vi.fn().mockResolvedValue({ isValid: true, reason: 'valid' }),
  mockTouchSession: vi.fn().mockResolvedValue(undefined),
  mockClearLocalSessionId: vi.fn(),
  mockGetLocalSessionId: vi.fn().mockReturnValue(null),
}));

vi.mock('../../src/config/supabase', () => ({
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

vi.mock('../../src/services/sessionService', () => ({
  upsertSession: mockUpsertSession,
  revokeSession: mockRevokeSession,
  checkSessionValidity: mockCheckSessionValidity,
  touchSession: mockTouchSession,
  clearLocalSessionId: mockClearLocalSessionId,
  getLocalSessionId: mockGetLocalSessionId,
}));

vi.mock('../../src/utils/errorHandler', () => ({
  handleGlobalError: vi.fn(),
}));

vi.mock('../../src/services/TrixNativeChannelClient', () => ({
  default: mockInstance,
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    auth: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    clawbot: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import {
  ClawbotChannelProvider,
  useClawbotChannel,
} from '../../src/contexts/ClawbotChannelContext';
import { VoiceSettingsProvider } from '../../src/contexts/VoiceSettingsContext';

function BothContextsConsumer() {
  const auth = useAuth();
  const channel = useClawbotChannel();

  return (
    <div>
      <span data-testid="auth-user">{auth.user?.id ?? 'no-user'}</span>
      <span data-testid="auth-loading">{auth.loading ? 'loading' : 'ready'}</span>
      <span data-testid="channel-status">{channel.status}</span>
      <span data-testid="channel-pairing">{channel.pairingStatus}</span>
    </div>
  );
}

function renderWithProviders() {
  return render(
    <AuthProvider>
      <VoiceSettingsProvider>
        <ClawbotChannelProvider>
          <BothContextsConsumer />
        </ClawbotChannelProvider>
      </VoiceSettingsProvider>
    </AuthProvider>,
  );
}

let authStateChangeHandler:
  | ((event: string, session: typeof mockSession | null) => void | Promise<void>)
  | null = null;

describe('AuthContext + ClawbotChannelContext integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    authStateChangeHandler = null;

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockImplementation((handler) => {
      authStateChangeHandler = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockInstance.restoreSession.mockResolvedValue(null);
    mockInstance.getSession.mockReturnValue(null);
    mockGetLocalSessionId.mockReturnValue(null);

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('starts disconnected when there is no authenticated user', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('auth-user').textContent).toBe('no-user');
    expect(screen.getByTestId('channel-status').textContent).toBe('DISCONNECTED');
    expect(screen.getByTestId('channel-pairing').textContent).toBe('idle');
    expect(mockInstance.setAuthUser).toHaveBeenCalledWith(null);
    expect(mockInstance.disconnect).toHaveBeenCalled();
    expect(mockInstance.bindCurrentSessionToAuthUser).not.toHaveBeenCalled();
  });

  it('binds and reconnects the native channel after a SIGNED_IN event', async () => {
    mockInstance.restoreSession.mockResolvedValue({
      clientId: 'client-123',
      pairingCode: 'PAIR12',
      deviceId: 'device-123',
      userId: 'user-123',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('ready');
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('user-123');
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-pairing').textContent).toBe('paired');
    });

    expect(mockInstance.setAuthUser).toHaveBeenLastCalledWith('user-123');
    expect(mockUpsertSession).toHaveBeenCalledWith('user-123', undefined, true);
    expect(mockInstance.bindCurrentSessionToAuthUser).toHaveBeenCalled();
    expect(mockInstance.restoreSession).toHaveBeenCalled();
    expect(mockInstance.connect).toHaveBeenCalled();
  });

  it('clears channel state and disconnects after a SIGNED_OUT event', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockInstance.restoreSession.mockResolvedValue({
      clientId: 'client-123',
      pairingCode: 'PAIR12',
      deviceId: 'device-123',
      userId: 'user-123',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('user-123');
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-pairing').textContent).toBe('paired');
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-user').textContent).toBe('no-user');
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-status').textContent).toBe('DISCONNECTED');
      expect(screen.getByTestId('channel-pairing').textContent).toBe('idle');
    });

    expect(mockInstance.setAuthUser).toHaveBeenLastCalledWith(null);
    expect(mockInstance.disconnect).toHaveBeenCalled();
  });
});

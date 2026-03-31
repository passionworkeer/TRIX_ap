import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
  mockShowWarning,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
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
  mockGetLocalSessionId: vi.fn().mockReturnValue(null),
  mockShowWarning: vi.fn(),
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

vi.mock('../../src/lib/authUtils', () => ({
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

vi.mock('../../src/utils/errorHandler', () => ({
  handleGlobalError: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    auth: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    error: vi.fn(),
  },
}));

vi.mock('../../src/hooks/useNotification', () => ({
  useNotification: () => ({
    showWarning: mockShowWarning,
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

import { AuthProvider } from '../../src/contexts/AuthContext';
import ProtectedRoute from '../../src/components/ProtectedRoute';

function ProtectedPage() {
  return <div data-testid="protected-content">Protected page</div>;
}

function LoginPage() {
  return <div data-testid="login-content">Login page</div>;
}

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/protected"
            element={(
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            )}
          />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

let authCallback:
  | ((event: string, session: typeof mockSession | null) => void | Promise<void>)
  | null = null;

describe('ProtectedRoute + AuthContext integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;
    mockOnAuthStateChange.mockImplementation((handler) => {
      authCallback = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('redirects unauthenticated users to /login after the redirect delay', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderWithRouter('/protected');

    await waitFor(() => {
      expect(mockShowWarning).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-content')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('allows authenticated users to stay on the protected route', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    renderWithRouter('/protected');

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    expect(mockShowWarning).not.toHaveBeenCalled();
  });

  it('redirects to /login when an authenticated session later signs out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    renderWithRouter('/protected');

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    await act(async () => {
      await authCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-content')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

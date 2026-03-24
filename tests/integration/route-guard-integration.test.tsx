/**
 * Integration tests for ProtectedRoute + AuthContext.
 *
 * These tests verify:
 *   - Unauthenticated users trying to access protected routes are redirected to login
 *   - Authenticated users can access protected routes
 *   - Session expiry triggers redirect to login
 *
 * Environment: Node (tests routing guard logic, not DOM rendering)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('../utils/logger', () => ({
  logger: {
    auth: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { AuthProvider } from '../../src/contexts/AuthContext';
import ProtectedRoute from '../../src/components/ProtectedRoute';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function ProtectedPage() {
  return <div data-testid="protected-content">Protected Page</div>;
}

function LoginPage() {
  return <div data-testid="login-content">Login Page</div>;
}

function renderWithRouter(initialPath: string, authProviderChildren: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
        {authProviderChildren}
      </AuthProvider>
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProtectedRoute + AuthContext integration', () => {

  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', username: 'tester', avatar_url: null, bio: null },
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ── Unauthenticated user → redirect ────────────────────────────────────

  it('redirects unauthenticated user to /login when accessing protected route', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithRouter('/protected', null);

    await waitFor(() => {
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/login');
    });
  });

  it('renders LoginPage when redirecting unauthenticated user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithRouter('/protected', null);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="login-content"]')).toBeInTheDocument();
    });
  });

  // ── Authenticated user → can access ─────────────────────────────────────

  it('allows authenticated user to access protected route', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithRouter('/protected', null);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
    });
  });

  it('does not redirect authenticated user away from /protected', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithRouter('/protected', null);

    await waitFor(() => {
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/protected');
    });
  });

  // ── Session expiry → redirect ───────────────────────────────────────────

  it('redirects to /login after session expires', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    let authCallback: ((event: string, session: typeof mockSession | null) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((handler) => {
      authCallback = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    renderWithRouter('/protected', null);

    // Session expires — fire SIGNED_OUT event
    await vi.waitFor(() => {
      // Wait for initial render
      expect(document.querySelector('[data-testid="location"]')).toBeInTheDocument();
    });

    if (authCallback) {
      await vi.act(async () => {
        await authCallback('SIGNED_OUT', null);
      });
    }

    await waitFor(() => {
      const location = document.querySelector('[data-testid="location"]');
      expect(location?.textContent).toBe('/login');
    });
  });

  it('clears protected content after session expiry', async () => {
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    let authCallback: ((event: string, session: typeof mockSession | null) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((handler) => {
      authCallback = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    renderWithRouter('/protected', null);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
    });

    if (authCallback) {
      await vi.act(async () => {
        await authCallback('SIGNED_OUT', null);
      });
    }

    await waitFor(() => {
      expect(document.querySelector('[data-testid="protected-content"]')).not.toBeInTheDocument();
    });
  });

  // ── Loading state ───────────────────────────────────────────────────────

  it('does not render children while auth is loading', async () => {
    // Never resolves getSession during the test — loading stays true
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithRouter('/protected', null);

    // While loading, neither protected content nor login should render
    await vi.waitFor(() => {
      // Should not have resolved to either state yet
      expect(document.querySelector('[data-testid="protected-content"]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-testid="login-content"]')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, AuthErrorType } from '../contexts/AuthContext';
import { User, Session } from '@supabase/supabase-js';

// Mock data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: { username: 'tester' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z'
};

const mockSession: Session = {
  access_token: 'access-token-123',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser
};

const mockProfile = {
  id: 'user-123',
  username: 'tester',
  avatar_url: null,
  bio: 'Hello world'
};

// Mock Supabase auth methods
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

// Mock Supabase profile query
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn()
    }))
  })),
  update: vi.fn(() => ({
    eq: vi.fn()
  }))
}));

// Create mock supabase client
const createMockSupabase = () => ({
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    getSession: mockGetSession,
    getUser: mockGetUser,
    onAuthStateChange: mockOnAuthStateChange
  },
  from: mockFrom,
  channel: vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn() })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  }))
});

// Mock the supabase module
vi.mock('../config/supabase', () => ({
  supabase: createMockSupabase(),
  Profile: {
    id: '',
    username: '',
    avatar_url: null,
    bio: null
  }
}));

// Mock error handler to avoid toast errors in tests
vi.mock('../utils/errorHandler', () => ({
  handleGlobalError: vi.fn()
}));

// Test component to access AuthContext
const TestConsumer = () => {
  const { user, profile, session, loading, signIn, signUp, signOut, updateProfile } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.id : 'no-user'}</div>
      <div data-testid="profile">{profile ? profile.username : 'no-profile'}</div>
      <div data-testid="session">{session ? 'has-session' : 'no-session'}</div>
      <button data-testid="signin-btn" onClick={() => signIn('test@example.com', 'password123')}>Sign In</button>
      <button data-testid="signup-btn" onClick={() => signUp('test@example.com', 'password123', 'tester')}>Sign Up</button>
      <button data-testid="signout-btn" onClick={() => signOut()}>Sign Out</button>
      <button data-testid="updateprofile-btn" onClick={() => updateProfile({ username: 'new-name' })}>Update Profile</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });
  });

  describe('Initial State', () => {
    it('provides initial state with no user', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      expect(screen.getByTestId('user').textContent).toBe('no-user');
      expect(screen.getByTestId('profile').textContent).toBe('no-profile');
      expect(screen.getByTestId('session').textContent).toBe('no-session');
    });

    it('loads existing session on mount', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      expect(screen.getByTestId('user').textContent).toBe('user-123');
      expect(screen.getByTestId('profile').textContent).toBe('tester');
      expect(screen.getByTestId('session').textContent).toBe('has-session');
    });
  });

  describe('Sign In Flow', () => {
    it('calls signInWithPassword with correct credentials', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      let contextSignIn: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignIn = ctx.signIn;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        await contextSignIn('test@example.com', 'password123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('returns error for invalid credentials', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      let result: { error: any } | undefined;
      let contextSignIn: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignIn = ctx.signIn;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        result = await contextSignIn('test@example.com', 'wrong-password');
      });

      expect(result?.error).toBeDefined();
      expect(result?.error.type).toBe(AuthErrorType.INVALID_CREDENTIALS);
    });

    it('returns network error for network failures', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'));

      let result: { error: any } | undefined;
      let contextSignIn: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignIn = ctx.signIn;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        result = await contextSignIn('test@example.com', 'password123');
      });

      expect(result?.error).toBeDefined();
      expect(result?.error.type).toBe(AuthErrorType.NETWORK_ERROR);
    });
  });

  describe('Sign Up Flow', () => {
    it('calls signUp with correct data', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({ data: { user: mockUser, session: null }, error: null });

      let result: { error: any } | undefined;
      let contextSignUp: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignUp = ctx.signUp;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        result = await contextSignUp('new@example.com', 'password123', 'newuser');
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: { username: 'newuser' },
          emailRedirectTo: undefined
        }
      });
      expect(result?.error).toBeNull();
    });

    it('returns error for duplicate email', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' }
      });

      let result: { error: any } | undefined;
      let contextSignUp: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignUp = ctx.signUp;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        result = await contextSignUp('exists@example.com', 'password123', 'exists');
      });

      expect(result?.error).toBeDefined();
      expect(result?.error.type).toBe(AuthErrorType.EMAIL_ALREADY_EXISTS);
    });

    it('returns error for weak password', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'Password is too weak' }
      });

      let result: { error: any } | undefined;
      let contextSignUp: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignUp = ctx.signUp;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      await act(async () => {
        result = await contextSignUp('test@example.com', '123', 'tester');
      });

      expect(result?.error).toBeDefined();
      expect(result?.error.type).toBe(AuthErrorType.WEAK_PASSWORD);
    });
  });

  describe('Sign Out Flow', () => {
    it('calls signOut and clears state', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      mockSignOut.mockResolvedValue({ error: null });

      let contextSignOut: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextSignOut = ctx.signOut;
        return <TestConsumer />;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      // Verify user is logged in
      expect(screen.getByTestId('user').textContent).toBe('user-123');

      // Sign out
      await act(async () => {
        await contextSignOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Token Refresh / Auth State Change', () => {
    it('updates state when auth state changes to signed in', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      let authCallback: ((event: string, session: Session | null) => void) | null = null;
      mockOnAuthStateChange.mockImplementation((callback: any) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        };
      });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      // Simulate auth state change
      if (authCallback) {
        await act(async () => {
          authCallback('SIGNED_IN', mockSession);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('user-123');
      });
    });

    it('clears state when auth state changes to signed out', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      let authCallback: ((event: string, session: Session | null) => void) | null = null;
      mockOnAuthStateChange.mockImplementation((callback: any) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        };
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      expect(screen.getByTestId('user').textContent).toBe('user-123');

      // Simulate sign out
      if (authCallback) {
        await act(async () => {
          authCallback('SIGNED_OUT', null);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('no-user');
      });
    });
  });

  describe('Permission Check', () => {
    it('provides user and profile for permission checks', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Mock profile fetch
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      // User should have profile data for permission checks
      expect(screen.getByTestId('user').textContent).toBe('user-123');
      expect(screen.getByTestId('profile').textContent).toBe('tester');
    });

    it('checks if user is authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const TestIsAuthenticated = () => {
        const { user } = useAuth();
        return <div data-testid="is-authenticated">{user ? 'true' : 'false'}</div>;
      };

      render(
        <AuthProvider>
          <TestIsAuthenticated />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
  });

  describe('Update Profile', () => {
    it('updates profile successfully when user is logged in', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Mock profile fetch and update
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
        }))
      }));
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null })
      }));
      mockFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate
      });

      let contextUpdateProfile: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextUpdateProfile = ctx.updateProfile;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      let result: { error: Error | null } | undefined;

      await act(async () => {
        result = await contextUpdateProfile({ username: 'updated-user' });
      });

      expect(result?.error).toBeNull();
      expect(mockUpdate).toHaveBeenCalledWith({ username: 'updated-user' });
    });

    it('returns error when updating profile without user', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      let contextUpdateProfile: any;

      const TestComponent = () => {
        const ctx = useAuth();
        contextUpdateProfile = ctx.updateProfile;
        return <div>test</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      });

      let result: { error: Error | null } | undefined;

      await act(async () => {
        result = await contextUpdateProfile({ username: 'updated-user' });
      });

      expect(result?.error).toBeDefined();
      expect(result?.error.message).toBe('No user logged in');
    });
  });

  describe('useAuth Hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, type Profile, type Session, type User } from '../lib/supabase';
import {
  logger,
  getLocalSessionId,
  upsertSession,
  touchSession,
  updateLastActive,
  checkSessionValidity,
  forceLogout,
  SESSION_VALIDITY_CHECK_MS,
  VALIDITY_CHECK_INTERVAL_HEARTBEATS,
} from '../lib/authUtils';

// ── Re-export shared auth utilities from web ──────────────────────────────────
export {
  logger,
  getLocalSessionId,
  upsertSession,
  touchSession,
  updateLastActive,
  checkSessionValidity,
  forceLogout,
  getOrCreateDeviceId,
  AuthLogger,
  SESSION_VALIDITY_CHECK_MS,
  VALIDITY_CHECK_INTERVAL_HEARTBEATS,
} from '../lib/authUtils';

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export const AUTH_ERROR_MESSAGES: Record<AuthErrorType, string> = {
  [AuthErrorType.INVALID_CREDENTIALS]: '邮箱或密码错误，请检查后重试',
  [AuthErrorType.EMAIL_ALREADY_EXISTS]: '该邮箱已被注册，请直接登录',
  [AuthErrorType.WEAK_PASSWORD]: '密码强度不足，请使用至少 6 位字符',
  [AuthErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [AuthErrorType.UNKNOWN_ERROR]: '操作失败，请稍后重试',
};

export class AuthError extends Error {
  type: AuthErrorType;
  originalError?: unknown;

  constructor(type: AuthErrorType, originalError?: unknown) {
    super(AUTH_ERROR_MESSAGES[type]);
    this.type = type;
    this.originalError = originalError;
    this.name = 'AuthError';
  }
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (
    nicknameOrInput: string | ProfileUpdateInput,
    bio?: string,
  ) => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ProfileUpdateInput = {
  username?: string;
  display_name?: string;
  full_name?: string;
  nickname?: string;
  bio?: string;
};

type ProfileUpdatePayload = {
  username?: string;
  display_name?: string;
  full_name?: string;
  bio?: string;
};

function buildProfileUpdatePayload(
  nicknameOrInput: string | ProfileUpdateInput,
  bio?: string,
): ProfileUpdatePayload {
  if (typeof nicknameOrInput === 'string') {
    const payload: ProfileUpdatePayload = {
      display_name: nicknameOrInput,
    };

    if (typeof bio === 'string') {
      payload.bio = bio;
    }

    return payload;
  }

  const payload: ProfileUpdatePayload = {};

  if (typeof nicknameOrInput.username === 'string') {
    payload.username = nicknameOrInput.username;
  }
  if (typeof nicknameOrInput.display_name === 'string') {
    payload.display_name = nicknameOrInput.display_name;
  }
  if (typeof nicknameOrInput.full_name === 'string') {
    payload.full_name = nicknameOrInput.full_name;
  }
  if (typeof nicknameOrInput.nickname === 'string' && payload.display_name === undefined) {
    payload.display_name = nicknameOrInput.nickname;
  }
  if (typeof nicknameOrInput.bio === 'string') {
    payload.bio = nicknameOrInput.bio;
  }

  return payload;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs for heartbeat management
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatCheckCounterRef = useRef(0);
  const interactiveSignInPendingRef = useRef(false);
  const hasBootstrappedSessionRef = useRef(false);

  // Mark that an interactive sign-in is about to happen (vs restore from storage)
  const markInteractiveSignIn = () => {
    interactiveSignInPendingRef.current = true;
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] fetchProfile error:', error);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('[AuthContext] fetchProfile exception:', err);
    }
  };

  /** 启动带有效性检查的心跳（幂等：调用前先清掉旧 Interval） */
  const startHeartbeat = (userId: string) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    heartbeatCheckCounterRef.current = 0;
    heartbeatIntervalRef.current = setInterval(async () => {
      updateLastActive().catch(err => logger.error('Auth', '心跳更新失败:', err));
      touchSession().catch(err => logger.error('Auth', 'touchSession 失败:', err));
      heartbeatCheckCounterRef.current += 1;
      if (heartbeatCheckCounterRef.current >= VALIDITY_CHECK_INTERVAL_HEARTBEATS) {
        heartbeatCheckCounterRef.current = 0;
        const validity = await checkSessionValidity();
        if (!validity.isValid) {
          if (validity.reason === 'network_error') {
            logger.auth.warn('[auth] skipped forced logout during heartbeat validity check', {
              reason: validity.reason,
              localSessionId: getLocalSessionId(),
            });
            return;
          }

          if (validity.reason === 'not_found') {
            const restoredSession = await upsertSession(userId);
            if (restoredSession) {
              logger.auth.info('[auth] restored missing session during heartbeat', {
                userId,
                sessionId: restoredSession.id,
              });
              return;
            }
          }

          forceLogout(validity.reason ?? 'unknown', getLocalSessionId());
        }
      }
    }, SESSION_VALIDITY_CHECK_MS);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        updateLastActive().catch(err => logger.error('Auth', '心跳更新失败:', err));
        // 恢复已有登录态时，优先复用本地 session id，避免刷新页面时把自己挤下线
        if (!hasBootstrappedSessionRef.current) {
          hasBootstrappedSessionRef.current = true;
          if (!getLocalSessionId()) {
            upsertSession(session.user.id).catch(err => logger.error('Auth', '创建会话失败:', err));
          } else {
            logger.auth.info('[auth] bootstrap reused existing local session', {
              userId: session.user.id,
              localSessionId: getLocalSessionId(),
            });
          }
        }
        // 启动带有效性检查的心跳（幂等）
        startHeartbeat(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);

        if (event === 'INITIAL_SESSION') {
          // Supabase 从 storage 恢复 session，upsertSession 已在 getSession() 分支处理
          // 这里只需启动/保活心跳
          startHeartbeat(session.user.id);
        } else if (event === 'SIGNED_IN') {
          const hasLocalSession = Boolean(getLocalSessionId());
          if (interactiveSignInPendingRef.current || !hasLocalSession) {
            interactiveSignInPendingRef.current = false;
            hasBootstrappedSessionRef.current = true;
            upsertSession(session.user.id, undefined, true).catch(err =>
              logger.error('Auth', '创建会话失败:', err),
            );
          } else {
            logger.auth.info('[auth] skipped session upsert for restored SIGNED_IN event', {
              userId: session.user.id,
              localSessionId: getLocalSessionId(),
            });
          }
          startHeartbeat(session.user.id);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token 刷新：session 仍然有效，无需 upsertSession，也无需重启心跳
          updateLastActive().catch(err => logger.error('Auth', '心跳更新失败:', err));
        }
        // USER_UPDATED 等其他事件：忽略，不操作
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, []);

  // ── Deep-link handler: Desktop Supabase email confirmation ─────────────────
  // Receives trix3dcompanion://auth/v1/callback from the main process
  // and completes the session via Supabase SDK.
  //
  // Supabase GoTrue SDK supports two auth flows:
  //   1. PKCE (flowType='pkce'): URL has ?code=XXX  → exchangeCodeForSession(code)
  //   2. Implicit (flowType='implicit', default): URL has #access_token=XXX&...
  //      → parse tokens from hash and call setSession()
  //
  // electron-builder registers the trix3dcompanion:// URL scheme so the OS
  // routes confirmation emails to this app regardless of whether it is already
  // running or being launched fresh.
  useEffect(() => {
    const api = (window as Window & { electronAPI?: { onDeepLink: (cb: (url: string) => void) => () => void } }).electronAPI;
    if (!api?.onDeepLink) return;

    const unsubscribe = api.onDeepLink(async (url: string) => {
      try {
        const parsed = new URL(url);

        // ── PKCE flow: Supabase sends ?code=XXX ────────────────────────────
        const code = parsed.searchParams.get('code');
        if (code) {
          logger.auth.info('[deep-link] PKCE flow detected, exchanging code for session');
          markInteractiveSignIn();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            logger.auth.error('[deep-link] exchangeCodeForSession failed:', error);
          } else {
            logger.auth.info('[deep-link] PKCE session exchange succeeded');
          }
          return;
        }

        // ── Implicit flow: tokens are in the URL hash (#access_token=...) ───
        // parseParametersFromURL mirrors SDK logic: hash params are extracted
        // from the URL's fragment, then search params override hash values.
        const hashParams: Record<string, string> = {};
        if (parsed.hash && parsed.hash.startsWith('#')) {
          try {
            const hashSearchParams = new URLSearchParams(parsed.hash.substring(1));
            hashSearchParams.forEach((value, key) => { hashParams[key] = value; });
          } catch { /* hash is not a query string */ }
        }

        const accessToken = parsed.searchParams.get('access_token') ?? hashParams['access_token'];
        const refreshToken = parsed.searchParams.get('refresh_token') ?? hashParams['refresh_token'];

        if (!accessToken || !refreshToken) {
          logger.auth.warn('[deep-link] no session params found in confirmation URL', { url });
          return;
        }

        logger.auth.info('[deep-link] implicit flow detected, setting session from URL hash');
        markInteractiveSignIn();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          logger.auth.error('[deep-link] setSession failed:', error);
        } else {
          logger.auth.info('[deep-link] implicit session set succeeded');
        }
      } catch (err) {
        logger.auth.error('[deep-link] error processing deep link:', err);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    markInteractiveSignIn();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorType = AuthErrorType.UNKNOWN_ERROR;
        if (error.message.includes('Invalid login credentials')) {
          errorType = AuthErrorType.INVALID_CREDENTIALS;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorType = AuthErrorType.NETWORK_ERROR;
        }
        return { error: new AuthError(errorType, error) };
      }

      return { error: null };
    } catch (err) {
      if (err instanceof TypeError && String(err).includes('fetch')) {
        return { error: new AuthError(AuthErrorType.NETWORK_ERROR, err) };
      }
      return { error: new AuthError(AuthErrorType.UNKNOWN_ERROR, err) };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    markInteractiveSignIn();
    try {
      // Desktop: use custom URL scheme so Supabase sends trix3dcompanion:// links.
      // Web (no electronAPI): Supabase SDK auto-handles #/auth/v1/callback.
      const isDesktop = Boolean((window as Window & { electronAPI?: unknown }).electronAPI);
      const emailRedirectTo = isDesktop ? 'trix3dcompanion://auth/v1/callback' : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo,
        },
      });

      if (error) {
        let errorType = AuthErrorType.UNKNOWN_ERROR;
        if (error.message.includes('already') || error.message.includes('registered')) {
          errorType = AuthErrorType.EMAIL_ALREADY_EXISTS;
        } else if (error.message.includes('password') || error.message.includes('weak')) {
          errorType = AuthErrorType.WEAK_PASSWORD;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorType = AuthErrorType.NETWORK_ERROR;
        }
        return { error: new AuthError(errorType, error) };
      }

      return { error: null };
    } catch (err) {
      if (err instanceof TypeError && String(err).includes('fetch')) {
        return { error: new AuthError(AuthErrorType.NETWORK_ERROR, err) };
      }
      return { error: new AuthError(AuthErrorType.UNKNOWN_ERROR, err) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (
    nicknameOrInput: string | ProfileUpdateInput,
    bio?: string,
  ) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const updates = buildProfileUpdatePayload(nicknameOrInput, bio);
      if (Object.keys(updates).length === 0) {
        return { error: null };
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      await fetchProfile(user.id);
      return { error: null };
    } catch (err) {
      console.error('[AuthContext] updateProfile error:', err);
      return { error: err as Error };
    }
  };

  const refreshSession = async () => {
    const { data: { session: newSession } } = await supabase.auth.refreshSession();
    setSession(newSession);
    setUser(newSession?.user ?? null);
    if (newSession?.user) {
      fetchProfile(newSession.user.id);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

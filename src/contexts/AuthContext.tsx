import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile, updateLastActive } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import {
  buildDemoSession,
  getDemoProfile,
  isDemoModeEnabled,
  setDemoModeEnabled,
  updateDemoProfile,
} from '../mocks/demoData';

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export const AUTH_ERROR_MESSAGES: Record<AuthErrorType, string> = {
  [AuthErrorType.INVALID_CREDENTIALS]: '邮箱或密码错误，请检查后重试',
  [AuthErrorType.EMAIL_ALREADY_EXISTS]: '该邮箱已注册，请直接登录',
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
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveAuthErrorType(message: string): AuthErrorType {
  if (message.includes('Invalid login credentials')) {
    return AuthErrorType.INVALID_CREDENTIALS;
  }

  if (message.includes('already') || message.includes('registered')) {
    return AuthErrorType.EMAIL_ALREADY_EXISTS;
  }

  if (message.includes('password') || message.includes('weak')) {
    return AuthErrorType.WEAK_PASSWORD;
  }

  if (message.includes('network') || message.includes('fetch')) {
    return AuthErrorType.NETWORK_ERROR;
  }

  return AuthErrorType.UNKNOWN_ERROR;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => isDemoModeEnabled());

  const applyDemoAuthState = React.useCallback(() => {
    const demoSession = buildDemoSession();
    const demoProfile = getDemoProfile();

    setIsDemoMode(true);
    setSession(demoSession);
    setUser(demoSession.user);
    setProfile(demoProfile);
    setLoading(false);
  }, []);

  const fetchProfile = React.useCallback(async (userId: string) => {
    if (isDemoModeEnabled()) {
      setProfile(getDemoProfile());
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      handleGlobalError(error, '获取用户信息失败');
    }
  }, []);

  useEffect(() => {
    let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

    if (isDemoModeEnabled()) {
      applyDemoAuthState();
      return undefined;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
        updateLastActive().catch(() => undefined);
        heartbeatInterval = setInterval(() => {
          updateLastActive().catch(() => undefined);
        }, 60000);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isDemoModeEnabled()) {
        applyDemoAuthState();
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      if (nextSession?.user) {
        fetchProfile(nextSession.user.id);
        updateLastActive().catch(() => undefined);
        heartbeatInterval = setInterval(() => {
          updateLastActive().catch(() => undefined);
        }, 60000);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [applyDemoAuthState, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: new AuthError(resolveAuthErrorType(error.message), error) };
      }

      setIsDemoMode(false);
      setDemoModeEnabled(false);
      return { error: null };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { error: new AuthError(AuthErrorType.NETWORK_ERROR, error) };
      }

      return { error: new AuthError(AuthErrorType.UNKNOWN_ERROR, error) };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        return { error: new AuthError(resolveAuthErrorType(error.message), error) };
      }

      return { error: null };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { error: new AuthError(AuthErrorType.NETWORK_ERROR, error) };
      }

      return { error: new AuthError(AuthErrorType.UNKNOWN_ERROR, error) };
    }
  };

  const enterDemoMode = async () => {
    setDemoModeEnabled(true);
    applyDemoAuthState();
  };

  const signOut = async () => {
    if (isDemoModeEnabled()) {
      setDemoModeEnabled(false);
      setIsDemoMode(false);
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    if (isDemoModeEnabled()) {
      const nextProfile = updateDemoProfile(updates);
      setProfile(nextProfile);
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      handleGlobalError(error, '更新用户信息失败');
      return { error: error as Error };
    }
  };

  const refreshProfile = async () => {
    if (!user) {
      return;
    }

    if (isDemoModeEnabled()) {
      setProfile(getDemoProfile());
      return;
    }

    await fetchProfile(user.id);
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    isDemoMode,
    signIn,
    signUp,
    signOut,
    enterDemoMode,
    updateProfile,
    refreshProfile,
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

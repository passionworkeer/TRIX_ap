import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, updateLastActive } from '../config/supabase';
import {
  upsertSession,
  revokeSession,
  checkSessionValidity,
  touchSession,
  clearLocalSessionId,
  getLocalSessionId,
} from '../services/sessionService';
import { handleGlobalError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

// 错误类型枚举
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 错误消息映射
export const AUTH_ERROR_MESSAGES: Record<AuthErrorType, string> = {
  [AuthErrorType.INVALID_CREDENTIALS]: '邮箱或密码错误，请检查后重试',
  [AuthErrorType.EMAIL_ALREADY_EXISTS]: '该邮箱已被注册，请直接登录',
  [AuthErrorType.WEAK_PASSWORD]: '密码强度不足，请使用至少 6 位字符',
  [AuthErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [AuthErrorType.UNKNOWN_ERROR]: '操作失败，请稍后重试',
};

// 自定义认证错误类
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
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// 常量
// ============================================

/** 心跳间隔：60 秒 */
const HEARTBEAT_INTERVAL_MS = 60000;
/**
 * 心跳有效性检查频率（每 N 次心跳检查一次，约 N 分钟）
 * 生产：3（3 分钟）；演示：1（15 秒）
 */
const VALIDITY_CHECK_INTERVAL_HEARTBEATS = 3;

// ============================================
// 辅助函数
// ============================================

/** 强制登出，跳转到登录页 */
function forceLogout(reason: string, localSessionId: string | null) {
  logger.auth.warn(`[auth] forced logout reason=${reason}`, { reason, localSessionId, timestamp: new Date().toISOString() });
  clearLocalSessionId();
  supabase.auth.signOut();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /** 心跳计数器：每 VALIDITY_CHECK_INTERVAL_HEARTBEATS 次检查一次有效性 */
  const heartbeatCheckCounterRef = useRef(0);

  /** 防止 getSession + onAuthStateChange 双重调用 upsertSession 的护栏 */
  const hasBootstrappedSessionRef = useRef(false);

  /** 仅在用户主动登录时允许 SIGNED_IN 创建新 DB session，避免恢复态自挤掉自己 */
  const interactiveSignInPendingRef = useRef(false);

  /** 心跳 interval ID（使用 ref 而非闭包变量，确保 onAuthStateChange 回调可访问） */
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      // 使用统一的错误处理器记录日志
      handleGlobalError(error, '获取用户信息失败');
    }
  };

  /** 启动带有效性检查的心跳（幂等：调用前先清掉旧 interval） */
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

          forceLogout(validity.reason, getLocalSessionId());
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  // Initialize auth state
  useEffect(() => {
    // 1. getSession() 是页面加载时 Supabase 恢复已有 session 的同步入口
    //    不要在 onAuthStateChange('INITIAL_SESSION') 里再次 upsertSession
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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

    // 2. onAuthStateChange 处理所有后续 auth 事件，按事件类型分流
    //    核心原则：INITIAL_SESSION 不创建 DB session（session 已被 getSession 恢复）
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
        // SIGNED_OUT 或其他使 session 变 null 的事件
        interactiveSignInPendingRef.current = false;
        setProfile(null);
        clearLocalSessionId();
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
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

  const signIn = async (email: string, password: string) => {
    try {
      interactiveSignInPendingRef.current = true;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // 根据错误类型映射到具体的错误类型
        let errorType = AuthErrorType.UNKNOWN_ERROR;

        if (error.message.includes('Invalid login credentials')) {
          errorType = AuthErrorType.INVALID_CREDENTIALS;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorType = AuthErrorType.NETWORK_ERROR;
        }

        // 记录登录失败（安全审计）
        logger.auth.warn(`[安全事件] 登录失败 — email: ${email}, error: ${error.message}`);
        interactiveSignInPendingRef.current = false;

        return { error: new AuthError(errorType, error) };
      }

      // 登录成功：创建会话记录（等待 auth 状态变更触发即可，onAuthStateChange 会处理）
      return { error: null };
    } catch (error) {
      // 捕获网络错误等异常
      interactiveSignInPendingRef.current = false;
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
          emailRedirectTo: undefined, // 禁用邮箱确认重定向
        },
      });

      if (error) {
        // 根据错误类型映射到具体的错误类型
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
    } catch (error) {
      // 捕获网络错误等异常
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { error: new AuthError(AuthErrorType.NETWORK_ERROR, error) };
      }
      return { error: new AuthError(AuthErrorType.UNKNOWN_ERROR, error) };
    }
  };

  const signOut = async () => {
    interactiveSignInPendingRef.current = false;
    await revokeSession();
    clearLocalSessionId();
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile after update
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      // 使用统一的错误处理器记录日志
      handleGlobalError(error, '更新用户信息失败');
      return { error: error as Error };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
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

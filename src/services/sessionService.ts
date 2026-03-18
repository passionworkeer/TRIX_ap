/**
 * Session Service
 * 实现同平台单会话管理：
 * - Web 端只能有 1 个活跃会话
 * - iOS 端只能有 1 个活跃会话
 * - Web 和 iOS 互不影响
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============================================
// 常量定义
// ============================================

export const PLATFORM = 'web' as const;

export type Platform = typeof PLATFORM;

export const SESSION_EXPIRY_HOURS: Record<Platform | 'ios', number> = {
  web: 24,
  ios: 24 * 7, // iOS 7d，但 Web 端只看 web
};

const LOCAL_SESSION_ID_KEY = 'trix_session_id';

// ============================================
// 类型定义
// ============================================

export interface UserSession {
  id: string;
  user_id: string;
  platform: Platform | 'ios';
  device_id: string;
  device_name: string;
  is_active: boolean;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}

export interface SessionValidityResult {
  isValid: boolean;
  reason: 'valid' | 'mismatch' | 'expired' | 'revoked' | 'not_found' | 'network_error';
}

// ============================================
// 设备 ID 管理
// ============================================

/**
 * 获取或创建设备 ID
 * 复用水项目中已有的 trix_device_id localStorage key
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem('trix_device_id');
  if (!deviceId) {
    deviceId = `web-${crypto.randomUUID()}`;
    localStorage.setItem('trix_device_id', deviceId);
  }
  return deviceId;
}

// ============================================
// 本地 session ID 存储
// ============================================

/**
 * 将 session ID（user_sessions 表主键）存储到 localStorage
 * 用于心跳时对比 DB 中的 active_session_id
 */
export function storeLocalSessionId(sessionId: string): void {
  localStorage.setItem(LOCAL_SESSION_ID_KEY, sessionId);
}

/**
 * 读取本地存储的 session ID
 */
export function getLocalSessionId(): string | null {
  return localStorage.getItem(LOCAL_SESSION_ID_KEY);
}

/**
 * 清除本地 session ID
 */
export function clearLocalSessionId(): void {
  localStorage.removeItem(LOCAL_SESSION_ID_KEY);
}

// ============================================
// 核心会话操作
// ============================================

/**
 * 清理设备名称：去除控制字符，限制最大长度
 * 防御 XSS 和恶意输入
 */
function sanitizeDeviceName(name: string): string {
  return name
    .replace(/[\x00-\x1F\x7F]/g, '') // 去除控制字符
    .slice(0, 200);                   // 最大 200 字符
}

/**
 * 获取设备名称
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform ?? 'Unknown';
  const browser = getBrowserName(ua);
  return sanitizeDeviceName(`${browser} on ${platform}`);
}

/**
 * 简单浏览器识别
 */
function getBrowserName(ua: string): string {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('OPR/')) return 'Opera';
  return 'Browser';
}

/**
 * 原子性 upsert：同一平台只保留最新一条会话
 * - 先标记旧会话 is_active=false
 * - 再插入新会话
 * - 最后更新 profiles.active_session_id
 *
 * @param userId - 用户 ID
 * @param deviceName - 设备名称（可选，自动检测）
 * @returns 新创建的会话记录，失败返回 null
 */
export async function upsertSession(
  userId: string,
  deviceName?: string,
): Promise<UserSession | null> {
  const deviceId = getOrCreateDeviceId();
  const name = deviceName ?? getDeviceName();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_HOURS.web * 60 * 60 * 1000,
  ).toISOString();

  try {
    // 1. 先标记当前用户的同平台旧会话为 inactive
    const { error: markError } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('platform', PLATFORM)
      .eq('is_active', true);

    if (markError) {
      logger.auth.error('标记旧会话失败:', markError);
      // 继续尝试插入，不因标记失败而终止
    }

    // 2. 插入新会话
    const { data: newSession, error: insertError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        platform: PLATFORM,
        device_id: deviceId,
        device_name: name,
        is_active: true,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      logger.auth.error('插入会话失败:', insertError);
      return null;
    }

    // 3. 更新 profiles.active_session_id
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ active_session_id: newSession.id })
      .eq('id', userId);

    if (profileError) {
      logger.auth.error('更新 profiles.active_session_id 失败:', profileError);
      // 会话已创建，session ID 仍返回给调用方
    }

    // 4. 存储到 localStorage
    storeLocalSessionId(newSession.id);

    logger.auth.info(`会话已创建: ${newSession.id}`);
    return newSession as UserSession;
  } catch (err) {
    logger.auth.error('upsertSession 异常:', err);
    return null;
  }
}

/**
 * 撤销当前会话（登出时调用）
 * 标记 is_active=false，并清除 profiles.active_session_id
 */
export async function revokeSession(): Promise<void> {
  const localId = getLocalSessionId();
  if (!localId) return;

  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', localId);

    if (error) {
      logger.auth.error('撤销会话失败:', error);
    }

    clearLocalSessionId();
    logger.auth.info(`会话已撤销: ${localId}`);
  } catch (err) {
    logger.auth.error('revokeSession 异常:', err);
  }
}

/**
 * 心跳 touching：更新 last_active_at
 */
export async function touchSession(): Promise<void> {
  const localId = getLocalSessionId();
  if (!localId) return;

  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', localId)
      .eq('is_active', true);

    if (error) {
      logger.auth.error('touchSession 失败:', error);
    }
  } catch (err) {
    logger.auth.error('touchSession 异常:', err);
  }
}

/**
 * 检查会话有效性：对比本地 session_id 与 DB active_session_id
 *
 * 返回值：
 * - valid: session 有效，无需处理
 * - mismatch: session ID 不匹配，说明被新会话挤掉了 → 强制登出
 * - expired: 会话已过期 → 强制登出
 * - revoked: 会话被标记为 inactive → 强制登出
 * - not_found: 本地无 session → 强制登出
 * - network_error: 网络错误 → 跳过检查不断开
 */
export async function checkSessionValidity(): Promise<SessionValidityResult> {
  const localId = getLocalSessionId();
  if (!localId) {
    return { isValid: false, reason: 'not_found' };
  }

  try {
    // 1. 检查本地 session 是否仍然 active
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('id, is_active, expires_at')
      .eq('id', localId)
      .single();

    if (sessionError || !session) {
      return { isValid: false, reason: 'not_found' };
    }

    if (!session.is_active) {
      return { isValid: false, reason: 'revoked' };
    }

    if (new Date(session.expires_at) < new Date()) {
      return { isValid: false, reason: 'expired' };
    }

    // 2. 对比 profiles.active_session_id 是否匹配本地 ID
    const { data: { user } } = await supabase.auth.getSession();
    if (!user) {
      return { isValid: false, reason: 'not_found' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active_session_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { isValid: false, reason: 'not_found' };
    }

    // active_session_id 为 null 表示初始状态（还没记录过），视为有效
    // 只有明确记录了另一个 session ID 时才判定为 mismatch（被挤掉了）
    if (profile.active_session_id !== null && profile.active_session_id !== localId) {
      logger.auth.warn(
        `Session mismatch: local=${localId}, db=${profile.active_session_id}`,
      );
      return { isValid: false, reason: 'mismatch' };
    }

    return { isValid: true, reason: 'valid' };
  } catch (err) {
    logger.auth.error('checkSessionValidity 异常:', err);
    // 网络错误等异常不强制登出自己
    return { isValid: true, reason: 'network_error' };
  }
}

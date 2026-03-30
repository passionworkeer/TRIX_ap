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
  return Array.from(name)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .slice(0, 200);
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
 * 原子性 upsert：同一平台只保留一条会话记录
 * - user_sessions 对 (user_id, platform) 有唯一约束
 * - 因此这里直接 upsert，同步刷新设备信息、过期时间和活跃时间
 * - profiles.active_session_id 仅做兼容写入，不再作为同平台踢线判断依据
 *
 * @param userId - 用户 ID
 * @param deviceName - 设备名称（可选，自动检测）
 * @param forceCreateNew - 保留兼容签名；当前表结构下会复用同一平台记录
 * @returns 最新会话记录，失败返回 null
 */
export async function upsertSession(
  userId: string,
  deviceName?: string,
  forceCreateNew: boolean = false,
): Promise<UserSession | null> {
  const deviceId = getOrCreateDeviceId();
  const name = deviceName ?? getDeviceName();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_HOURS.web * 60 * 60 * 1000,
  ).toISOString();

  logger.auth.info('[session] upsert start', { userId, forceCreateNew });

  try {
    const { data: newSession, error: upsertError } = await supabase
      .from('user_sessions')
      .upsert({
        user_id: userId,
        platform: PLATFORM,
        device_id: deviceId,
        device_name: name,
        is_active: true,
        last_active_at: now,
        expires_at: expiresAt,
      }, {
        onConflict: 'user_id,platform',
      })
      .select()
      .single();

    if (upsertError) {
      logger.auth.error('[session] upsert row failed', { error: upsertError });
      return null;
    }

    // 更新 profiles.active_session_id（使用 upsert 返回的 session ID，消除 race 窗口）
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ active_session_id: newSession.id })
      .eq('id', userId);

    if (profileError) {
      logger.auth.error('[session] update profiles.active_session_id failed', { error: profileError });
      // 会话已创建，session ID 仍返回给调用方
    }

    storeLocalSessionId(newSession.id);

    logger.auth.info('[session] upsert complete', {
      sessionId: newSession.id,
      activeSessionId: newSession.id,
    });
    return newSession as UserSession;
  } catch (err) {
    logger.auth.error('[session] upsert failed', { error: err });
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
  const deviceId = getOrCreateDeviceId();

  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .match({ id: localId, device_id: deviceId });

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
  const deviceId = getOrCreateDeviceId();

  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .match({ id: localId, device_id: deviceId, is_active: true });

    if (error) {
      logger.auth.error('touchSession 失败:', error);
    }
  } catch (err) {
    logger.auth.error('touchSession 异常:', err);
  }
}

/**
 * 检查会话有效性：校验当前平台 session row 是否仍属于本设备
 *
 * 返回值：
 * - valid: session 有效，无需处理
 * - mismatch: 当前平台会话已被其他设备接管 → 强制登出
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
  const localDeviceId = getOrCreateDeviceId();

  try {
    // 同平台唯一 row 会在新设备登录时被 upsert 覆盖，因此要同时核对 device_id。
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('id, is_active, expires_at, device_id')
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

    if (session.device_id !== localDeviceId) {
      logger.auth.warn('[session] mismatch detected', {
        localId,
        localDeviceId,
        sessionDeviceId: session.device_id,
      });
      return { isValid: false, reason: 'mismatch' };
    }

    return { isValid: true, reason: 'valid' };
  } catch (err) {
    logger.auth.error('checkSessionValidity 异常:', err);
    // 网络错误等异常不强制登出自己
    return { isValid: true, reason: 'network_error' };
  }
}

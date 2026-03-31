import { supabase } from './supabase';

// ── Constants ──────────────────────────────────────────────────────────────

export const SESSION_VALIDITY_CHECK_MS = 30_000; // 30 seconds between heartbeat checks
export const VALIDITY_CHECK_INTERVAL_HEARTBEATS = 10; // check validity every 10 heartbeats (5 min)

// ── Device ID ──────────────────────────────────────────────────────────────

export function getOrCreateDeviceId(): string {
  const key = 'trix_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Local Session ID ───────────────────────────────────────────────────────

export function getLocalSessionId(): string | null {
  return localStorage.getItem('trix_local_session_id');
}

function setLocalSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem('trix_local_session_id', id);
  } else {
    localStorage.removeItem('trix_local_session_id');
  }
}

// ── Logger ─────────────────────────────────────────────────────────────────

export class AuthLogger {
  private prefix: string;

  constructor(prefix: string = 'Auth') {
    this.prefix = prefix;
  }

  info(...args: unknown[]): void {
    console.log(`[${this.prefix}]`, ...args);
  }

  warn(...args: unknown[]): void {
    console.warn(`[${this.prefix}]`, ...args);
  }

  error(...args: unknown[]): void {
    console.error(`[${this.prefix}]`, ...args);
  }
}

export const logger = {
  auth: new AuthLogger('Auth'),
  error(module: string, ...args: unknown[]): void {
    console.error(`[${module}]`, ...args);
  },
};

// ── Session Operations ─────────────────────────────────────────────────────

export async function upsertSession(
  userId: string,
  _?: unknown,
  forceNew = false,
): Promise<{ id: string } | null> {
  try {
    const existingId = getLocalSessionId();
    if (existingId && !forceNew) {
      return { id: existingId };
    }

    const deviceId = getOrCreateDeviceId();
    const sessionId = crypto.randomUUID?.() ?? `sess-${Date.now()}`;

    const { error } = await supabase
      .from('sessions')
      .upsert({
        id: sessionId,
        user_id: userId,
        device_id: deviceId,
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });

    if (error) {
      logger.error('Auth', 'upsertSession error:', error);
      return null;
    }

    setLocalSessionId(sessionId);
    return { id: sessionId };
  } catch (err) {
    logger.error('Auth', 'upsertSession exception:', err);
    return null;
  }
}

export async function touchSession(): Promise<void> {
  const sessionId = getLocalSessionId();
  if (!sessionId) return;

  try {
    await supabase
      .from('sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', sessionId);
  } catch (err) {
    logger.error('Auth', 'touchSession error:', err);
  }
}

export async function updateLastActive(): Promise<void> {
  const sessionId = getLocalSessionId();
  if (!sessionId) return;

  try {
    await supabase
      .from('sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', sessionId);
  } catch (err) {
    // Silently ignore network errors for heartbeat
  }
}

export async function checkSessionValidity(): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  const sessionId = getLocalSessionId();
  if (!sessionId) {
    return { isValid: false, reason: 'not_found' };
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { isValid: false, reason: 'not_found' };
      }
      return { isValid: false, reason: 'network_error' };
    }

    return { isValid: Boolean(data) };
  } catch {
    return { isValid: false, reason: 'network_error' };
  }
}

export function forceLogout(reason: string, sessionId: string | null): void {
  logger.auth.warn('[auth] force logout', { reason, sessionId });
  setLocalSessionId(null);
  supabase.auth.signOut().catch(() => {});
}

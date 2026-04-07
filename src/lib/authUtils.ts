import { supabase } from './supabase';
import {
  checkSessionValidity as checkSessionValidityViaService,
  clearLocalSessionId,
  getLocalSessionId,
  getOrCreateDeviceId,
  touchSession,
  upsertSession,
} from '../services/sessionService';

export const SESSION_VALIDITY_CHECK_MS = 30_000;
export const VALIDITY_CHECK_INTERVAL_HEARTBEATS = 10;

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

export { getLocalSessionId, getOrCreateDeviceId, touchSession, upsertSession };

export async function updateLastActive(): Promise<void> {
  await touchSession();
}

export async function checkSessionValidity(): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  return await checkSessionValidityViaService();
}

export function forceLogout(reason: string, sessionId: string | null): void {
  logger.auth.warn('[auth] force logout', { reason, sessionId });
  clearLocalSessionId();
  supabase.auth.signOut().catch(() => {});
}

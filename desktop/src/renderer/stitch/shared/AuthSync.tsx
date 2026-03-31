import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Syncs Supabase auth session from renderer to main process electron-store.
 * This ensures data IPC handlers (todos, study sessions, etc.) can authenticate
 * with Supabase REST API using the user's access token.
 */
export function AuthSync() {
  const { session } = useAuth();

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.authSetSession) return;

    if (session) {
      api.authSetSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        user: session.user ? {
          id: session.user.id,
          email: session.user.email,
          created_at: session.user.created_at,
        } : undefined,
      }).catch((err: unknown) => {
        console.error('[AuthSync] Failed to sync session to main process:', err);
      });
    } else {
      api.authSetSession(null).catch(() => {});
    }
  }, [session?.access_token]);

  return null;
}

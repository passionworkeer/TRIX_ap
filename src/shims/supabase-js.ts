export interface User {
  id: string;
  email?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  created_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
}

export interface PostgrestError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
}

export function createClient() {
  throw new Error('Supabase SDK is replaced by the local MySQL REST adapter.');
}

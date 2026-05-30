export interface ApiAuthUser {
  id: string;
  email: string;
  username?: string;
  aud?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface ApiAuthSession {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_at: number;
  expires_in: number;
  user: ApiAuthUser;
}

export interface ApiAuthResponse {
  user: ApiAuthUser;
  session: ApiAuthSession;
  token?: string;
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

const AUTH_STORAGE_KEY = 'trix_mysql_auth_session';
const MEMORY_STORAGE = new Map<string, string>();

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_TRIX_WEB_API_URL as string | undefined;
  return configured ? configured.replace(/\/$/, '') : '';
}

function resolveUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage ?? null;
}

function getItem(key: string): string | null {
  const storage = getBrowserStorage();
  if (storage) {
    return storage.getItem(key);
  }
  return MEMORY_STORAGE.get(key) ?? null;
}

function setItem(key: string, value: string): void {
  const storage = getBrowserStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  MEMORY_STORAGE.set(key, value);
}

function removeItem(key: string): void {
  const storage = getBrowserStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  MEMORY_STORAGE.delete(key);
}

export function getStoredSession(): ApiAuthSession | null {
  const raw = getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as ApiAuthSession;
    if (!session?.access_token || !session?.user?.id) {
      clearStoredSession();
      return null;
    }
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function setStoredSession(session: ApiAuthSession): void {
  setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  removeItem(AUTH_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  const token = getStoredSession()?.access_token;
  return token?.includes('.') ? token : null;
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(resolveUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? response.statusText;
    throw new ApiClientError(response.status, message, body?.error?.details ?? body);
  }

  return body as T;
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  username: string;
}): Promise<ApiAuthResponse> {
  const response = await apiRequest<ApiAuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
  setStoredSession(response.session);
  return response;
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<ApiAuthResponse> {
  const response = await apiRequest<ApiAuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
  setStoredSession(response.session);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  } finally {
    clearStoredSession();
  }
}

export async function fetchCurrentUser(): Promise<ApiAuthUser | null> {
  try {
    const response = await apiRequest<{ user: ApiAuthUser }>('/api/auth/me');
    const existing = getStoredSession();
    if (existing) {
      setStoredSession({ ...existing, user: response.user });
    }
    return response.user;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      clearStoredSession();
      return null;
    }
    throw error;
  }
}

export function updateStoredUser(user: ApiAuthUser): ApiAuthSession | null {
  const existing = getStoredSession();
  if (!existing) return null;
  const next = { ...existing, user };
  setStoredSession(next);
  return next;
}

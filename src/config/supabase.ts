import {
  ApiClientError,
  type ApiAuthSession,
  type ApiAuthUser,
  apiRequest,
  clearStoredSession,
  fetchCurrentUser,
  getStoredSession,
  loginWithPassword,
  logout as apiLogout,
  registerWithPassword,
  setStoredSession,
  updateStoredUser,
} from '../services/apiClient';
import { logger } from '../utils/logger';

export interface PostgrestError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
  status?: number;
}

export interface User extends ApiAuthUser {
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  role?: string;
}

export interface Session extends Omit<ApiAuthSession, 'user'> {
  user: User;
}

type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;

type QueryAction = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type SingleMode = 'none' | 'single' | 'maybeSingle';

interface QueryFilter {
  column: string;
  op: string;
  value: unknown;
}

interface QueryOrder {
  column: string;
  ascending?: boolean;
}

interface QueryPayload {
  select?: string;
  selectOptions?: Record<string, unknown>;
  values?: unknown;
  options?: Record<string, unknown>;
  filters?: QueryFilter[];
  orFilters?: string[];
  orders?: QueryOrder[];
  limit?: number;
  range?: {
    from: number;
    to: number;
  };
}

export interface SupabaseResponse<T = any> {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

interface SupabaseAuthResponse<T> extends Omit<SupabaseResponse<T>, 'data'> {
  data: T;
}

interface DbResponse<T = any> {
  data: T;
  count?: number | null;
}

function normalizeUser(user: ApiAuthUser): User {
  return {
    ...user,
    email: user.email,
    aud: user.aud ?? 'authenticated',
    role: user.role ?? 'authenticated',
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {
      username: user.username,
    },
  };
}

function normalizeSession(session: ApiAuthSession): Session {
  return {
    ...session,
    user: normalizeUser(session.user),
  };
}

function currentSession(): Session | null {
  const stored = getStoredSession();
  return stored ? normalizeSession(stored) : null;
}

function toSupabaseError(error: unknown): PostgrestError {
  if (error instanceof ApiClientError) {
    return {
      message: error.message,
      details: error.details,
      code: String(error.status),
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      details: error,
    };
  }

  return {
    message: 'Unknown API error',
    details: error,
  };
}

function postgrestSingleError(message = 'JSON object requested, multiple (or no) rows returned'): PostgrestError {
  return {
    message,
    code: 'PGRST116',
    details: 'The result contains 0 rows or more than 1 row',
  };
}

function normalizePattern(value: unknown): string {
  return String(value);
}

class RestQueryBuilder<T = any> implements PromiseLike<SupabaseResponse<T>> {
  private action: QueryAction = 'select';
  private values: unknown;
  private options?: Record<string, unknown>;
  private selectColumns = '*';
  private selectOptions?: Record<string, unknown>;
  private filters: QueryFilter[] = [];
  private orFilters: string[] = [];
  private orders: QueryOrder[] = [];
  private limitValue?: number;
  private rangeValue?: { from: number; to: number };
  private singleMode: SingleMode = 'none';

  constructor(private readonly table: string) {}

  select(columns = '*', options?: Record<string, unknown>): this {
    this.selectColumns = columns;
    this.selectOptions = options;
    return this;
  }

  insert(values: unknown, options?: Record<string, unknown>): this {
    this.action = 'insert';
    this.values = values;
    this.options = options;
    return this;
  }

  upsert(values: unknown, options?: Record<string, unknown>): this {
    this.action = 'upsert';
    this.values = values;
    this.options = options;
    return this;
  }

  update(values: unknown): this {
    this.action = 'update';
    this.values = values;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.addFilter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this.addFilter(column, 'neq', value);
  }

  gt(column: string, value: unknown): this {
    return this.addFilter(column, 'gt', value);
  }

  gte(column: string, value: unknown): this {
    return this.addFilter(column, 'gte', value);
  }

  lt(column: string, value: unknown): this {
    return this.addFilter(column, 'lt', value);
  }

  lte(column: string, value: unknown): this {
    return this.addFilter(column, 'lte', value);
  }

  like(column: string, value: unknown): this {
    return this.addFilter(column, 'like', normalizePattern(value));
  }

  ilike(column: string, value: unknown): this {
    return this.addFilter(column, 'ilike', normalizePattern(value));
  }

  in(column: string, values: unknown[]): this {
    return this.addFilter(column, 'in', values);
  }

  is(column: string, value: unknown): this {
    return this.addFilter(column, 'is', value);
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is') {
      return this.addFilter(column, 'not_is', value);
    }
    return this.addFilter(column, `not_${operator}`, value);
  }

  match(values: Record<string, unknown>): this {
    Object.entries(values).forEach(([column, value]) => {
      this.eq(column, value);
    });
    return this;
  }

  or(expression: string): this {
    this.orFilters.push(expression);
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
    });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeValue = { from, to };
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  then<TResult1 = SupabaseResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private addFilter(column: string, op: string, value: unknown): this {
    this.filters.push({ column, op, value });
    return this;
  }

  private buildPayload(): QueryPayload {
    return {
      select: this.selectColumns,
      selectOptions: this.selectOptions,
      values: this.values,
      options: this.options,
      filters: this.filters,
      orFilters: this.orFilters,
      orders: this.orders,
      limit: this.limitValue,
      range: this.rangeValue,
    };
  }

  private endpoint(): { path: string; method: 'POST' | 'PATCH' } {
    if (this.action === 'update') {
      return { path: `/api/db/${this.table}/update`, method: 'PATCH' };
    }
    if (this.action === 'delete') {
      return { path: `/api/db/${this.table}/delete`, method: 'POST' };
    }
    if (this.action === 'insert') {
      return { path: `/api/db/${this.table}/insert`, method: 'POST' };
    }
    if (this.action === 'upsert') {
      return { path: `/api/db/${this.table}/upsert`, method: 'POST' };
    }
    return { path: `/api/db/${this.table}/query`, method: 'POST' };
  }

  private normalizeResult(raw: DbResponse<unknown>): SupabaseResponse<T> {
    const count = raw.count ?? null;

    if (this.selectOptions?.head === true) {
      return { data: null, error: null, count };
    }

    if (this.singleMode === 'none') {
      return { data: raw.data as T, error: null, count };
    }

    const rows = Array.isArray(raw.data)
      ? raw.data
      : raw.data === null || raw.data === undefined
        ? []
        : [raw.data];

    if (rows.length === 1) {
      return { data: rows[0] as T, error: null, count };
    }

    if (rows.length === 0 && this.singleMode === 'maybeSingle') {
      return { data: null, error: null, count };
    }

    return { data: null, error: postgrestSingleError(), count };
  }

  private async execute(): Promise<SupabaseResponse<T>> {
    const endpoint = this.endpoint();

    try {
      const response = await apiRequest<DbResponse<unknown>>(endpoint.path, {
        method: endpoint.method,
        body: JSON.stringify(this.buildPayload()),
      });
      return this.normalizeResult(response);
    } catch (error) {
      return {
        data: null,
        error: toSupabaseError(error),
        count: null,
      };
    }
  }
}

interface RealtimePayload<T = Record<string, unknown>> {
  new: T;
  old?: T;
  eventType?: string;
}

type RealtimeCallback = (payload: RealtimePayload) => void;

class NoopRealtimeChannel {
  private handlers: Array<{
    event: string;
    filter: Record<string, unknown>;
    callback: RealtimeCallback;
  }> = [];

  constructor(readonly topic: string) {}

  on(event: string, filter: Record<string, unknown>, callback: RealtimeCallback): this {
    this.handlers.push({ event, filter, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    setTimeout(() => callback?.('SUBSCRIBED'), 0);
    return this;
  }

  unsubscribe(): Promise<'ok'> {
    this.handlers = [];
    return Promise.resolve('ok');
  }
}

const objectUrls = new Map<string, string>();

class LocalStorageBucket {
  constructor(private readonly bucket: string) {}

  async upload(
    path: string,
    file: Blob | ArrayBuffer | string,
    _options?: Record<string, unknown>,
  ): Promise<SupabaseResponse<{ path: string; fullPath: string }>> {
    const key = `${this.bucket}/${path}`;
    if (typeof URL !== 'undefined' && typeof Blob !== 'undefined' && file instanceof Blob) {
      const existing = objectUrls.get(key);
      if (existing) URL.revokeObjectURL(existing);
      objectUrls.set(key, URL.createObjectURL(file));
    }

    return {
      data: { path, fullPath: key },
      error: null,
    };
  }

  async remove(paths: string[]): Promise<SupabaseResponse<{ path: string }[]>> {
    for (const path of paths) {
      const key = `${this.bucket}/${path}`;
      const existing = objectUrls.get(key);
      if (existing && typeof URL !== 'undefined') URL.revokeObjectURL(existing);
      objectUrls.delete(key);
    }

    return {
      data: paths.map((path) => ({ path })),
      error: null,
    };
  }

  getPublicUrl(path: string, _options?: Record<string, unknown>): { data: { publicUrl: string } } {
    const key = `${this.bucket}/${path}`;
    return {
      data: {
        publicUrl: objectUrls.get(key) ?? `/uploads/${key}`,
      },
    };
  }
}

const authListeners = new Set<AuthListener>();

function emitAuth(event: AuthChangeEvent, session: Session | null): void {
  for (const listener of authListeners) {
    void listener(event, session);
  }
}

export const supabase = {
  auth: {
    async getSession(): Promise<SupabaseAuthResponse<{ session: Session | null }>> {
      return {
        data: { session: currentSession() },
        error: null,
      };
    },

    async getUser(): Promise<SupabaseAuthResponse<{ user: User | null }>> {
      const session = currentSession();
      if (!session) {
        return { data: { user: null }, error: null };
      }

      try {
        const user = await fetchCurrentUser();
        return {
          data: { user: user ? normalizeUser(user) : null },
          error: null,
        };
      } catch (error) {
        return {
          data: { user: session.user },
          error: toSupabaseError(error),
        };
      }
    },

    async signInWithPassword(input: { email: string; password: string }): Promise<SupabaseAuthResponse<{ user: User | null; session: Session | null }>> {
      try {
        const response = await loginWithPassword(input);
        const session = normalizeSession(response.session);
        emitAuth('SIGNED_IN', session);
        return {
          data: { user: session.user, session },
          error: null,
        };
      } catch (error) {
        return {
          data: { user: null, session: null },
          error: toSupabaseError(error),
        };
      }
    },

    async signUp(input: {
      email: string;
      password: string;
      options?: {
        data?: Record<string, unknown>;
        emailRedirectTo?: string;
      };
    }): Promise<SupabaseAuthResponse<{ user: User | null; session: Session | null }>> {
      try {
        const username = String(input.options?.data?.username ?? input.email.split('@')[0] ?? 'user');
        const response = await registerWithPassword({
          email: input.email,
          password: input.password,
          username,
        });
        const session = normalizeSession(response.session);
        emitAuth('SIGNED_IN', session);
        return {
          data: { user: session.user, session },
          error: null,
        };
      } catch (error) {
        return {
          data: { user: null, session: null },
          error: toSupabaseError(error),
        };
      }
    },

    async signOut(): Promise<{ error: PostgrestError | null }> {
      try {
        await apiLogout();
        emitAuth('SIGNED_OUT', null);
        return { error: null };
      } catch (error) {
        clearStoredSession();
        emitAuth('SIGNED_OUT', null);
        return { error: toSupabaseError(error) };
      }
    },

    async refreshSession(): Promise<SupabaseAuthResponse<{ session: Session | null }>> {
      const session = currentSession();
      if (!session) {
        return { data: { session: null }, error: null };
      }

      try {
        const user = await fetchCurrentUser();
        const nextSession = user ? normalizeSession(updateStoredUser(user) ?? getStoredSession() ?? session) : null;
        emitAuth('TOKEN_REFRESHED', nextSession);
        return {
          data: { session: nextSession },
          error: null,
        };
      } catch (error) {
        return {
          data: { session },
          error: toSupabaseError(error),
        };
      }
    },

    onAuthStateChange(callback: AuthListener): { data: { subscription: { unsubscribe: () => void } } } {
      authListeners.add(callback);
      setTimeout(() => {
        void callback('INITIAL_SESSION', currentSession());
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },

    async exchangeCodeForSession(_code?: string): Promise<SupabaseAuthResponse<{ session: Session | null }>> {
      return {
        data: { session: currentSession() },
        error: null,
      };
    },

    async setSession(input: { access_token: string; refresh_token: string }): Promise<SupabaseAuthResponse<{ session: Session | null; user: User | null }>> {
      const existing = getStoredSession();
      if (existing) {
        const next: ApiAuthSession = {
          ...existing,
          access_token: input.access_token || existing.access_token,
          refresh_token: input.refresh_token || existing.refresh_token,
        };
        setStoredSession(next);
        const session = normalizeSession(next);
        emitAuth('SIGNED_IN', session);
        return {
          data: { session, user: session.user },
          error: null,
        };
      }

      return {
        data: { session: null, user: null },
        error: null,
      };
    },
  },

  from<T = any>(table: string): RestQueryBuilder<T> {
    return new RestQueryBuilder<T>(table);
  },

  async rpc<T = any>(name: string, params?: Record<string, unknown>): Promise<SupabaseResponse<T>> {
    try {
      const data = await apiRequest<{ data: T }>(`/api/rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(params ?? {}),
      });
      return {
        data: data.data,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: toSupabaseError(error),
      };
    }
  },

  channel(topic: string): NoopRealtimeChannel {
    return new NoopRealtimeChannel(topic);
  },

  removeChannel(channel: NoopRealtimeChannel): Promise<'ok'> {
    return channel.unsubscribe();
  },

  storage: {
    from(bucket: string): LocalStorageBucket {
      return new LocalStorageBucket(bucket);
    },
  },
};

export async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    logger.auth.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }

  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }

  return session.user.id;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  name: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'busy' | 'away';
  bio: string | null;
  study_time: number;
  is_studying: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  friend_id: string;
  sender: 'user' | 'friend' | 'bot';
  text: string;
  created_at: string;
  message_type?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'mixed';
  media_uri?: string;
  media_type?: string;
  media_size?: number;
  media_metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
  voice_url?: string;
  voice_duration?: number;
  voice_transcript?: string;
  voice_mime_type?: string;
}

export interface ChatMessageDB {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  is_read: boolean;
  created_at: string;
  message_type?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'mixed';
  media_uri?: string;
  media_type?: string;
  media_size?: number;
  media_metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
  voice_url?: string;
  voice_duration?: number;
  voice_transcript?: string;
  voice_mime_type?: string;
}

export interface UnreadCount {
  id: string;
  user_id: string;
  friend_id: string;
  unread_count: number;
  last_message: string | null;
  last_message_time: string | null;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'message' | 'system' | 'friend_request' | 'study' | 'achievement';
  title: string;
  content: string;
  avatar_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Mail {
  id: string;
  user_id: string;
  from_name: string;
  from_avatar: string | null;
  subject: string;
  preview: string;
  content: string | null;
  is_read: boolean;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  subject: string | null;
  duration: number;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  is_completed?: boolean;
  earned_points?: number;
  created_at: string;
}

export interface FriendLatestMessage {
  user_id: string;
  friend_id: string;
  name: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'busy' | 'away';
  bio: string | null;
  study_time: number;
  is_studying: boolean;
  unread_count: number;
  last_message: string | null;
  last_message_time: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info: {
    ip?: string;
    device?: string;
    browser?: string;
  } | null;
  clawbot_endpoint: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}

export interface Profile {
  id: string;
  username: string;
  email?: string;
  points?: number;
  avatar_config?: Record<string, unknown>;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  website?: string;
  bio?: string;
  is_studying?: boolean;
  companion_id?: string | null;
  total_study_time?: number;
  last_active_at?: string | null;
  show_online_status?: boolean;
  current_streak?: number;
  days_active?: number;
  interaction_count?: number;
  school?: string;
  grade?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getUsersLastActive(userIds: string[]): Promise<Record<string, string | null>> {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  try {
    const seen = new Set<string>();
    const uniqueUserIds = userIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const { data, error } = await supabase
      .from<Profile[]>('profiles')
      .select('id, last_active_at')
      .in('id', uniqueUserIds);

    if (error) {
      logger.auth.error('获取用户活跃时间失败:', error);
      return {};
    }

    const profiles = Array.isArray(data) ? data : [];
    const result: Record<string, string | null> = {};
    for (const userId of uniqueUserIds) {
      const profile = profiles.find((item) => item.id === userId);
      result[userId] = profile?.last_active_at ?? null;
    }

    return result;
  } catch (error) {
    logger.auth.error('获取用户活跃时间异常:', error);
    return {};
  }
}

export async function updateLastActive(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      logger.auth.error('更新用户活跃时间失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.auth.error('更新用户活跃时间异常:', error);
    return false;
  }
}

export enum UserOnlineStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}

export function calculateOnlineStatus(lastActiveAt: string | null): UserOnlineStatus {
  if (!lastActiveAt) {
    return UserOnlineStatus.OFFLINE;
  }

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));

  if (diffMinutes < 5) {
    return UserOnlineStatus.ONLINE;
  }

  if (diffMinutes < 30) {
    return UserOnlineStatus.AWAY;
  }

  return UserOnlineStatus.OFFLINE;
}

export function getOnlineStatusText(lastActiveAt: string | null): string {
  if (!lastActiveAt) {
    return '离线';
  }

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));

  if (diffMinutes < 5) {
    return '在线';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}小时前`;
  }

  return '离线';
}

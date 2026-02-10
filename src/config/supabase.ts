import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// 固定用户 ID（单用户模式）
export const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

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
  created_at: string;
}

export interface FriendLatestMessage {
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
  points?: number;
  avatar_config?: any;
  full_name?: string;
  avatar_url?: string;
  website?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
}

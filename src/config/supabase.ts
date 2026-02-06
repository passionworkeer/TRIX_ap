// ============================================
// 🔧 Supabase 配置文件
// ============================================

import { createClient } from '@supabase/supabase-js';

// Supabase 项目配置（从环境变量读取）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '__SUPABASE_ANON_KEY_REDACTED__';

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

// 当前用户 ID（固定为默认用户，多用户功能暂时注释）
// 🔕 多用户功能暂时注释 - 专注于基础 Bot 连接
// export const getCurrentUserId = (): string => {
//   return localStorage.getItem('current_user_id') || '00000000-0000-0000-0000-000000000001';
// };

// export const CURRENT_USER_ID = getCurrentUserId();

// 使用固定的用户 ID
export const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// 导出类型定义
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
  clawbot_endpoint: string | null; // 用户个人电脑上的 Clawbot Gateway 地址
  is_active: boolean;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}

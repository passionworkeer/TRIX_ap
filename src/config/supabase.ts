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

// ============================================
// 辅助函数: 获取当前登录用户 ID
// ============================================
/**
 * 获取当前登录用户的 ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 用户 ID
 */
export async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }
  
  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }
  
  return session.user.id;
}

// ============================================
// TypeScript 接口定义
// ============================================

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;  // 现在是 UUID
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
  friend_id: string;  // 保持兼容性
  sender: 'user' | 'friend' | 'bot';
  text: string;
  created_at: string;
}

// 数据库实际存储的消息格式
export interface ChatMessageDB {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  is_read: boolean;
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
  user_id: string;  // 添加 user_id 字段
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
  is_studying?: boolean; // 用户是否正在自习
  companion_id?: string | null; // 正在一起自习的好友 ID（双向关联）
  created_at?: string;
  updated_at?: string;
}

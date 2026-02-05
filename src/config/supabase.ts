// ============================================
// 🔧 Supabase 配置文件
// ============================================

import { createClient } from '@supabase/supabase-js';

// Supabase 项目配置（从环境变量读取）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bqzjumxfzikikgjtsckj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxemp1bXhmemlraWtnanRzY2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2NzE1OTIsImV4cCI6MjA1NDI0NzU5Mn0.4rZxl2QWpfZyPMpB7qJ7KHZj9WwWwzIYLQ5g4g4z1Yw';

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

// 当前用户 ID（从数据库初始化脚本中）
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

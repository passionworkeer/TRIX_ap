import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

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
    logger.auth.error('获取用户会话失败:', error);
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
  // Media fields (optional)
  message_type?: 'text' | 'image' | 'video' | 'voice' | 'mixed';
  media_uri?: string;
  media_type?: string;
  media_size?: number;
  media_metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
  };
  // Voice message fields (optional)
  /** 语音文件 URL */
  voice_url?: string;
  /** 语音时长（秒） */
  voice_duration?: number;
  /** 语音转文字结果 */
  voice_transcript?: string;
  /** 音频格式（如 audio/mp3, audio/webm） */
  voice_mime_type?: string;
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
  // Media fields
  message_type?: 'text' | 'image' | 'video' | 'voice' | 'mixed';
  media_uri?: string;
  media_type?: string;
  media_size?: number;
  media_metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
  };
  // Voice message fields (database storage)
  /** 语音文件 URL */
  voice_url?: string;
  /** 语音时长（秒） */
  voice_duration?: number;
  /** 语音转文字结果 */
  voice_transcript?: string;
  /** 音频格式（如 audio/mp3, audio/webm） */
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
  avatar_config?: Record<string, unknown>;
  full_name?: string;
  avatar_url?: string;
  website?: string;
  bio?: string;
  is_studying?: boolean; // 用户是否正在自习
  companion_id?: string | null; // 正在一起自习的好友 ID（双向关联）
  days_active?: number; // 活跃天数
  interaction_count?: number; // 互动次数
  last_active_at?: string | null; // 用户最后活跃时间
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 用户活跃时间管理
// ============================================

/**
 * 获取多个用户的最后活跃时间
 * @param userIds - 用户 ID 数组
 * @returns 用户 ID 到最后活跃时间的映射，未活跃或不存在时为 null
 */
export async function getUsersLastActive(userIds: string[]): Promise<Record<string, string | null>> {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  try {
    // 去重 - 使用 filter 而非 Set 迭代以兼容严格模式
    const seen = new Set<string>();
    const uniqueUserIds = userIds.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, last_active_at')
      .in('id', uniqueUserIds);

    if (error) {
      logger.auth.error('获取用户活跃时间失败:', error);
      return {};
    }

    // 构建映射，缺失的用户的活跃时间设为 null
    const result: Record<string, string | null> = {};
    for (const userId of uniqueUserIds) {
      const profile = data?.find(p => p.id === userId);
      result[userId] = profile?.last_active_at ?? null;
    }

    return result;
  } catch (error) {
    logger.auth.error('获取用户活跃时间异常:', error);
    return {};
  }
}

/**
 * 更新当前用户的最后活跃时间
 * 用户每次操作时调用此函数更新活跃状态
 * @returns 是否更新成功
 */
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

/**
 * 用户在线状态枚举
 */
export enum UserOnlineStatus {
  ONLINE = 'online',      // 5分钟内活跃
  AWAY = 'away',         // 5-30分钟前活跃
  OFFLINE = 'offline',   // 30分钟以上无活动
}

/**
 * 根据最后活跃时间计算用户在线状态
 * @param lastActiveAt - 用户最后活跃时间 (ISO 字符串)
 * @returns UserOnlineStatus
 */
export function calculateOnlineStatus(lastActiveAt: string | null): UserOnlineStatus {
  if (!lastActiveAt) {
    return UserOnlineStatus.OFFLINE;
  }

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));

  if (diffMinutes < 5) {
    return UserOnlineStatus.ONLINE;
  } else if (diffMinutes < 30) {
    return UserOnlineStatus.AWAY;
  } else {
    return UserOnlineStatus.OFFLINE;
  }
}

/**
 * 获取用户在线状态的显示文本
 * @param lastActiveAt - 用户最后活跃时间 (ISO 字符串)
 * @returns 显示文本，如 "在线"、"5分钟前"、"离线"
 */
export function getOnlineStatusText(lastActiveAt: string | null): string {
  if (!lastActiveAt) {
    return '离线';
  }

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));

  if (diffMinutes < 5) {
    return '在线';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffMinutes < 1440) { // 24小时内
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}小时前`;
  } else {
    return '离线';
  }
}

/**
 * 通知和邮件服务
 * 处理 notifications 和 mails 表的 CRUD 操作
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type { Notification, Mail } from '../config/supabase';

// ============================================
// 辅助函数 - 获取当前登录用户 ID
// ============================================

/**
 * 获取当前登录用户的 ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 用户 ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    logger.notification.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }

  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }

  return session.user.id;
}

// ============================================
// 通知管理
// ============================================

/** 获取所有通知 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.notification.error('获取通知失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.notification.error('获取通知失败:', error);
    return [];
  }
}

/** 标记通知为已读 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    logger.notification.error('标记通知已读失败:', error);
  }
}

/** 删除通知 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    logger.notification.error('删除通知失败:', error);
  }
}

/** 获取未读通知数量 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.notification.error('获取未读通知数失败:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    logger.notification.error('获取未读通知数失败:', error);
    return 0;
  }
}

/** 订阅通知更新 */
export async function subscribeToNotifications(
  callback: (notification: Notification) => void
): Promise<() => void> {
  try {
    const userId = await getCurrentUserId();

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    logger.notification.error('订阅通知更新失败:', error);
    return () => {}; // 返回空的清理函数
  }
}

// ============================================
// 邮件管理
// ============================================

/** 获取所有邮件 */
export async function getMails(): Promise<Mail[]> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('mails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.notification.error('获取邮件失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.notification.error('获取邮件失败:', error);
    return [];
  }
}

/** 标记邮件为已读 */
export async function markMailAsRead(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .update({ is_read: true })
    .eq('id', mailId);

  if (error) {
    logger.notification.error('标记邮件已读失败:', error);
  }
}

/** 删除邮件 */
export async function deleteMail(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .delete()
    .eq('id', mailId);

  if (error) {
    logger.notification.error('删除邮件失败:', error);
  }
}

/** 获取未读邮件数量 */
export async function getUnreadMailCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();

    const { count, error } = await supabase
      .from('mails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.notification.error('获取未读邮件数失败:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    logger.notification.error('获取未读邮件数失败:', error);
    return 0;
  }
}

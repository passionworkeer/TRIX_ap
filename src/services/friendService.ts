import { supabase, updateLastActive } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { FRIEND_VALIDATION, validateString, getValidationErrorMessage } from '../lib/validation';
import type { Notification, FriendLatestMessage } from '../config/supabase';

// ============================================
// 常量定义
// ============================================

const FRIEND_REQUEST_META_PREFIX = '[friend_request_from:]';

// ============================================
// 类型定义
// ============================================

type ProfileLite = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

// ============================================
// 内部辅助函数
// ============================================

/**
 * 构建好友请求内容
 */
function buildFriendRequestContent(displayName: string, requesterId: string): string {
  return `${displayName} 想添加你为好友\n${FRIEND_REQUEST_META_PREFIX}${requesterId}`;
}

/**
 * 从好友请求内容中提取发送者 ID
 */
function extractFriendRequestSenderId(content: string): string | null {
  const escapedPrefix = FRIEND_REQUEST_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`${escapedPrefix}([0-9a-fA-F-]{36})`));
  return match?.[1] || null;
}

/**
 * 解析用户资料显示名称
 */
function resolveProfileDisplayName(profile: ProfileLite): string {
  return profile.full_name || profile.username || '好友';
}

/**
 * 根据 ID 获取通知
 */
async function getNotificationById(notificationId: string): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (error || !data) {
    throw new Error('好友请求不存在或已失效');
  }

  return data as Notification;
}

/**
 * 批量获取用户资料
 */
async function getProfilesByIds(userIds: string[]): Promise<Record<string, ProfileLite>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .in('id', userIds);

  if (error || !data) {
    throw new Error('获取用户信息失败');
  }

  const profileMap: Record<string, ProfileLite> = {};
  data.forEach((profile: ProfileLite) => {
    profileMap[profile.id] = profile;
  });
  return profileMap;
}

/**
 * 检查是否已经是好友关系
 */
async function hasFriendRelation(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${userA},friend_id.eq.${userB}),and(user_id.eq.${userB},friend_id.eq.${userA})`)
    .limit(1);

  if (error) {
    throw new Error('校验好友关系失败');
  }

  return (data?.length || 0) > 0;
}

/**
 * 批量创建或更新好友关系
 */
async function upsertFriendRelations(
  rows: Array<{
    user_id: string;
    friend_id: string;
    name: string;
    avatar_url: string | null;
    bio: string | null;
  }>
): Promise<void> {
  const now = new Date().toISOString();

  const richRows = rows.map(row => ({
    ...row,
    status: 'offline',
    study_time: 0,
    is_studying: false,
    updated_at: now,
  }));

  const { error: richError } = await supabase
    .from('friends')
    .upsert(richRows, {
      onConflict: 'user_id,friend_id',
      ignoreDuplicates: false,
    });

  if (!richError) {
    return;
  }

  const fallbackRows = rows.map(row => ({
    user_id: row.user_id,
    friend_id: row.friend_id,
    status: 'offline',
  }));

  const { error: fallbackError } = await supabase
    .from('friends')
    .upsert(fallbackRows, {
      onConflict: 'user_id,friend_id',
      ignoreDuplicates: false,
    });

  if (fallbackError) {
    throw fallbackError;
  }
}

/**
 * 获取当前登录用户的 ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 用户 ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    logger.chat.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }

  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }

  return session.user.id;
}

/**
 * 标记通知为已读
 */
async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    logger.chat.error('标记通知已读失败:', error);
  }
}

// ============================================
// 导出的公共函数
// ============================================

/**
 * 获取通知显示内容（去除元数据）
 */
export function getNotificationDisplayContent(content: string): string {
  const escapedPrefix = FRIEND_REQUEST_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(new RegExp(`\\n?${escapedPrefix}[0-9a-fA-F-]{36}`, 'g'), '').trim();
}

/**
 * 添加好友 (支持邮箱或用户名)
 */
export async function addFriend(account: string): Promise<void> {
  await sendFriendRequest(account);
}

/**
 * 发送好友请求（通知驱动，不直接建好友关系）
 */
export async function sendFriendRequest(account: string): Promise<void> {
  try {
    const normalizedAccount = account.trim();

    // Validate account
    const accountError = validateString(normalizedAccount, FRIEND_VALIDATION.account, 'account');
    if (accountError) {
      throw new Error(getValidationErrorMessage(accountError));
    }

    if (!normalizedAccount) {
      throw new Error('请输入用户名或邮箱');
    }

    // 1. 查找目标用户（优先 email，其次 username）
    const [{ data: byEmail, error: byEmailError }, { data: byUsername, error: byUsernameError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, full_name, email')
        .eq('email', normalizedAccount)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, username, full_name, email')
        .eq('username', normalizedAccount)
        .maybeSingle(),
    ]);

    if ((byEmailError && byEmailError.code !== 'PGRST116') || (byUsernameError && byUsernameError.code !== 'PGRST116')) {
      throw new Error('查找用户失败');
    }

    const targetProfile = byEmail || byUsername;
    if (!targetProfile) {
      throw new Error('用户不存在');
    }

    // 2. 获取当前用户信息
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('请先登录');
    }

    const currentUserId = session.user.id;
    const targetUserId = targetProfile.id;

    if (targetUserId === currentUserId) {
      throw new Error('不能添加自己为好友');
    }

    // 3. 已经是好友，直接拦截
    if (await hasFriendRelation(currentUserId, targetUserId)) {
      throw new Error('你们已经是好友了');
    }

    // 4. 避免重复发送请求
    const { data: outgoingPending, error: outgoingPendingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .eq('is_read', false)
      .like('content', `%${FRIEND_REQUEST_META_PREFIX}${currentUserId}%`)
      .limit(1);

    if (outgoingPendingError) {
      throw new Error('校验好友请求失败');
    }

    if ((outgoingPending?.length || 0) > 0) {
      throw new Error('好友请求已发送，请等待对方确认');
    }

    // 5. 对方已发过请求，则自动按"接受"处理
    const { data: incomingPending, error: incomingPendingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('type', 'friend_request')
      .eq('is_read', false)
      .like('content', `%${FRIEND_REQUEST_META_PREFIX}${targetUserId}%`)
      .limit(1);

    if (incomingPendingError) {
      throw new Error('校验好友请求失败');
    }

    const incomingPendingId = incomingPending?.[0]?.id;
    if (incomingPendingId) {
      await acceptFriendRequest(incomingPendingId);
      return;
    }

    // 6. 创建通知（请求待审批）
    const requesterDisplayName =
      (session.user.user_metadata?.full_name as string | undefined) ||
      (session.user.user_metadata?.name as string | undefined) ||
      session.user.email ||
      '某用户';

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'friend_request',
        title: '好友请求',
        content: buildFriendRequestContent(requesterDisplayName, currentUserId),
        avatar_url: '',
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (notifyError) {
      throw new Error('发送好友请求失败');
    }
  } catch (error: unknown) {
    handleGlobalError(error, '发送好友请求失败');
    throw error;
  }
}

/**
 * 接受好友请求（基于通知）
 */
export async function acceptFriendRequest(notificationId: string): Promise<void> {
  try {
    const currentUserId = await getCurrentUserId();
    const notification = await getNotificationById(notificationId);

    if (notification.user_id !== currentUserId) {
      throw new Error('无权处理此好友请求');
    }

    if (notification.type !== 'friend_request') {
      throw new Error('该通知不是好友请求');
    }

    const requesterId = extractFriendRequestSenderId(notification.content);
    if (!requesterId) {
      throw new Error('好友请求数据不完整，请让对方重新发送');
    }

    if (requesterId === currentUserId) {
      throw new Error('无效的好友请求');
    }

    if (await hasFriendRelation(currentUserId, requesterId)) {
      await markNotificationAsRead(notificationId);
      return;
    }

    const profiles = await getProfilesByIds([currentUserId, requesterId]);
    const currentProfile = profiles[currentUserId];
    const requesterProfile = profiles[requesterId];

    if (!currentProfile || !requesterProfile) {
      throw new Error('用户信息不存在');
    }

    await upsertFriendRelations([
      {
        user_id: currentUserId,
        friend_id: requesterId,
        name: resolveProfileDisplayName(requesterProfile),
        avatar_url: requesterProfile.avatar_url || null,
        bio: requesterProfile.bio || null,
      },
      {
        user_id: requesterId,
        friend_id: currentUserId,
        name: resolveProfileDisplayName(currentProfile),
        avatar_url: currentProfile.avatar_url || null,
        bio: currentProfile.bio || null,
      },
    ]);

    await markNotificationAsRead(notificationId);

    await supabase.from('notifications').insert({
      user_id: requesterId,
      type: 'system',
      title: '好友请求已通过',
      content: `${resolveProfileDisplayName(currentProfile)} 已接受你的好友请求`,
      avatar_url: currentProfile.avatar_url || '',
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    handleGlobalError(error, '接受好友请求失败');
    throw error;
  }
}

/**
 * 拒绝好友请求（基于通知）
 */
export async function rejectFriendRequest(notificationId: string): Promise<void> {
  try {
    const currentUserId = await getCurrentUserId();
    const notification = await getNotificationById(notificationId);

    if (notification.user_id !== currentUserId) {
      throw new Error('无权处理此好友请求');
    }

    if (notification.type !== 'friend_request') {
      throw new Error('该通知不是好友请求');
    }

    const requesterId = extractFriendRequestSenderId(notification.content);
    await markNotificationAsRead(notificationId);

    if (requesterId) {
      await supabase.from('notifications').insert({
        user_id: requesterId,
        type: 'system',
        title: '好友请求已拒绝',
        content: '你的好友请求未通过',
        avatar_url: '',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }
  } catch (error: unknown) {
    handleGlobalError(error, '拒绝好友请求失败');
    throw error;
  }
}

/**
 * 获取所有好友（包含未读消息信息）
 * 同时自动更新当前用户的活跃时间
 */
export async function getFriends(): Promise<FriendLatestMessage[]> {
  try {
    const userId = await getCurrentUserId();

    // 自动更新当前用户的活跃时间
    // 忽略错误，不影响获取好友列表
    updateLastActive().catch(() => {
      // 静默处理更新失败
    });

    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_time', { ascending: false, nullsFirst: false });

    if (error) {
      handleGlobalError(error, '获取好友列表失败');
      return [];
    }

    return data || [];
  } catch (error) {
    handleGlobalError(error, '获取好友列表失败');
    return [];
  }
}

/**
 * 根据 ID 获取好友信息
 */
export async function getFriendById(friendId: string): Promise<FriendLatestMessage | null> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('friends')
      .select(`
        friend_id,
        name,
        avatar_url,
        bio,
        study_time,
        is_studying,
        unread_count,
        last_message,
        last_message_time
      `)
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .single();

    if (error) {
      logger.chat.error('获取好友信息失败:', error);
      return null;
    }

    return data as FriendLatestMessage;
  } catch (error) {
    logger.chat.error('获取好友信息失败:', error);
    return null;
  }
}

/**
 * 更新好友在线状态
 */
export async function updateFriendStatus(
  friendId: string,
  status: 'online' | 'offline' | 'busy' | 'away'
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('friends')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('friend_id', friendId);

    if (error) {
      logger.chat.error('更新好友状态失败:', error);
    }
  } catch (error) {
    logger.chat.error('更新好友状态失败:', error);
  }
}

/**
 * 更新好友学习状态
 */
export async function updateFriendStudyStatus(
  friendId: string,
  isStudying: boolean,
  studyTime?: number
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    type FriendStudyUpdateData = {
      is_studying: boolean;
      updated_at: string;
      study_time?: number;
    };

    const updateData: FriendStudyUpdateData = {
      is_studying: isStudying,
      updated_at: new Date().toISOString()
    };

    if (studyTime !== undefined) {
      updateData.study_time = studyTime;
    }

    const { error } = await supabase
      .from('friends')
      .update(updateData)
      .eq('user_id', userId)
      .eq('friend_id', friendId);

    if (error) {
      logger.chat.error('更新好友学习状态失败:', error);
    }
  } catch (error) {
    logger.chat.error('更新好友学习状态失败:', error);
  }
}

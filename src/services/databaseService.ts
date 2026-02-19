import { supabase } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import type {
  ChatMessage,
  UnreadCount,
  Notification,
  Mail,
  StudySession,
  FriendLatestMessage,
} from '../config/supabase';

/**
 * æ·»åŠ å¥½å‹ (æ”¯æŒé‚®ç®±æˆ–ç”¨æˆ·å)
 * @param account å¯¹æ–¹è´¦å·ï¼ˆé‚®ç®±æˆ–ç”¨æˆ·åï¼‰
 */
const FRIEND_REQUEST_META_PREFIX = '[friend_request_from:]';

type ProfileLite = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

function buildFriendRequestContent(displayName: string, requesterId: string): string {
  return `${displayName} ÏëÌí¼ÓÄãÎªºÃÓÑ\n${FRIEND_REQUEST_META_PREFIX}${requesterId}`;
}

function extractFriendRequestSenderId(content: string): string | null {
  const escapedPrefix = FRIEND_REQUEST_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`${escapedPrefix}([0-9a-fA-F-]{36})`));
  return match?.[1] || null;
}

export function getNotificationDisplayContent(content: string): string {
  const escapedPrefix = FRIEND_REQUEST_META_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(new RegExp(`\\n?${escapedPrefix}[0-9a-fA-F-]{36}`, 'g'), '').trim();
}

function resolveProfileDisplayName(profile: ProfileLite): string {
  return profile.full_name || profile.username || 'ºÃÓÑ';
}

async function getNotificationById(notificationId: string): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (error || !data) {
    throw new Error('ºÃÓÑÇëÇó²»´æÔÚ»òÒÑÊ§Ğ§');
  }

  return data as Notification;
}

async function getProfilesByIds(userIds: string[]): Promise<Record<string, ProfileLite>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .in('id', userIds);

  if (error || !data) {
    throw new Error('»ñÈ¡ÓÃ»§ĞÅÏ¢Ê§°Ü');
  }

  const profileMap: Record<string, ProfileLite> = {};
  data.forEach((profile: any) => {
    profileMap[profile.id] = profile as ProfileLite;
  });
  return profileMap;
}

async function hasFriendRelation(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${userA},friend_id.eq.${userB}),and(user_id.eq.${userB},friend_id.eq.${userA})`)
    .limit(1);

  if (error) {
    throw new Error('Ğ£ÑéºÃÓÑ¹ØÏµÊ§°Ü');
  }

  return (data?.length || 0) > 0;
}

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
 * Ìí¼ÓºÃÓÑ (Ö§³ÖÓÊÏä»òÓÃ»§Ãû)
 */
export async function addFriend(account: string): Promise<void> {
  await sendFriendRequest(account);
}

/**
 * ·¢ËÍºÃÓÑÇëÇó£¨Í¨ÖªÇı¶¯£¬²»Ö±½Ó½¨ºÃÓÑ¹ØÏµ£©
 */
export async function sendFriendRequest(account: string): Promise<void> {
  try {
    const normalizedAccount = account.trim();
    if (!normalizedAccount) {
      throw new Error('ÇëÊäÈëÓÃ»§Ãû»òÓÊÏä');
    }

    // 1. ²éÕÒÄ¿±êÓÃ»§£¨ÓÅÏÈ email£¬Æä´Î username£©
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
      throw new Error('²éÕÒÓÃ»§Ê§°Ü');
    }

    const targetProfile = byEmail || byUsername;
    if (!targetProfile) {
      throw new Error('ÓÃ»§²»´æÔÚ');
    }

    // 2. »ñÈ¡µ±Ç°ÓÃ»§ĞÅÏ¢
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('ÇëÏÈµÇÂ¼');
    }

    const currentUserId = session.user.id;
    const targetUserId = targetProfile.id;

    if (targetUserId === currentUserId) {
      throw new Error('²»ÄÜÌí¼Ó×Ô¼ºÎªºÃÓÑ');
    }

    // 3. ÒÑ¾­ÊÇºÃÓÑ£¬Ö±½ÓÀ¹½Ø
    if (await hasFriendRelation(currentUserId, targetUserId)) {
      throw new Error('ÄãÃÇÒÑ¾­ÊÇºÃÓÑÁË');
    }

    // 4. ±ÜÃâÖØ¸´·¢ËÍÇëÇó
    const { data: outgoingPending, error: outgoingPendingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('type', 'friend_request')
      .eq('is_read', false)
      .like('content', `%${FRIEND_REQUEST_META_PREFIX}${currentUserId}%`)
      .limit(1);

    if (outgoingPendingError) {
      throw new Error('Ğ£ÑéºÃÓÑÇëÇóÊ§°Ü');
    }

    if ((outgoingPending?.length || 0) > 0) {
      throw new Error('ºÃÓÑÇëÇóÒÑ·¢ËÍ£¬ÇëµÈ´ı¶Ô·½È·ÈÏ');
    }

    // 5. ¶Ô·½ÒÑ·¢¹ıÇëÇó£¬Ôò×Ô¶¯°´¡°½ÓÊÜ¡±´¦Àí
    const { data: incomingPending, error: incomingPendingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('type', 'friend_request')
      .eq('is_read', false)
      .like('content', `%${FRIEND_REQUEST_META_PREFIX}${targetUserId}%`)
      .limit(1);

    if (incomingPendingError) {
      throw new Error('Ğ£ÑéºÃÓÑÇëÇóÊ§°Ü');
    }

    const incomingPendingId = incomingPending?.[0]?.id;
    if (incomingPendingId) {
      await acceptFriendRequest(incomingPendingId);
      return;
    }

    // 6. ´´½¨Í¨Öª£¨ÇëÇó´ıÉóÅú£©
    const requesterDisplayName =
      (session.user.user_metadata?.full_name as string | undefined) ||
      (session.user.user_metadata?.name as string | undefined) ||
      session.user.email ||
      'Ä³ÓÃ»§';

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'friend_request',
        title: 'ºÃÓÑÇëÇó',
        content: buildFriendRequestContent(requesterDisplayName, currentUserId),
        avatar_url: '',
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (notifyError) {
      throw new Error('·¢ËÍºÃÓÑÇëÇóÊ§°Ü');
    }
  } catch (error: any) {
    handleGlobalError(error, '·¢ËÍºÃÓÑÇëÇóÊ§°Ü');
    throw error;
  }
}

/**
 * ½ÓÊÜºÃÓÑÇëÇó£¨»ùÓÚÍ¨Öª£©
 */
export async function acceptFriendRequest(notificationId: string): Promise<void> {
  try {
    const currentUserId = await getCurrentUserId();
    const notification = await getNotificationById(notificationId);

    if (notification.user_id !== currentUserId) {
      throw new Error('ÎŞÈ¨´¦Àí´ËºÃÓÑÇëÇó');
    }

    if (notification.type !== 'friend_request') {
      throw new Error('¸ÃÍ¨Öª²»ÊÇºÃÓÑÇëÇó');
    }

    const requesterId = extractFriendRequestSenderId(notification.content);
    if (!requesterId) {
      throw new Error('ºÃÓÑÇëÇóÊı¾İ²»ÍêÕû£¬ÇëÈÃ¶Ô·½ÖØĞÂ·¢ËÍ');
    }

    if (requesterId === currentUserId) {
      throw new Error('ÎŞĞ§µÄºÃÓÑÇëÇó');
    }

    if (await hasFriendRelation(currentUserId, requesterId)) {
      await markNotificationAsRead(notificationId);
      return;
    }

    const profiles = await getProfilesByIds([currentUserId, requesterId]);
    const currentProfile = profiles[currentUserId];
    const requesterProfile = profiles[requesterId];

    if (!currentProfile || !requesterProfile) {
      throw new Error('ÓÃ»§ĞÅÏ¢²»´æÔÚ');
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
      title: 'ºÃÓÑÇëÇóÒÑÍ¨¹ı',
      content: `${resolveProfileDisplayName(currentProfile)} ÒÑ½ÓÊÜÄãµÄºÃÓÑÇëÇó`,
      avatar_url: currentProfile.avatar_url || '',
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    handleGlobalError(error, '½ÓÊÜºÃÓÑÇëÇóÊ§°Ü');
    throw error;
  }
}

/**
 * ¾Ü¾øºÃÓÑÇëÇó£¨»ùÓÚÍ¨Öª£©
 */
export async function rejectFriendRequest(notificationId: string): Promise<void> {
  try {
    const currentUserId = await getCurrentUserId();
    const notification = await getNotificationById(notificationId);

    if (notification.user_id !== currentUserId) {
      throw new Error('ÎŞÈ¨´¦Àí´ËºÃÓÑÇëÇó');
    }

    if (notification.type !== 'friend_request') {
      throw new Error('¸ÃÍ¨Öª²»ÊÇºÃÓÑÇëÇó');
    }

    const requesterId = extractFriendRequestSenderId(notification.content);
    await markNotificationAsRead(notificationId);

    if (requesterId) {
      await supabase.from('notifications').insert({
        user_id: requesterId,
        type: 'system',
        title: 'ºÃÓÑÇëÇóÒÑ¾Ü¾ø',
        content: 'ÄãµÄºÃÓÑÇëÇóÎ´Í¨¹ı',
        avatar_url: '',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    handleGlobalError(error, '¾Ü¾øºÃÓÑÇëÇóÊ§°Ü');
    throw error;
  }
}
// ============================================
// è¾…åŠ©å‡½æ•° - è·å–å½“å‰ç™»å½•ç”¨æˆ· ID
// ============================================

/**
 * è·å–å½“å‰ç™»å½•ç”¨æˆ·çš?ID
 * @throws {Error} å¦‚æœç”¨æˆ·æœªç™»å½?
 * @returns {Promise<string>} ç”¨æˆ· ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('è·å–ç”¨æˆ·ä¼šè¯å¤±è´¥:', error);
    throw new Error('æ— æ³•è·å–ç”¨æˆ·ä¼šè¯');
  }
  
  if (!session?.user?.id) {
    throw new Error('ç”¨æˆ·æœªç™»å½•ï¼Œè¯·å…ˆç™»å½•');
  }
  
  return session.user.id;
}

// ============================================
// å¥½å‹ç®¡ç†
// ============================================

/** è·å–æ‰€æœ‰å¥½å‹ï¼ˆåŒ…å«æœªè¯»æ¶ˆæ¯ä¿¡æ¯ï¼?*/
export async function getFriends(): Promise<FriendLatestMessage[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_time', { ascending: false, nullsFirst: false });

    if (error) {
      handleGlobalError(error, 'è·å–å¥½å‹åˆ—è¡¨å¤±è´¥');
      return [];
    }

    return data || [];
  } catch (error) {
    handleGlobalError(error, 'è·å–å¥½å‹åˆ—è¡¨å¤±è´¥');
    return [];
  }
}

/** æ›´æ–°å¥½å‹åœ¨çº¿çŠ¶æ€?*/
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
      console.error('æ›´æ–°å¥½å‹çŠ¶æ€å¤±è´?', error);
    }
  } catch (error) {
    console.error('æ›´æ–°å¥½å‹çŠ¶æ€å¤±è´?', error);
  }
}

/** æ›´æ–°å¥½å‹å­¦ä¹ çŠ¶æ€?*/
export async function updateFriendStudyStatus(
  friendId: string,
  isStudying: boolean,
  studyTime?: number
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    const updateData: any = {
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
      console.error('æ›´æ–°å¥½å‹å­¦ä¹ çŠ¶æ€å¤±è´?', error);
    }
  } catch (error) {
    console.error('æ›´æ–°å¥½å‹å­¦ä¹ çŠ¶æ€å¤±è´?', error);
  }
}

/** æ ¹æ® ID è·å–å¥½å‹ä¿¡æ¯ */
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
      console.error('è·å–å¥½å‹ä¿¡æ¯å¤±è´¥:', error);
      return null;
    }

    return data as FriendLatestMessage;
  } catch (error) {
    console.error('è·å–å¥½å‹ä¿¡æ¯å¤±è´¥:', error);
    return null;
  }
}

// èŠå¤©è®°å½•ç®¡ç†

/** è·å–ä¸æŸä¸ªå¥½å‹çš„èŠå¤©è®°å½• */
export async function getChatHistory(friendId: string): Promise<ChatMessage[]> {
  try {
    const userId = await getCurrentUserId();
    
    // æ„å»ºä¼šè¯ID (è¾ƒå°çš„UUIDåœ¨å‰)
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      handleGlobalError(error, 'è·å–èŠå¤©è®°å½•å¤±è´¥');
      return [];
    }

    // è½¬æ¢ä¸ºæ—§çš„æ•°æ®æ ¼å¼ä»¥å…¼å®¹ç°æœ‰ä»£ç 
    return (data || []).map(msg => {
      const uiMessage: ChatMessage = {
        id: msg.id,
        friend_id: friendId,
        sender: msg.sender_id === userId ? 'user' : 'friend',
        text: msg.text,
        created_at: msg.created_at
      };

      // Add media fields if present
      if (msg.message_type && msg.message_type !== 'text') {
        uiMessage.message_type = msg.message_type;
        uiMessage.media_uri = msg.media_uri;
        uiMessage.media_type = msg.media_type;
        uiMessage.media_size = msg.media_size;
        uiMessage.media_metadata = msg.media_metadata;
      }

      return uiMessage;
    });
  } catch (error) {
    handleGlobalError(error, 'è·å–èŠå¤©è®°å½•å¤±è´¥');
    return [];
  }
}

/** å‘é€æ¶ˆæ?*/
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    // æ„å»ºä¼šè¯ID
    const conversationId = userId < friendId
      ? `${userId}_${friendId}`
      : `${friendId}_${userId}`;

    // ç¡®å®šå‘é€è€…å’Œæ¥æ”¶è€?
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;
    
    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text,
      is_read: false
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      handleGlobalError(error, '·¢ËÍÏûÏ¢Ê§°Ü');
      return null;
    }

    // æ›´æ–°æœªè¯»è®¡æ•°
    await updateUnreadCount(receiverId, senderId, text);

    return data?.id || null;
  } catch (error: any) {
    handleGlobalError(error, '·¢ËÍÏûÏ¢Ê§°Ü');
    return null;
  }
}

/**
 * ğŸ“ å‘é€å¸¦åª’ä½“é™„ä»¶çš„æ¶ˆæ?
 * @param friendId - å¥½å‹ID
 * @param sender - å‘é€è€…ç±»å?
 * @param text - æ¶ˆæ¯æ–‡æœ¬ï¼ˆå¯ä»¥ä¸ºç©ºï¼‰
 * @param mediaData - åª’ä½“æ•°æ®
 * @param messageType - æ¶ˆæ¯ç±»å‹ ('image' | 'video' | 'mixed')
 * @returns æ¶ˆæ¯IDæˆ–null
 */
export async function sendMessageWithMedia(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string,
  mediaData: {
    uri: string;
    type: string;
    size: number;
    category: 'image' | 'video';
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
    };
  },
  messageType: 'image' | 'video' | 'mixed'
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    // æ„å»ºä¼šè¯ID
    const conversationId = userId < friendId
      ? `${userId}_${friendId}`
      : `${friendId}_${userId}`;

    // ç¡®å®šå‘é€è€…å’Œæ¥æ”¶è€?
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;

    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text || '', // å…è®¸ç©ºæ–‡æœ¬ç”¨äºçº¯åª’ä½“æ¶ˆæ¯
      is_read: false,
      message_type: messageType,
      media_uri: mediaData.uri,
      media_type: mediaData.type,
      media_size: mediaData.size,
      media_metadata: mediaData.metadata || null
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('å‘é€åª’ä½“æ¶ˆæ¯å¤±è´?', error);
      return null;
    }

    // æ›´æ–°æœªè¯»è®¡æ•°ï¼ˆä½¿ç”¨é¢„è§ˆæ–‡æœ¬ï¼‰
    const previewText = text || `[${messageType === 'image' ? 'å›¾ç‰‡' : 'è§†é¢‘'}]`;
    await updateUnreadCount(receiverId, senderId, previewText);

    return data?.id || null;
  } catch (error: any) {
    console.error('å‘é€åª’ä½“æ¶ˆæ¯å¤±è´?', error);
    return null;
  }
}

/** æ›´æ–°æœªè¯»è®¡æ•° (å†…éƒ¨è¾…åŠ©å‡½æ•°) */
async function updateUnreadCount(
  userId: string,
  friendId: string,
  lastMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('unread_counts')
    .upsert({
      user_id: userId,
      friend_id: friendId,
      unread_count: 1,
      last_message: lastMessage,
      last_message_time: new Date().toISOString()
    }, {
      onConflict: 'user_id,friend_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('æ›´æ–°æœªè¯»è®¡æ•°å¤±è´¥:', error);
  }
}

/** æ ‡è®°æ¶ˆæ¯ä¸ºå·²è¯?*/
export async function markMessagesAsRead(friendId: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    const { error } = await supabase
      .rpc('mark_messages_as_read', {
        p_user_id: userId,
        p_friend_id: friendId
      });

    if (error) {
      console.error('æ ‡è®°æ¶ˆæ¯å·²è¯»å¤±è´¥:', error);
    }
  } catch (error) {
    console.error('æ ‡è®°æ¶ˆæ¯å·²è¯»å¤±è´¥:', error);
  }
}

/** æ¸…ç©ºæŸä¸ªå¥½å‹çš„èŠå¤©è®°å½?*/
export async function clearChatHistory(friendId: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    // æ„å»ºä¼šè¯ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('æ¸…ç©ºèŠå¤©è®°å½•å¤±è´¥:', error);
    }
  } catch (error) {
    console.error('æ¸…ç©ºèŠå¤©è®°å½•å¤±è´¥:', error);
  }
}

// ============================================
// æœªè¯»æ¶ˆæ¯ç®¡ç†
// ============================================

/** è·å–æ‰€æœ‰æœªè¯»æ¶ˆæ¯è®¡æ•?*/
export async function getUnreadCounts(): Promise<UnreadCount[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('unread_counts')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('è·å–æœªè¯»è®¡æ•°å¤±è´¥:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('è·å–æœªè¯»è®¡æ•°å¤±è´¥:', error);
    return [];
  }
}

/** è·å–æ€»æœªè¯»æ¶ˆæ¯æ•° */
export async function getTotalUnreadCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('unread_counts')
      .select('unread_count')
      .eq('user_id', userId);

    if (error) {
      console.error('è·å–æ€»æœªè¯»æ•°å¤±è´¥:', error);
      return 0;
    }

    return data?.reduce((sum, item) => sum + item.unread_count, 0) || 0;
  } catch (error) {
    console.error('è·å–æ€»æœªè¯»æ•°å¤±è´¥:', error);
    return 0;
  }
}

// ============================================
// é€šçŸ¥ç®¡ç†
// ============================================

/** è·å–æ‰€æœ‰é€šçŸ¥ */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('è·å–é€šçŸ¥å¤±è´¥:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('è·å–é€šçŸ¥å¤±è´¥:', error);
    return [];
  }
}

/** æ ‡è®°é€šçŸ¥ä¸ºå·²è¯?*/
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('æ ‡è®°é€šçŸ¥å·²è¯»å¤±è´¥:', error);
  }
}

/** åˆ é™¤é€šçŸ¥ */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('åˆ é™¤é€šçŸ¥å¤±è´¥:', error);
  }
}

/** è·å–æœªè¯»é€šçŸ¥æ•°é‡ */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('è·å–æœªè¯»é€šçŸ¥æ•°å¤±è´?', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('è·å–æœªè¯»é€šçŸ¥æ•°å¤±è´?', error);
    return 0;
  }
}

// ============================================
// é‚®ä»¶ç®¡ç†
// ============================================

/** è·å–æ‰€æœ‰é‚®ä»?*/
export async function getMails(): Promise<Mail[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('mails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('è·å–é‚®ä»¶å¤±è´¥:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('è·å–é‚®ä»¶å¤±è´¥:', error);
    return [];
  }
}

/** æ ‡è®°é‚®ä»¶ä¸ºå·²è¯?*/
export async function markMailAsRead(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .update({ is_read: true })
    .eq('id', mailId);

  if (error) {
    console.error('æ ‡è®°é‚®ä»¶å·²è¯»å¤±è´¥:', error);
  }
}

/** åˆ é™¤é‚®ä»¶ */
export async function deleteMail(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .delete()
    .eq('id', mailId);

  if (error) {
    console.error('åˆ é™¤é‚®ä»¶å¤±è´¥:', error);
  }
}

/** è·å–æœªè¯»é‚®ä»¶æ•°é‡ */
export async function getUnreadMailCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { count, error } = await supabase
      .from('mails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('è·å–æœªè¯»é‚®ä»¶æ•°å¤±è´?', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('è·å–æœªè¯»é‚®ä»¶æ•°å¤±è´?', error);
    return 0;
  }
}

// ============================================
// å­¦ä¹ è®°å½•ç®¡ç†
// ============================================

/** è·å–å­¦ä¹ è®°å½• */
export async function getStudySessions(limit?: number): Promise<StudySession[]> {
  try {
    const userId = await getCurrentUserId();
    
    let query = supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('è·å–å­¦ä¹ è®°å½•å¤±è´¥:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('è·å–å­¦ä¹ è®°å½•å¤±è´¥:', error);
    return [];
  }
}

/** åˆ›å»ºå­¦ä¹ è®°å½• */
export async function createStudySession(
  subject: string,
  duration: number,
  startedAt: string,
  endedAt?: string,
  notes?: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        subject,
        duration,
        started_at: startedAt,
        ended_at: endedAt,
        notes
      })
      .select('id')
      .single();

    if (error) {
      console.error('åˆ›å»ºå­¦ä¹ è®°å½•å¤±è´¥:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('åˆ›å»ºå­¦ä¹ è®°å½•å¤±è´¥:', error);
    return null;
  }
}

/** è·å–ä»Šæ—¥å­¦ä¹ æ—¶é•¿ */
export async function getTodayStudyTime(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('study_sessions')
      .select('duration')
      .eq('user_id', userId)
      .gte('started_at', today.toISOString());

    if (error) {
      console.error('è·å–ä»Šæ—¥å­¦ä¹ æ—¶é•¿å¤±è´¥:', error);
      return 0;
    }

    return data?.reduce((sum, session) => sum + session.duration, 0) || 0;
  } catch (error) {
    console.error('è·å–ä»Šæ—¥å­¦ä¹ æ—¶é•¿å¤±è´¥:', error);
    return 0;
  }
}

// ============================================
// å®æ—¶è®¢é˜…
// ============================================

/** è®¢é˜…å¥½å‹æ¶ˆæ¯æ›´æ–° */
export async function subscribeToChatMessages(
  friendId: string,
  callback: (message: ChatMessage) => void
) {
  try {
    const userId = await getCurrentUserId();
    
    // æ„å»ºä¼šè¯ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const msg = payload.new as any;
          // è½¬æ¢ä¸ºæ—§æ ¼å¼
          callback({
            id: msg.id,
            friend_id: friendId,
            sender: msg.sender_id === userId ? 'user' : 'friend',
            text: msg.text,
            created_at: msg.created_at
          } as ChatMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('è®¢é˜…èŠå¤©æ¶ˆæ¯å¤±è´¥:', error);
    return () => {}; // è¿”å›ç©ºçš„æ¸…ç†å‡½æ•°
  }
}

/** è®¢é˜…æœªè¯»è®¡æ•°æ›´æ–° */
export async function subscribeToUnreadCounts(
  callback: (unreadCount: UnreadCount) => void
) {
  try {
    const userId = await getCurrentUserId();
    
    const channel = supabase
      .channel('unread_counts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unread_counts',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as UnreadCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('è®¢é˜…æœªè¯»è®¡æ•°æ›´æ–°å¤±è´¥:', error);
    return () => {}; // è¿”å›ç©ºçš„æ¸…ç†å‡½æ•°
  }
}

/** è®¢é˜…é€šçŸ¥æ›´æ–° */
export async function subscribeToNotifications(
  callback: (notification: Notification) => void
) {
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
    console.error('è®¢é˜…é€šçŸ¥æ›´æ–°å¤±è´¥:', error);
    return () => {}; // è¿”å›ç©ºçš„æ¸…ç†å‡½æ•°
  }
}


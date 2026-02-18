-- ============================================================
-- mark_messages_as_read 存储过程
-- 用于标记与某个好友的所有消息为已读
-- ============================================================
-- 日期: 2026-02-18
-- 说明: 创建存储过程用于批量标记消息为已读，并重置未读计数
-- ============================================================

-- 创建或替换存储过程
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id uuid,
  p_friend_id uuid
)
RETURNS void AS $$
DECLARE
  v_conversation_id text;
BEGIN
  -- 构建会话ID（较小的UUID在前）
  v_conversation_id := CASE
    WHEN p_user_id < p_friend_id THEN p_user_id || '_' || p_friend_id
    ELSE p_friend_id || '_' || p_user_id
  END;

  -- 标记消息为已读
  UPDATE chat_messages
  SET is_read = true
  WHERE conversation_id = v_conversation_id
    AND receiver_id = p_user_id
    AND is_read = false;

  -- 重置未读计数
  UPDATE unread_counts
  SET unread_count = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON FUNCTION mark_messages_as_read IS '标记与某个好友的所有消息为已读，并重置未读计数';

-- 授权给 authenticated 用户
GRANT EXECUTE ON FUNCTION mark_messages_as_read(uuid, uuid) TO authenticated;

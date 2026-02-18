-- ============================================================
-- friend_latest_messages 视图
-- 用于好友列表显示，包含最新消息和未读计数
-- ============================================================
-- 日期: 2026-02-18
-- 说明: 创建视图用于获取好友列表，包含好友信息、最新消息和未读计数
-- ============================================================

-- 删除旧视图（如果存在）
DROP VIEW IF EXISTS friend_latest_messages;

-- 创建视图
CREATE VIEW friend_latest_messages AS
SELECT
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  p.bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id
WHERE f.status = 'accepted';

-- 添加注释
COMMENT ON VIEW friend_latest_messages IS '好友列表视图，包含好友信息、最新消息和未读计数';

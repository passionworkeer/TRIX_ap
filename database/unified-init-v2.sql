-- ============================================
-- TRIX 3D Companion - 数据库统一脚本
-- 版本: 2.4
-- ============================================

-- 创建缺失的表

-- user_achievements (用户成就)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL,
  metadata JSONB,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- user_outfits (用户装扮)
CREATE TABLE IF NOT EXISTS user_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  outfit_id UUID NOT NULL,
  is_equipped BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, outfit_id)
);

-- user_purchased_items (已购物品)
CREATE TABLE IF NOT EXISTS user_purchased_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  points_spent INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- friend_requests (好友请求)
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- 添加缺失字段

-- profiles 添加字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS days_active INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;

-- study_rooms 添加字段
ALTER TABLE study_rooms ADD COLUMN IF NOT EXISTS room_code TEXT;
ALTER TABLE study_rooms ADD COLUMN IF NOT EXISTS session_state JSONB;

-- study_room_members 添加字段
ALTER TABLE study_room_members ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE study_room_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE study_room_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE study_room_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'joined';

-- achievements 添加字段
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS points_reward INTEGER DEFAULT 0;

-- 更新视图
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT
  f.id as friendship_id,
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
  uc.last_message_time,
  COALESCE(uc.last_message_time, f.created_at) as sort_time
FROM friends f
JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id
WHERE f.status = 'accepted'
ORDER BY sort_time DESC;

-- 生成 room_code
UPDATE study_rooms SET room_code = UPPER(SUBSTRING(MD5(id::TEXT) FROM 1 FOR 6)) WHERE room_code IS NULL;

-- 成就数据已存在，无需插入

SELECT 'Done!' as result;

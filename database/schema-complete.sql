-- ============================================
-- TRIX 3D Companion - 统一数据库初始化脚本
-- 版本: 3.0 (2026-03-17)
-- 描述: 基于当前 Supabase 数据库实际状态生成
-- ============================================

-- ============================================
-- 第一部分：核心用户表
-- ============================================

-- 1. profiles (用户资料)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  avatar_config JSONB,
  full_name TEXT,
  display_name TEXT,
  bio TEXT,
  points INTEGER DEFAULT 0,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 学习相关
  is_studying BOOLEAN DEFAULT false,
  companion_id UUID REFERENCES profiles(id),
  total_study_time INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  -- 统计
  current_streak INTEGER DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  -- 设置
  show_online_status BOOLEAN DEFAULT true,
  -- 学校信息
  school TEXT,
  grade TEXT
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_studying ON profiles(is_studying) WHERE is_studying = true;
CREATE INDEX IF NOT EXISTS idx_profiles_companion_id ON profiles(companion_id);

-- ============================================
-- 第二部分：好友与社交
-- ============================================

-- 2. friends (好友关系)
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status) WHERE status = 'pending';

-- 3. friend_requests (好友请求)
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id);

-- ============================================
-- 第三部分：消息与通信
-- ============================================

-- 4. chat_messages (聊天消息)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'text',
  media_uri TEXT,
  media_type TEXT,
  media_size BIGINT,
  media_metadata JSONB,
  voice_url TEXT,
  voice_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

-- 5. unread_counts (未读计数)
CREATE TABLE IF NOT EXISTS unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_unread_user ON unread_counts(user_id);

-- 6. notifications (通知)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  avatar_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 7. mails (邮件)
CREATE TABLE IF NOT EXISTS mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id),
  from_name TEXT,
  from_avatar TEXT,
  subject TEXT NOT NULL,
  preview TEXT,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mails_user ON mails(user_id);
CREATE INDEX IF NOT EXISTS idx_mails_created ON mails(created_at DESC);

-- ============================================
-- 第四部分：学习功能
-- ============================================

-- 8. study_sessions (学习记录)
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  subject TEXT,
  notes TEXT,
  focus_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_start ON study_sessions(start_time DESC);

-- 9. study_rooms (学习室)
CREATE TABLE IF NOT EXISTS study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  room_code TEXT UNIQUE,
  session_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_code ON study_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_study_rooms_public ON study_rooms(is_public) WHERE is_public = true;

-- 10. study_room_members (学习室成员)
CREATE TABLE IF NOT EXISTS study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  display_name TEXT,
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ,
  status TEXT DEFAULT 'joined',
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_room_members_room ON study_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_study_room_members_user ON study_room_members(user_id);

-- ============================================
-- 第五部分：积分与商城
-- ============================================

-- 11. user_points (用户积分)
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);

-- 12. point_transactions (积分交易)
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'adjust')),
  reason TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON point_transactions(created_at DESC);

-- 13. achievements (成就)
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  requirement INTEGER,
  type TEXT,
  rarity TEXT DEFAULT 'common',
  points_reward INTEGER DEFAULT 0
);

-- 14. user_achievements (用户成就)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  metadata JSONB,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- 15. mall_items (商城商品)
CREATE TABLE IF NOT EXISTS mall_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price INTEGER DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mall_items_category ON mall_items(category);
CREATE INDEX IF NOT EXISTS idx_mall_items_active ON mall_items(is_active) WHERE is_active = true;

-- 16. user_purchased_items (用户已购物品)
CREATE TABLE IF NOT EXISTS user_purchased_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mall_items(id),
  quantity INTEGER DEFAULT 1,
  points_spent INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_purchased_items_user ON user_purchased_items(user_id);

-- 17. outfits (装扮)
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  preview_image_url TEXT,
  description TEXT,
  price INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfits_category ON outfits(category);
CREATE INDEX IF NOT EXISTS idx_outfits_active ON outfits(is_active) WHERE is_active = true;

-- 18. user_outfits (用户装扮)
CREATE TABLE IF NOT EXISTS user_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id UUID NOT NULL REFERENCES outfits(id),
  is_equipped BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, outfit_id)
);

CREATE INDEX IF NOT EXISTS idx_user_outfits_user ON user_outfits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outfits_equipped ON user_outfits(is_equipped) WHERE is_equipped = true;

-- ============================================
-- 第六部分：位置与地点
-- ============================================

-- 19. places (地点)
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  category TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_location ON places(latitude, longitude);

-- 20. user_favorite_places (用户收藏地点)
CREATE TABLE IF NOT EXISTS user_favorite_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_places_user ON user_favorite_places(user_id);

-- 21. user_locations (用户位置)
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_shared BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_timestamp ON user_locations(timestamp DESC);

-- 22. user_location_settings (位置分享设置)
CREATE TABLE IF NOT EXISTS user_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_location BOOLEAN DEFAULT false,
  share_with_friends BOOLEAN DEFAULT false,
  auto_expire_minutes INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 第七部分：日程与待办
-- ============================================

-- 23. todos (待办)
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed) WHERE completed = false;

-- 24. schedules (日程)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  reminder_minutes INTEGER,
  repeat_type TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_time ON schedules(start_time, end_time);

-- ============================================
-- 第八部分：用户设置
-- ============================================

-- 25. user_settings (用户隐私设置)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  allow_stranger_search BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_study_invites BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ============================================
-- 插入初始成就数据
-- ============================================

INSERT INTO achievements (id, name, name_en, description, icon, category, requirement, type, rarity, points_reward) VALUES
  ('duration_10', '初学者', 'Beginner', '累计专注 10 分钟', '🌱', 'duration', 10, 'total_minutes', 'common', 0),
  ('duration_60', '入门', 'Getting Started', '累计专注 1 小时', '📚', 'duration', 60, 'total_minutes', 'common', 10),
  ('duration_300', '学习达人', 'Study Master', '累计专注 5 小时', '🎯', 'duration', 300, 'total_minutes', 'rare', 50),
  ('streak_3', '三天连续', '3 Day Streak', '连续学习 3 天', '🔥', 'streak', 3, 'consecutive_days', 'common', 20),
  ('streak_7', '一周坚持', 'Week Warrior', '连续学习 7 天', '💪', 'streak', 7, 'consecutive_days', 'rare', 50),
  ('friends_5', '社交达人', 'Social Butterfly', '添加 5 个好友', '🤝', 'social', 5, 'friend_count', 'common', 30)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 插入测试用户数据
-- ============================================

INSERT INTO profiles (id, username, email, display_name, bio, points) VALUES
  ('11111111-1111-1111-1111-111111111111', 'testuser1', 'test1@trix.app', '测试用户1', '我是一个测试用户', 100),
  ('22222222-2222-2222-2222-222222222222', 'testuser2', 'test2@trix.app', '测试用户2', '喜欢学习和探索', 50)
ON CONFLICT (id) DO NOTHING;

SELECT 'Database initialized successfully!' as result;

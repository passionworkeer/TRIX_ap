# TRIX 3D Companion - 统一数据库设计

> 版本: 2.0
> 生成日期: 2026-03-10
> 基于实际 Supabase 数据库结构分析

---

## 📊 数据库现状总结

### 当前存在的表 (22个)

| 表名 | 状态 | 说明 |
|------|------|------|
| profiles | ✅ 活跃 | 用户扩展信息 |
| users | ✅ 活跃 | 用户基本信息 (与 profiles 重复) |
| friends | ✅ 活跃 | 好友关系 |
| chat_messages | ✅ 活跃 | 聊天消息 |
| unread_counts | ⚠️ 空 | 未读计数 |
| notifications | ✅ 活跃 | 通知 |
| mails | ✅ 活跃 | 邮件 |
| study_sessions | ✅ 活跃 | 学习记录 |
| study_rooms | ✅ 活跃 | 自习室 |
| study_room_members | ✅ 活跃 | 自习室成员 |
| pairing_requests | ✅ 活跃 | 配对请求 |
| user_points | ✅ 活跃 | 用户积分 |
| point_transactions | ❌ 空 | 积分交易 (重复) |
| points_transactions | ❌ 空 | 积分交易 (重复) |
| user_settings | ❌ 空 | 用户设置 |
| mall_items | ✅ 活跃 | 商城物品 |
| outfits | ✅ 活跃 | 装扮 |
| achievements | ✅ 活跃 | 成就 |
| todos | ❌ 空 | 待办 |
| schedules | ❌ 空 | 日程 |
| friend_requests | ❌ 空 | 好友请求 |
| friend_latest_messages | ✅ 视图 | 好友最新消息视图 |

---

## 🔴 发现的问题

1. **profiles 与 users 重复** - 两表字段高度相似，应统一
2. **积分表重复** - `point_transactions` 和 `points_transactions` 混用
3. **部分表为空** - todos, schedules, user_settings 等无数据

---

## ✅ 统一后的数据表设计

### 核心表 (必须)

| 表名 | 说明 | Web | iOS |
|------|------|-----|-----|
| profiles | 用户扩展信息 | ✅ | ✅ |
| friends | 好友关系 | ✅ | ✅ |
| chat_messages | 聊天消息 | ✅ | ✅ |
| notifications | 通知 | ✅ | ✅ |
| study_sessions | 学习记录 | ✅ | ✅ |
| study_rooms | 自习室 | ✅ | ✅ |
| study_room_members | 自习室成员 | ✅ | ✅ |
| user_points | 用户积分 | ✅ | ✅ |
| points_transactions | 积分交易 | ✅ | ✅ |
| achievements | 成就 | ✅ | ✅ |
| user_achievements | 用户成就 | ✅ | ✅ |

### 扩展表 (可选)

| 表名 | 说明 | Web | iOS |
|------|------|-----|-----|
| pairing_requests | 配对请求 | ✅ | ✅ |
| mall_items | 商城物品 | ✅ | ✅ |
| outfits | 装扮物品 | ✅ | ✅ |
| user_outfits | 用户装扮 | ✅ | ✅ |
| user_purchased_items | 已购物品 | ✅ | ✅ |
| todos | 待办 | ✅ | ✅ |
| schedules | 日程 | ✅ | ✅ |
| unread_counts | 未读计数 | ✅ | ✅ |
| mails | 邮件 | ✅ | ❌ |
| user_settings | 用户设置 | ✅ | ❌ |

### 视图

| 视图名 | 说明 |
|--------|------|
| friend_latest_messages | 好友最新消息 |

---

## 📝 详细字段定义

### 1. profiles (用户扩展信息)

**统一策略**: 删除独立的 `users` 表，所有用户信息存储在 `profiles` 表中

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  avatar_config JSONB DEFAULT '{}',
  full_name TEXT,
  display_name TEXT,
  bio TEXT,
  website TEXT,
  points INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  companion_id UUID,
  total_study_time INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  show_online_status BOOLEAN DEFAULT true,
  current_streak INTEGER DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_companion_id ON profiles(companion_id);
```

### 2. friends (好友关系)

```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  is_studying BOOLEAN DEFAULT false,
  study_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);
```

### 3. chat_messages (聊天消息)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'file', 'system')),
  is_read BOOLEAN DEFAULT false,
  media_uri TEXT,
  media_type TEXT,
  media_size BIGINT,
  media_metadata JSONB,
  voice_url TEXT,
  voice_duration INTEGER,
  voice_transcript TEXT,
  voice_mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
```

### 4. notifications (通知)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'friend_request', 'study', 'achievement', 'reminder')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  avatar_url TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

### 5. study_sessions (学习记录)

```sql
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL,  -- 分钟数
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  earned_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started ON study_sessions(started_at DESC);
```

### 6. study_rooms (自习室)

```sql
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  session_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_rooms_code ON study_rooms(room_code);
CREATE INDEX idx_study_rooms_public ON study_rooms(is_public);
```

### 7. study_room_members (自习室成员)

```sql
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,
  status TEXT DEFAULT 'joined' CHECK (status IN ('joined', 'active', 'paused', 'left')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_study_room_members_room ON study_room_members(room_id);
CREATE INDEX idx_study_room_members_user ON study_room_members(user_id);
```

### 8. user_points (用户积分)

```sql
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_points_user ON user_points(user_id);
```

### 9. points_transactions (积分交易) - 统一命名!

```sql
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- 正数增加，负数减少
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'adjust', 'refund')),
  description TEXT,
  balance_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX idx_points_transactions_created ON points_transactions(created_at DESC);
```

### 10. achievements (成就定义)

```sql
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,  -- 如 'duration_10', 'streak_7'
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  icon TEXT,
  category TEXT CHECK (category IN ('duration', 'streak', 'social', 'milestone', 'special')),
  requirement INTEGER NOT NULL,
  type TEXT NOT NULL,  -- 如 'total_minutes', 'streak_days', 'friends_count'
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  points_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 11. user_achievements (用户成就)

```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  metadata JSONB,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
```

### 12. pairing_requests (配对请求)

```sql
CREATE TABLE pairing_requests (
  id TEXT PRIMARY KEY,  -- 如 'trix-xxx'
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT,
  platform TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  device_token TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pairing_requests_status ON pairing_requests(status);
CREATE INDEX idx_pairing_requests_device ON pairing_requests(device_id);
```

### 13. mall_items (商城物品)

```sql
CREATE TABLE mall_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price INTEGER NOT NULL,
  category TEXT CHECK (category IN ('clothing', 'avatar', 'background', 'effect', 'badge')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 14. outfits (装扮物品)

```sql
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hair', 'face', 'clothing', 'background', 'accessory', 'pose')),
  image_url TEXT,
  preview_image_url TEXT,
  description TEXT,
  price INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outfits_category ON outfits(category);
```

### 15. user_outfits (用户装扮)

```sql
CREATE TABLE user_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  is_equipped BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, outfit_id)
);

CREATE INDEX idx_user_outfits_user ON user_outfits(user_id);
CREATE INDEX idx_user_outfits_equipped ON user_outfits(user_id, is_equipped);
```

### 16. user_purchased_items (已购物品)

```sql
CREATE TABLE user_purchased_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES mall_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  points_spent INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);
```

### 17. todos (待办)

```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[],
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user ON todos(user_id);
CREATE INDEX idx_todos_completed ON todos(user_id, is_completed);
```

### 18. schedules (日程)

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  recurrence JSONB,  -- 如 {"type": "weekly", "days": [1,3,5]}
  location TEXT,
  reminder JSONB,  -- 如 {"minutes": 30, "enabled": true}
  color TEXT,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_user ON schedules(user_id);
CREATE INDEX idx_schedules_start ON schedules(start_time);
```

### 19. unread_counts (未读计数)

```sql
CREATE TABLE unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_unread_counts_user ON unread_counts(user_id);
```

### 20. mails (邮件) - 可选

```sql
CREATE TABLE mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_name TEXT NOT NULL,
  from_avatar TEXT,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mails_user ON mails(user_id);
CREATE INDEX idx_mails_read ON mails(user_id, is_read);
```

### 21. user_settings (用户设置) - 可选

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  allow_stranger_search BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_study_invites BOOLEAN DEFAULT true,
  notification_settings JSONB DEFAULT '{"chat": true, "friend_request": true, "study": true, "achievement": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 视图定义

### friend_latest_messages (好友最新消息视图)

```sql
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT
  f.id as friendship_id,
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  f.bio,
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
```

---

## 🚀 RLS 策略

所有表启用 Row Level Security:

```sql
-- 为每个表启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mall_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchased_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 通用策略: 用户只能操作自己的数据
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "friends_own" ON friends FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_own" ON chat_messages FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
-- ... 其他表类似
```

---

## 📋 字段对照表 (Web vs iOS)

| 功能 | Web 字段 | iOS 字段 | 统一后字段 |
|------|----------|----------|------------|
| 学习时长 | duration | durationMinutes | duration |
| 消息内容 | text | content | text |
| 通知内容 | content | body | content |
| 成就类型 | type | - | type |
| 积分变化 | amount | pointsChange | amount |

---

*文档结束*

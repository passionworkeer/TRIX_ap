# 数据库设计文档

> 📚 TRIX 3D Companion 数据库架构
> 🎯 基于 Supabase (PostgreSQL)
> **最后更新**: 2026-03-04

---

## 1. 数据库概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Database Schema                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Core Tables                                   │   │
│  │                                                                   │   │
│  │  ┌─────────┐      ┌─────────┐      ┌──────────────┐           │   │
│  │  │  users  │───▶─│ friends │◀─────│ chat_messages│           │   │
│  │  │         │      │         │      │              │           │   │
│  │  └────┬────┘      └────┬────┘      └──────────────┘           │   │
│  │       │                │                                        │   │
│  │       │                ▼                                        │   │
│  │       │         ┌──────────────┐                                │   │
│  │       │         │unread_counts │                                │   │
│  │       │         └──────────────┘                                │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  ┌─────────────────┐                                          │   │
│  │  │  study_sessions │                                          │   │
│  │  │         │        │                                          │   │
│  │  │         ▼        │                                          │   │
│  │  │  ┌─────────────┐│                                          │   │
│  │  │  │ study_rooms ││                                          │   │
│  │  │  │     │       ││                                          │   │
│  │  │  │     ▼       ││                                          │   │
│  │  │  │┌──────────┐││                                          │   │
│  │  │  ││study_room│││                                          │   │
│  │  │  ││_members │││                                          │   │
│  │  │  │└──────────┘││                                          │   │
│  │  │  └─────────────┘│                                          │   │
│  │  └─────────────────┘                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Feature Tables                                 │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────┐  ┌──────┐  ┌──────────┐      │   │
│  │  │notifications│  │  mails  │  │ todos │  │ schedules │      │   │
│  │  └─────────────┘  └─────────┘  └───────┘  └───────────┘      │   │
│  │                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐              │   │
│  │  │points_transactions│  │      mall_items      │              │   │
│  │  └──────────────────┘  └──────────────────────┘              │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据表清单

### 2.1 核心表

| 表名 | 描述 | 主要字段 |
|------|------|---------|
| `users` | 用户账户 | id, email, username, avatar_url |
| `profiles` | 用户资料扩展 | user_id, points, total_study_time, avatar_config |
| `friends` | 好友关系 | user_id, friend_id, status, is_studying |
| `chat_messages` | 聊天消息 | sender_id, receiver_id, content, message_type |
| `conversations` | 对话 | id, type, last_message_at |
| `unread_counts` | 未读计数 | user_id, friend_id, unread_count |
| `study_sessions` | 学习记录 | user_id, duration, started_at, ended_at |
| `study_rooms` | 学习室 | host_id, name, is_active |
| `study_room_members` | 学习室成员 | room_id, user_id, status |

### 2.2 功能表

| 表名 | 描述 | 主要字段 |
|------|------|---------|
| `notifications` | 通知 | user_id, type, title, content, is_read |
| `mails` | 系统邮件 | user_id, from_name, subject, is_read |
| `todos` | 待办事项 | user_id, title, is_completed |
| `schedules` | 日程 | user_id, title, start_time, end_time |
| `points_transactions` | 积分交易 | user_id, amount, type |
| `mall_items` | 商城商品 | name, price, type, is_active |
| `pairings` | 设备配对 | user_id, device_id, status |
| `achievements` | 成就 | user_id, type, unlocked_at |

---

## 3. 核心表结构

### 3.1 用户表 (users)

Supabase Auth 表，由 Supabase 管理。

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，用户 ID |
| email | TEXT | 邮箱，唯一 |
| created_at | TIMESTAMPTZ | 创建时间 |

---

### 3.2 用户资料表 (profiles)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  avatar_config JSONB DEFAULT '{}',
  bio TEXT,
  points INTEGER DEFAULT 0,
  total_study_time INTEGER DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  companion_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_points ON profiles(points) WHERE points > 0;
CREATE INDEX idx_profiles_study_time ON profiles(total_study_time) WHERE total_study_time > 0;
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，关联 auth.users |
| username | TEXT | 用户名，唯一 |
| full_name | TEXT | 显示名称 |
| avatar_url | TEXT | 头像 URL |
| avatar_config | JSONB | 头像配置 |
| bio | TEXT | 个人简介 |
| points | INTEGER | 积分余额 |
| total_study_time | INTEGER | 累计学习时长(分钟) |
| days_active | INTEGER | 活跃天数 |
| interaction_count | INTEGER | 互动次数 |
| is_studying | BOOLEAN | 是否正在学习 |
| companion_id | UUID | 当前陪伴的好友 ID |

---

### 3.3 好友表 (friends)

```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')) DEFAULT 'offline',
  bio TEXT,
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 索引
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | UUID | 当前用户 ID |
| friend_id | UUID | 好友用户 ID |
| name | TEXT | 好友显示名称 |
| avatar_url | TEXT | 好友头像 |
| status | TEXT | 在线状态 |
| study_time | INTEGER | 好友学习时长 |
| is_studying | BOOLEAN | 是否正在学习 |

---

### 3.4 聊天消息表 (chat_messages)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'mixed')),
  media_uri TEXT,
  media_type TEXT,
  media_size INTEGER,
  media_metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX idx_messages_created ON chat_messages(created_at DESC);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| conversation_id | TEXT | 对话 ID (格式: userId_friendId) |
| sender_id | UUID | 发送者 ID |
| receiver_id | UUID | 接收者 ID |
| text | TEXT | 消息内容 |
| message_type | TEXT | 消息类型 |
| media_uri | TEXT | 媒体文件 URL |
| media_type | TEXT | 媒体类型 |
| media_size | INTEGER | 文件大小 |
| media_metadata | JSONB | 媒体元数据 |
| is_read | BOOLEAN | 是否已读 |

---

### 3.5 未读计数表 (unread_counts)

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

CREATE INDEX idx_unread_user ON unread_counts(user_id);
```

---

### 3.6 学习记录表 (study_sessions)

```sql
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_study_user ON study_sessions(user_id);
CREATE INDEX idx_study_started ON study_sessions(started_at DESC);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | UUID | 用户 ID |
| subject | TEXT | 学习主题 |
| duration | INTEGER | 学习时长(分钟) |
| started_at | TIMESTAMPTZ | 开始时间 |
| ended_at | TIMESTAMPTZ | 结束时间 |

---

### 3.7 学习室表 (study_rooms)

```sql
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_host ON study_rooms(host_id);
CREATE INDEX idx_rooms_active ON study_rooms(is_active) WHERE is_active = true;
```

---

### 3.8 学习室成员表 (study_room_members)

```sql
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'studying' CHECK (status IN ('studying', 'paused', 'left')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_members_room ON study_room_members(room_id);
CREATE INDEX idx_members_user ON study_room_members(user_id);
```

---

### 3.9 通知表 (notifications)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'friend_request', 'study', 'achievement')),
  title TEXT NOT NULL,
  content TEXT,
  avatar_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read) WHERE is_read = false;
```

---

### 3.10 积分交易表 (points_transactions)

```sql
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('study', 'purchase', 'bonus', 'reward', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_user ON points_transactions(user_id);
CREATE INDEX idx_points_created ON points_transactions(created_at DESC);
```

---

### 3.11 商城商品表 (mall_items)

```sql
CREATE TABLE mall_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('avatar_frame', 'theme', 'badge', 'effect')),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mall_active ON mall_items(is_active) WHERE is_active = true;
```

---

### 3.12 设备配对表 (pairings)

```sql
CREATE TABLE pairings (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  pairing_code TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_pairings_device ON pairings(device_id);
CREATE INDEX idx_pairings_code ON pairings(pairing_code);
```

---

### 3.13 待办事项表 (todos)

```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user ON todos(user_id);
CREATE INDEX idx_todos_completed ON todos(is_completed) WHERE is_completed = false;
```

---

### 3.14 日程表 (schedules)

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_user ON schedules(user_id);
CREATE INDEX idx_schedules_time ON schedules(start_time);
```

---

## 4. RLS 策略 (Row Level Security)

### 4.1 profiles 表

```sql
-- 用户只能查看和修改自己的资料
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
```

### 4.2 friends 表

```sql
-- 用户只能查看自己的好友
CREATE POLICY "Users can view own friends"
ON friends FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own friends"
ON friends FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### 4.3 chat_messages 表

```sql
-- 用户只能查看自己的消息
CREATE POLICY "Users can view own messages"
ON chat_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

---

## 5. 数据库关系图

```
┌─────────────┐
│  auth.users │ (Supabase 管理)
└──────┬──────┘
       │
       │ 1:1
       ▼
┌──────────────┐     1:N     ┌────────────────┐
│   profiles   │─────────────▶│  study_sessions │
└──────┬───────┘             └────────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐     1:N     ┌────────────────┐
│   friends    │─────────────▶│ study_rooms     │
└──────────────┘             └────────┬────────┘
       │                              │
       │ 1:N                          │ 1:N
       ▼                              ▼
┌──────────────┐              ┌────────────────┐
│chat_messages │              │study_room_     │
└──────────────┘              │    members     │
       │                       └────────────────┘
       │ 1:N
       ▼
┌──────────────┐
│unread_counts │
└──────────────┘
```

---

## 6. Supabase Realtime

### 6.1 订阅消息变化

```typescript
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `receiver_id=eq.${userId}`
  }, (payload) => {
    console.log('新消息:', payload.new);
  })
  .subscribe();
```

### 6.2 订阅好友状态

```typescript
supabase
  .channel('friends')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'friends',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('好友状态变化:', payload);
  })
  .subscribe();
```

---

## 7. 性能优化

### 7.1 索引

关键查询字段已创建索引：
- `profiles.username`
- `friends.user_id`, `friends.status`
- `chat_messages.conversation_id`, `chat_messages.created_at`
- `study_sessions.user_id`, `study_sessions.started_at`
- `notifications.user_id`, `notifications.is_read`

### 7.2 分页

大列表查询使用分页：

```sql
SELECT * FROM chat_messages
WHERE conversation_id = 'xxx'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

---

## 8. 数据迁移脚本

### 8.1 添加累计学习时长

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_total_study_time
ON profiles(total_study_time)
WHERE total_study_time > 0;

COMMENT ON COLUMN profiles.total_study_time IS '累计专注时长(分钟)';
```

### 8.2 添加积分字段

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_points
ON profiles(points)
WHERE points > 0;
```

---

## 9. SQLite 本地数据库 (TRIX Native)

TRIX Native Server 使用 SQLite 进行本地数据持久化。

### 9.1 表结构

#### pairings 表 (配对信息)

```sql
CREATE TABLE pairings (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  device_id TEXT,
  device_name TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  paired_at INTEGER,
  websocket_url TEXT,
  client_token TEXT
);
```

#### messages 表 (消息存储)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  pairing_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  text TEXT,
  attachments TEXT,
  sender_id TEXT,
  sender_name TEXT,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending'
);
```

---

**最后更新**: 2026-03-15
**版本**: 2.1

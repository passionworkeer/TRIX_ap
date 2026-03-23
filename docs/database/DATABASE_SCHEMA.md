# 数据库设计文档

> 📚 TRIX 3D Companion 数据库架构
> 🎯 基于 Supabase (PostgreSQL) + JSON 文件存储（TRIX Native Server）
> **最后更新**: 2026-03-23（内容已修订：修正 study_rooms 列名、friends 状态值、chat_messages receiver_id；新增 7 个缺失表/视图）

---

## ⚠️ 重要：表名对照

以下为代码中实际使用的表名，与某些旧迁移脚本中的名称可能不同：

| 实际表名 | 旧迁移/文档名 | 说明 |
|---------|------------|------|
| `point_transactions`（单数） | `points_transactions`（复数） | 代码中正确使用 `point_transactions` |
| `friends` | `friendships` | `locationService.ts` 曾错误引用 `friendships` |
| `user_points_overview`（视图） | — | 存在于代码中但旧 Schema 未记录 |

> `mallService.ts` 使用 `points_transactions`（复数）是**代码 Bug**，实际数据库表名为 `point_transactions`（单数）。

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
│  │  │  users  │───▶─│ profiles│───▶─│user_sessions │           │   │
│  │  │(Auth)   │      │         │      │(单设备登录)  │           │   │
│  │  └────┬────┘      └────┬────┘      └──────────────┘           │   │
│  │       │                │                                        │   │
│  │       ▼                ▼                                        │   │
│  │  ┌─────────┐      ┌────────────────────────────────┐          │   │
│  │  │ friends │◀─── │  friend_requests                 │          │   │
│  │  │         │      │  chat_messages │unread_counts  │          │   │
│  │  └─────────┘      └────────────────────────────────┘          │   │
│  │                                                                   │   │
│  │  ┌─────────────────┐   ┌──────────────────────────────┐      │   │
│  │  │  study_sessions │   │  study_rooms                   │      │   │
│  │  │                 │   │  study_room_members            │      │   │
│  │  └─────────────────┘   └──────────────────────────────┘      │   │
│  │  ┌─────────────────────────────────────────────────────┐      │   │
│  │  │  user_points │ point_transactions (单数)           │      │   │
│  │  └─────────────────────────────────────────────────────┘      │   │
│  │  ┌──────────────────┐   ┌──────────────────────────────┐      │   │
│  │  │ achievements     │   │ user_achievements           │      │   │
│  │  │ outfits          │   │ user_outfits │ user_purch..  │      │   │
│  │  └──────────────────┘   └──────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Feature Tables                                 │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────┐  ┌──────┐  ┌──────────┐      │   │
│  │  │notifications│  │  mails  │  │ todos │  │ schedules │      │   │
│  │  └─────────────┘  └─────────┘  └───────┘  └───────────┘      │   │
│  │                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐  ┌────────┐  │   │
│  │  │pairings          │  │   mall_items          │  │user_set│  │   │
│  │  │(设备配对)         │  │                      │  │-tings  │  │   │
│  │  └──────────────────┘  └──────────────────────┘  └────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据表清单

### 2.1 核心表

| 表名 | 描述 | 主要字段 |
|------|------|---------|
| `users` | 用户账户（Supabase Auth） | id, email |
| `profiles` | 用户资料扩展 | user_id, points, total_study_time, avatar_config, active_session_id |
| `user_sessions` | 单设备登录会话 | id, user_id, platform, device_id, is_active, expires_at |
| `friends` | 好友关系 | user_id, friend_id, status, is_studying |
| `friend_requests` | 好友请求 | id, from_user_id, to_user_id, status |
| `chat_messages` | 聊天消息 | sender_id, receiver_id, content, message_type, created_at |
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
| `user_points` | 用户积分余额 | user_id, balance, updated_at |
| `point_transactions` | 积分变动流水（⚠️ 单数，代码 Bug 写成了复数） | user_id, amount, type |
| `achievements` | 成就列表（参考表） | id, type, name, description, icon |
| `user_achievements` | 用户已解锁成就 | user_id, achievement_id, unlocked_at |
| `outfits` | 装扮目录（参考表） | id, name, type, price, preview_url |
| `user_outfits` | 用户已购买装扮 | user_id, outfit_id, purchased_at |
| `mall_items` | 商城商品 | name, price, type, is_active |
| `user_purchased_items` | 用户已购商品 | user_id, item_id, purchased_at |
| `pairings` | 设备配对 | user_id, device_id, status, platform |
| `user_settings` | 用户设置 | user_id, key, value |

### 2.3 视图（Views）

| 视图名 | 描述 | 代码引用 |
|--------|------|---------|
| `friend_latest_messages` | 好友最新消息 | `friendService.ts` |
| `user_points_overview` | 用户积分概览 | `pointsService.ts`（⚠️ 旧 Schema 未记录） |

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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 索引
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status) WHERE status = 'pending';
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | UUID | 当前用户 ID |
| friend_id | UUID | 好友用户 ID |
| status | TEXT | 好友关系状态（pending/accepted/rejected） |
| study_time | INTEGER | 好友学习时长 |
| is_studying | BOOLEAN | 好友是否正在学习 |

---

### 3.4 聊天消息表 (chat_messages)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  media_uri TEXT,
  media_type TEXT,
  media_size BIGINT,
  media_metadata JSONB,
  voice_url TEXT,
  voice_duration INTEGER,
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
| receiver_id | UUID | 接收者 ID（可为 NULL，支持群组消息） |
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

CREATE INDEX idx_rooms_code ON study_rooms(room_code);
CREATE INDEX idx_rooms_public ON study_rooms(is_public) WHERE is_public = true;
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| name | TEXT | 房间名称 |
| description | TEXT | 房间描述 |
| capacity | INTEGER | 容纳人数上限 |
| current_members | INTEGER | 当前成员数 |
| is_public | BOOLEAN | 是否公开 |
| created_by | UUID | 创建者 ID（关联 profiles） |
| room_code | TEXT | 房间码（唯一，用于加入） |
| session_state | JSONB | 学习会话状态 |

---

### 3.8 学习室成员表 (study_room_members)

```sql
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'joined',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
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

### 3.10 积分交易表 (point_transactions)

> ⚠️ 实际数据库表名为 `point_transactions`（单数），`mallService.ts` 中使用 `points_transactions`（复数）为代码 Bug。

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('study', 'purchase', 'bonus', 'reward', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_user ON point_transactions(user_id);
CREATE INDEX idx_points_created ON point_transactions(created_at DESC);
```

---

## 视图（Views）

### friend_latest_messages

获取每个好友的最新一条消息，用于聊天列表展示。

```sql
-- 存在于 init.sql，friendService.ts 中使用
CREATE VIEW friend_latest_messages AS ...
```

### user_points_overview

用户积分概览视图，`pointsService.ts` 中使用。

> 代码引用：`src/services/pointsService.ts` — **旧 Schema 未记录此视图**

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

## 9. TRIX Native Server 本地状态存储

TRIX Native Server 使用 **JSON 文件存储**（`JsonStateStore`）进行本地持久化，不使用 SQLite。

### 9.1 存储位置

```
<storageDir>/.trix-native-channel/
├── state.json          # 主状态文件（pairings, conversations, messages 等）
└── attachments/        # 附件文件存储
    └── <sha256>.ext   # 按哈希命名的附件文件
```

- `storageDir` 默认值: `./.trix-native-channel`（可通过 `TRIX_NATIVE_STORAGE_DIR` 环境变量覆盖）
- OpenClaw 插件附件存储: `<storageDir>/openclaw/attachments/`

### 9.2 state.json 结构

```json
{
  "adminToken": "...",
  "serviceToken": "...",
  "pairings": [/* PairingRecord[] */],
  "conversations": [/* ConversationRecord[] */],
  "messages": [/* MessageRecord[] */],
  "uploads": [/* AttachmentDescriptor[] */]
}
```

### 9.3 核心类型（服务器端）

```typescript
// 配对记录
interface PairingRecord {
  code: string;              // 配对码 (6-8位字母数字)
  secret: string;            // 配对密钥
  label?: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'paired' | 'expired';
  conversationId: string;
  claimUrl: string;
  qrDataUrl?: string;
  pairedAt?: number;
  pairedClientId?: string;
  pairedDeviceName?: string;
  clientToken?: string;
}

// 会话记录
interface ConversationRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  pairingCode: string;
  participants: Array<{
    clientId: string;
    deviceName?: string;
    role: 'user' | 'agent';
    clientToken?: string;
    connectedAt?: number;
    lastSeenAt?: number;
  }>;
}

// 消息记录
interface MessageRecord {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound' | 'system';
  text: string;
  attachments: AttachmentDescriptor[];
  senderId: string;
  senderName?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}
```

### 9.4 Study Rooms（类型已定义，初始化待实现）

`study_rooms` 和 `study_room_members` 类型已在 `types.ts` 中定义，但 `DEFAULT_STATE` 中尚未初始化。详细类型见 `packages/trix-openclaw-native/src/types.ts`。

---

**最后更新**: 2026-03-22

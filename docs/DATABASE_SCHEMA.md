# 数据库设计文档

> 📚 TRIX 3D Companion 数据库架构
> 🎯 基于 Supabase (PostgreSQL)

---

## 🏗️ 数据库概览

```
┌─────────────────────────────────────────────────────────────┐
│                   Database Schema                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Core Tables                       │   │
│  │  users ─── friends ─── chat_messages                │   │
│  │    │           │                                   │   │
│  │    │           └── unread_counts                   │   │
│  │    │                                            │   │
│  │    └── study_sessions                            │   │
│  │         │                                         │   │
│  │         └── study_rooms ── study_room_members     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Feature Tables                      │   │
│  │  notifications ─── mails ── todos ── schedules     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 数据表清单

### 核心表

| 表名 | 描述 | 状态 |
|------|------|------|
| `users` | 用户表 | ✅ 完成 |
| `friends` | 好友表 | ✅ 完成 |
| `chat_messages` | 聊天消息 | ✅ 完成 |
| `unread_counts` | 未读计数 | ✅ 完成 |
| `study_sessions` | 学习记录 | ✅ 完成 |
| `study_rooms` | 学习室 | ✅ 完成 |
| `study_room_members` | 学习室成员 | ✅ 完成 |

### 功能表

| 表名 | 描述 | 状态 |
|------|------|------|
| `notifications` | 通知表 | ✅ 完成 |
| `mails` | 邮件表 | ✅ 完成 |
| `todos` | 待办事项 | ✅ 完成 |
| `schedules` | 日程表 | ✅ 完成 |

---

## 🔑 核心表结构

### 1. 用户表 (users)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，自生成 |
| email | TEXT | 邮箱，唯一 |
| username | TEXT | 用户名，唯一 |
| display_name | TEXT | 显示名称 |
| avatar_url | TEXT | 头像 URL |
| bio | TEXT | 个人简介 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

---

### 2. 好友表 (friends)

```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')),
  bio TEXT,
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| friend_id | TEXT | 好友唯一标识 |
| name | TEXT | 好友名称 |
| status | TEXT | 在线状态 |
| study_time | INTEGER | 学习时长(分钟) |
| is_studying | BOOLEAN | 是否正在学习 |

---

### 3. 聊天消息表 (chat_messages)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friend_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'friend', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_chat_messages_friend_id ON chat_messages(friend_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| friend_id | TEXT | 对应好友 ID |
| sender | TEXT | 发送者 (user/friend/bot) |
| text | TEXT | 消息内容 |
| created_at | TIMESTAMPTZ | 发送时间 |

---

### 4. 未读计数表 (unread_counts)

```sql
CREATE TABLE unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

---

### 5. 通知表 (notifications)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'friend_request', 'study', 'achievement')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  avatar_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

**通知类型**:
- `message` - 新消息
- `system` - 系统通知
- `friend_request` - 好友请求
- `study` - 学习提醒
- `achievement` - 成就解锁

---

### 6. 邮件表 (mails)

```sql
CREATE TABLE mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_avatar TEXT,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 7. 学习记录表 (study_sessions)

```sql
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at);
```

---

### 8. 学习室表 (study_rooms)

```sql
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 9. 学习室成员表 (study_room_members)

```sql
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, friend_id)
);
```

---

### 10. 待办事项表 (todos)

```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 索引
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_completed ON todos(completed);
```

---

### 11. 日程表 (schedules)

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  reminder_minutes_before INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 索引
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);
```

---

## 🔧 视图 (Views)

### 好友最新消息视图

```sql
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.bio,
  f.study_time,
  f.is_studying,
  uc.unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN unread_counts uc ON f.friend_id = uc.friend_id
ORDER BY uc.last_message_time DESC NULLS LAST;
```

---

## ⚙️ 存储过程 (Functions)

### 1. 发送消息

```sql
CREATE OR REPLACE FUNCTION send_message(
  p_friend_id TEXT,
  p_sender TEXT,
  p_text TEXT
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO chat_messages (friend_id, sender, text)
  VALUES (p_friend_id, p_sender, p_text)
  RETURNING id INTO v_message_id;

  IF p_sender = 'friend' OR p_sender = 'bot' THEN
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 1, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      unread_count = unread_counts.unread_count + 1,
      last_message = p_text,
      last_message_time = NOW();
  ELSE
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 0, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      last_message = p_text,
      last_message_time = NOW();
  END IF;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;
```

### 2. 标记消息已读

```sql
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id UUID,
  p_friend_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE unread_counts
  SET unread_count = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 🛡️ 安全策略 (RLS)

### 启用 RLS

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
```

### 示例策略

```sql
-- Users 表策略
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (true);

-- Todos 表策略
CREATE POLICY "Todos are viewable by owner" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Todos can be created by owner" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Todos can be updated by owner" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Todos can be deleted by owner" ON todos FOR DELETE USING (auth.uid() = user_id);
```

---

## 📊 索引优化

| 表名 | 索引 | 用途 |
|------|------|------|
| users | email, username | 快速查询 |
| friends | user_id, friend_id, status | 好友列表 |
| chat_messages | friend_id, created_at | 消息历史 |
| notifications | user_id, is_read | 通知列表 |
| study_sessions | user_id, started_at | 学习统计 |
| todos | user_id, due_date, completed | 待办管理 |
| schedules | user_id, start_time | 日程管理 |

---

## 🔄 同步状态

待办和日程表使用 `sync_status` 字段管理同步：

| 状态 | 说明 |
|------|------|
| `synced` | 已同步 |
| `pending` | 待同步 |
| `conflict` | 冲突 |

---

## 📈 性能建议

1. **定期清理** - 归档旧消息
2. **分页查询** - 大列表使用游标分页
3. **连接池** - 复用数据库连接
4. **读写分离** - 分离查询和写入

---

## 🧪 测试数据

项目包含完整的 Mock 数据：

- 1 个用户
- 6 个好友 (Alice, Bob, Carol, David, Emma, TRIX 机器人)
- 52 条聊天记录
- 5 条通知
- 4 封邮件
- 3 个学习室

---

**最后更新**: 2026-03-01
**版本**: 2.0

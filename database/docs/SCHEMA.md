# 🏗️ TRIX 数据库架构图

## 📊 表关系概览

```
┌─────────────────┐
│     users       │  (用户表)
│  - id (PK)      │
│  - email        │
│  - username     │
│  - display_name │
│  - avatar_url   │
└────────┬────────┘
         │
         │ 1:N (一个用户有多个好友)
         │
┌────────▼────────────────────┐
│        friends              │  (好友表)
│  - id (PK)                  │
│  - user_id (FK → users)     │
│  - friend_id (UNIQUE)       │
│  - name                     │
│  - status                   │
│  - is_studying              │
│  - study_time               │
└─────────────────────────────┘
         │
         │ 1:N (一个好友有多条消息)
         │
┌────────▼────────────────────┐
│    chat_messages            │  (聊天记录表)
│  - id (PK)                  │
│  - friend_id                │
│  - sender                   │
│  - text                     │
│  - created_at               │
└─────────────────────────────┘

┌─────────────────────────────┐
│    unread_counts            │  (未读计数表)
│  - id (PK)                  │
│  - user_id (FK → users)     │
│  - friend_id                │
│  - unread_count             │
│  - last_message             │
│  - last_message_time        │
└─────────────────────────────┘

┌─────────────────────────────┐
│    notifications            │  (通知表)
│  - id (PK)                  │
│  - user_id (FK → users)     │
│  - type                     │
│  - title                    │
│  - content                  │
│  - is_read                  │
└─────────────────────────────┘

┌─────────────────────────────┐
│        mails                │  (邮件表)
│  - id (PK)                  │
│  - user_id (FK → users)     │
│  - from_name                │
│  - subject                  │
│  - content                  │
│  - is_read                  │
└─────────────────────────────┘

┌─────────────────────────────┐
│    study_sessions           │  (学习记录表)
│  - id (PK)                  │
│  - user_id (FK → users)     │
│  - subject                  │
│  - duration                 │
│  - started_at               │
│  - ended_at                 │
└─────────────────────────────┘

┌─────────────────────────────┐
│     study_rooms             │  (自习室表)
│  - id (PK)                  │
│  - name                     │
│  - capacity                 │
│  - current_members          │
│  - created_by (FK → users)  │
└────────┬────────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────────────┐
│  study_room_members         │  (自习室成员表)
│  - id (PK)                  │
│  - room_id (FK → rooms)     │
│  - user_id (FK → users)     │
│  - friend_id                │
│  - is_active                │
└─────────────────────────────┘
```

---

## 🔗 视图

### friend_latest_messages (好友最新消息视图)

```sql
SELECT 
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.is_studying,
  uc.unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN unread_counts uc ON f.friend_id = uc.friend_id
```

**用途**: 在聊天列表页面一次查询获取所有好友信息和未读状态

---

## ⚙️ 存储过程

### 1. send_message(friend_id, sender, text)

**功能**: 发送消息并自动更新未读计数

**逻辑**:
1. 插入一条新消息到 `chat_messages`
2. 如果是好友/机器人发送的消息 → 未读计数 +1
3. 如果是用户发送的消息 → 只更新最后消息，不增加未读
4. 返回新消息的 ID

**示例**:
```sql
SELECT send_message('alice', 'friend', '你好吗？');
```

---

### 2. mark_messages_as_read(user_id, friend_id)

**功能**: 标记某个好友的所有消息为已读

**逻辑**:
1. 将 `unread_counts` 中对应好友的 `unread_count` 设置为 0
2. 更新 `updated_at` 时间戳

**示例**:
```sql
SELECT mark_messages_as_read(
  '00000000-0000-0000-0000-000000000001',
  'alice'
);
```

---

## 📋 字段说明

### users (用户表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| email | TEXT | 邮箱 | UNIQUE, NOT NULL |
| username | TEXT | 用户名 | UNIQUE, NOT NULL |
| display_name | TEXT | 显示名称 | NOT NULL |
| avatar_url | TEXT | 头像URL | - |
| bio | TEXT | 个人简介 | - |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

### friends (好友表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → users(id) |
| friend_id | TEXT | 好友唯一标识 | UNIQUE, NOT NULL |
| name | TEXT | 好友名称 | NOT NULL |
| avatar_url | TEXT | 头像URL | - |
| status | TEXT | 在线状态 | CHECK (online/offline/busy/away) |
| bio | TEXT | 个人简介 | - |
| study_time | INTEGER | 学习时长（分钟） | DEFAULT 0 |
| is_studying | BOOLEAN | 是否学习中 | DEFAULT false |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

### chat_messages (聊天记录表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| friend_id | TEXT | 好友ID | NOT NULL |
| sender | TEXT | 发送者 | CHECK (user/friend/bot) |
| text | TEXT | 消息内容 | NOT NULL |
| created_at | TIMESTAMPTZ | 发送时间 | DEFAULT NOW() |

### unread_counts (未读计数表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → users(id) |
| friend_id | TEXT | 好友ID | NOT NULL |
| unread_count | INTEGER | 未读数量 | DEFAULT 0 |
| last_message | TEXT | 最后消息 | - |
| last_message_time | TIMESTAMPTZ | 最后消息时间 | - |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |
| - | - | - | UNIQUE(user_id, friend_id) |

### notifications (通知表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → users(id) |
| type | TEXT | 通知类型 | CHECK (message/system/friend_request/study/achievement) |
| title | TEXT | 标题 | NOT NULL |
| content | TEXT | 内容 | NOT NULL |
| avatar_url | TEXT | 头像URL | - |
| is_read | BOOLEAN | 是否已读 | DEFAULT false |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

### mails (邮件表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → users(id) |
| from_name | TEXT | 发件人 | NOT NULL |
| from_avatar | TEXT | 发件人头像 | - |
| subject | TEXT | 主题 | NOT NULL |
| preview | TEXT | 预览 | NOT NULL |
| content | TEXT | 内容 | - |
| is_read | BOOLEAN | 是否已读 | DEFAULT false |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

### study_sessions (学习记录表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → users(id) |
| subject | TEXT | 学习科目 | - |
| duration | INTEGER | 时长（分钟） | NOT NULL |
| started_at | TIMESTAMPTZ | 开始时间 | NOT NULL |
| ended_at | TIMESTAMPTZ | 结束时间 | - |
| notes | TEXT | 笔记 | - |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

### study_rooms (自习室表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| name | TEXT | 房间名称 | NOT NULL |
| description | TEXT | 描述 | - |
| capacity | INTEGER | 容量 | DEFAULT 10 |
| current_members | INTEGER | 当前人数 | DEFAULT 0 |
| is_public | BOOLEAN | 是否公开 | DEFAULT true |
| created_by | UUID | 创建者 | FK → users(id) |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

### study_room_members (自习室成员表)
| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| room_id | UUID | 房间ID | FK → study_rooms(id) |
| user_id | UUID | 用户ID | FK → users(id) |
| friend_id | TEXT | 好友ID | - |
| is_active | BOOLEAN | 是否活跃 | DEFAULT true |
| joined_at | TIMESTAMPTZ | 加入时间 | DEFAULT NOW() |
| - | - | - | UNIQUE(room_id, user_id) |
| - | - | - | UNIQUE(room_id, friend_id) |

---

## 🔍 索引列表

### friends 表
- `idx_friends_user_id` → user_id
- `idx_friends_friend_id` → friend_id
- `idx_friends_status` → status

### chat_messages 表
- `idx_chat_messages_friend_id` → friend_id
- `idx_chat_messages_created_at` → created_at

### unread_counts 表
- `idx_unread_counts_user_id` → user_id
- `idx_unread_counts_friend_id` → friend_id

### notifications 表
- `idx_notifications_user_id` → user_id
- `idx_notifications_is_read` → is_read
- `idx_notifications_created_at` → created_at

### mails 表
- `idx_mails_user_id` → user_id
- `idx_mails_is_read` → is_read
- `idx_mails_created_at` → created_at

### study_sessions 表
- `idx_study_sessions_user_id` → user_id
- `idx_study_sessions_started_at` → started_at

### study_rooms 表
- `idx_study_rooms_is_public` → is_public
- `idx_study_rooms_created_by` → created_by

### study_room_members 表
- `idx_study_room_members_room_id` → room_id
- `idx_study_room_members_user_id` → user_id
- `idx_study_room_members_is_active` → is_active

---

## 📝 数据流

### 发送消息流程

```
用户发送消息
    ↓
调用 send_message('alice', 'user', '你好')
    ↓
1. INSERT INTO chat_messages
    ↓
2. UPDATE unread_counts
   (只更新 last_message，不增加 unread_count)
    ↓
返回消息 ID
```

### 接收消息流程

```
好友发送消息
    ↓
调用 send_message('alice', 'friend', '你好吗')
    ↓
1. INSERT INTO chat_messages
    ↓
2. UPDATE unread_counts
   (unread_count + 1，更新 last_message)
    ↓
返回消息 ID
```

### 查看消息流程

```
用户打开聊天
    ↓
调用 mark_messages_as_read(user_id, 'alice')
    ↓
UPDATE unread_counts SET unread_count = 0
    ↓
未读计数清零
```

---

**数据库版本**: v1.0  
**PostgreSQL 版本**: 15+  
**最后更新**: 2026-02-05

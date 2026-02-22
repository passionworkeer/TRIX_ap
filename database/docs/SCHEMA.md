# 🏗️ TRIX 数据库架构文档

> **版本**: v1.2.0
> **最后更新**: 2026-02-22
> **数据库**: PostgreSQL 15+ (Supabase)

---

## 📊 表关系概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         profiles                                 │
│  (用户配置表 - Supabase Auth 自动创建)                           │
│  - id (PK, UUID)                                                 │
│  - email, username, display_name, avatar_url, bio               │
│  - is_studying, companion_id, total_study_time, points          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    friends    │   │ chat_messages │   │user_settings  │
│  (好友关系)   │   │  (聊天消息)   │   │ (用户设置)    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │
        │                   ▼
        │           ┌───────────────┐
        │           │unread_counts  │
        │           │ (未读计数)    │
        │           └───────────────┘
        │
        ├───────────────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│notifications  │   │    mails      │
│  (通知表)     │   │  (邮件表)     │
└───────────────┘   └───────────────┘

┌───────────────┐   ┌───────────────┐
│study_sessions │   │ study_rooms   │
│ (学习记录)    │   │  (自习室)     │
└───────────────┘   └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │study_room_    │
                    │  members      │
                    └───────────────┘

┌───────────────┐   ┌───────────────┐
│ pairing_      │   │ user_points   │
│  requests     │   │  (积分表)     │
└───────────────┘   └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │point_         │
                    │ transactions  │
                    └───────────────┘
```

---

## 📋 核心表结构

### 1. profiles (用户配置表)

> 由 Supabase Auth 自动创建，扩展字段通过迁移添加

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| email | TEXT | 邮箱 | UNIQUE, NOT NULL |
| username | TEXT | 用户名 | - |
| display_name | TEXT | 显示名称 | - |
| avatar_url | TEXT | 头像URL | - |
| bio | TEXT | 个人简介 | - |
| **is_studying** | BOOLEAN | 是否学习中 | DEFAULT false |
| **companion_id** | UUID | 伴侣用户ID | FK → profiles(id) |
| **total_study_time** | INTEGER | 累计学习时长(分钟) | DEFAULT 0 |
| **points** | INTEGER | 积分(向后兼容) | DEFAULT 0 |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

---

### 2. friends (好友关系表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → profiles(id), NOT NULL |
| friend_id | UUID | 好友用户ID | FK → profiles(id), NOT NULL |
| status | TEXT | 关系状态 | DEFAULT 'accepted' |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**索引**:
- `friends_user_id_friend_id_key` - UNIQUE(user_id, friend_id)
- `idx_friends_user_id` - user_id
- `idx_friends_friend_id` - friend_id

---

### 3. chat_messages (聊天消息表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| conversation_id | TEXT | 会话ID | NOT NULL |
| sender_id | UUID | 发送者ID | FK → profiles(id), NOT NULL |
| receiver_id | UUID | 接收者ID | FK → profiles(id), NOT NULL |
| content | TEXT | 消息内容 | - |
| message_type | TEXT | 消息类型 | DEFAULT 'text' |
| media_uri | TEXT | 媒体文件URI | - |
| media_type | TEXT | 媒体类型 | - |
| media_size | BIGINT | 媒体文件大小 | - |
| media_metadata | JSONB | 媒体元数据 | - |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**消息类型**: `text`, `image`, `audio`, `video`, `file`

**索引**:
- `idx_chat_messages_conversation_id` - conversation_id
- `idx_chat_messages_sender_id` - sender_id
- `idx_chat_messages_message_type` - message_type
- `idx_chat_messages_media_uri` - media_uri (WHERE media_uri IS NOT NULL)
- `idx_chat_messages_conversation_media` - (conversation_id, message_type)

---

### 4. unread_counts (未读计数表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| user_id | UUID | 用户ID | PK, FK → profiles(id) |
| unread_mail_count | INTEGER | 未读邮件数 | DEFAULT 0 |
| unread_notification_count | INTEGER | 未读通知数 | DEFAULT 0 |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

---

### 5. notifications (通知表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| recipient_id | UUID | 接收者ID | FK → profiles(id), NOT NULL |
| content | TEXT | 通知内容 | NOT NULL |
| is_read | BOOLEAN | 是否已读 | DEFAULT false |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**索引**:
- `idx_notifications_recipient_id` - recipient_id
- `idx_notifications_is_read` - is_read (WHERE is_read = false)

---

### 6. mails (邮件表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| recipient_id | UUID | 接收者ID | FK → profiles(id), NOT NULL |
| sender_id | UUID | 发送者ID | FK → profiles(id) |
| subject | TEXT | 主题 | NOT NULL |
| content | TEXT | 内容 | NOT NULL |
| is_read | BOOLEAN | 是否已读 | DEFAULT false |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**索引**:
- `idx_mails_recipient_id` - recipient_id
- `idx_mails_is_read` - is_read (WHERE is_read = false)

---

### 7. study_sessions (学习记录表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → profiles(id), NOT NULL |
| duration_minutes | INTEGER | 时长(分钟) | NOT NULL |
| started_at | TIMESTAMPTZ | 开始时间 | - |
| completed_at | TIMESTAMPTZ | 结束时间 | - |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**索引**:
- `idx_study_sessions_user_id` - user_id

---

### 8. study_rooms (自习室表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| name | TEXT | 房间名称 | NOT NULL |
| description | TEXT | 描述 | - |
| max_members | INTEGER | 最大成员数 | DEFAULT 10 |
| created_by | UUID | 创建者ID | FK → profiles(id), NOT NULL |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**索引**:
- `idx_study_rooms_created_by` - created_by

---

### 9. study_room_members (自习室成员表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| room_id | UUID | 房间ID | FK → study_rooms(id), NOT NULL |
| user_id | UUID | 用户ID | FK → profiles(id), NOT NULL |
| joined_at | TIMESTAMPTZ | 加入时间 | DEFAULT NOW() |

**索引**:
- `study_room_members_room_user` - UNIQUE(room_id, user_id)

---

## 📦 扩展表

### 10. pairing_requests (配对请求表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | TEXT | 主键(配对码) | PRIMARY KEY |
| device_id | TEXT | 设备ID | NOT NULL |
| device_name | TEXT | 设备名称 | NOT NULL |
| device_type | TEXT | 设备类型 | NOT NULL |
| status | TEXT | 状态 | DEFAULT 'pending' |
| device_token | TEXT | 设备Token | - |
| approved_at | TIMESTAMPTZ | 批准时间 | - |
| approved_by | TEXT | 批准者 | - |
| cancelled_at | TIMESTAMPTZ | 取消时间 | - |
| platform | JSONB | 平台信息 | - |
| user_agent | TEXT | 用户代理 | - |
| message | TEXT | 消息 | - |
| expires_at | TIMESTAMPTZ | 过期时间 | DEFAULT NOW() + 10min |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

---

### 11. user_points (用户积分表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | UNIQUE, FK → profiles(id), NOT NULL |
| total_points | INTEGER | 总积分 | DEFAULT 0 |
| level | INTEGER | 等级 | DEFAULT 1 |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

**等级规则**:
- Level 1: 0-99 积分
- Level 2: 100-499 积分
- Level 3: 500-1499 积分
- Level 4: 1500-2999 积分
- Level 5: 3000-4999 积分
- Level 6+: 每 2000 积分升一级

---

### 12. point_transactions (积分交易记录表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | FK → profiles(id), NOT NULL |
| points_change | INTEGER | 积分变化 | NOT NULL |
| transaction_type | TEXT | 交易类型 | CHECK (枚举值) |
| description | TEXT | 描述 | - |
| metadata | JSONB | 元数据 | - |
| balance_after | INTEGER | 交易后余额 | NOT NULL |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |

**交易类型**:
- `study_complete` - 完成学习
- `study_streak` - 连续学习
- `daily_login` - 每日登录
- `achievement` - 成就奖励
- `social_share` - 社交分享
- `redeem` - 积分兑换
- `admin_adjust` - 管理员调整

---

### 13. user_settings (用户设置表)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | PRIMARY KEY |
| user_id | UUID | 用户ID | UNIQUE, FK → profiles(id), NOT NULL |
| allow_stranger_search | BOOLEAN | 允许陌生人搜索 | DEFAULT true |
| show_online_status | BOOLEAN | 显示在线状态 | DEFAULT true |
| allow_study_invites | BOOLEAN | 允许学习邀请 | DEFAULT true |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT NOW() |

---

## 🔗 视图

### 1. users (用户视图)

```sql
SELECT id, email, username, COALESCE(display_name, username) AS display_name,
       avatar_url, bio, created_at, updated_at
FROM profiles;
```

### 2. friend_latest_messages (好友最新消息视图)

```sql
SELECT DISTINCT ON (user_id, friend_id)
    user_id, friend_id, content, created_at
FROM chat_messages
ORDER BY user_id, friend_id, created_at DESC;
```

### 3. user_points_overview (积分排行榜视图)

```sql
SELECT p.id, p.username, up.total_points, up.level,
       RANK() OVER (ORDER BY up.total_points DESC) as rank
FROM profiles p
JOIN user_points up ON p.id = up.user_id
ORDER BY up.total_points DESC;
```

---

## ⚙️ 存储函数

### calculate_user_level(total_points)

计算用户等级。

```sql
SELECT calculate_user_level(1500);  -- 返回 3
```

### add_user_points(user_id, points, type, description)

添加积分并记录交易。

```sql
SELECT add_user_points(
    'user-uuid',
    50,
    'study_complete',
    '完成25分钟学习'
);
```

### get_user_points_stats(user_id)

获取用户积分统计。

```sql
SELECT * FROM get_user_points_stats('user-uuid');
-- 返回: total_points, level, next_level_points, points_to_next_level, total_transactions
```

### cleanup_expired_pairing_requests()

清理过期的配对请求。

```sql
SELECT cleanup_expired_pairing_requests();
```

---

## 🔒 RLS 策略 (行级安全)

### user_settings 表

```sql
-- 用户只能查看自己的设置
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

-- 用户只能插入自己的设置
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的设置
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);
```

---

## 📊 统计

| 类别 | 数量 |
|------|------|
| 核心表 | 9 |
| 扩展表 | 4 |
| 视图 | 3 |
| 存储函数 | 4 |
| RLS 策略 | 3 |

---

**文档版本**: v1.2.0
**SQL 脚本**: `database/INIT_ALL.sql`
**最后更新**: 2026-02-22

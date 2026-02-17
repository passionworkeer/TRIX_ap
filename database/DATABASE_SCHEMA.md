# TRIX 3D Companion - 数据库架构文档

**最后更新**: 2026-02-17 10:30:00 UTC+8
**版本**: v1.2.0
**维护者**: TRIX Studio

---

## 📊 数据库概览

本项目的数据库使用 **Supabase PostgreSQL**，采用 Supabase Auth 进行用户认证。

### 技术栈
- **数据库**: PostgreSQL 15.x
- **认证**: Supabase Auth
- **ORM**: 原生 SQL
- **部署**: Supabase Cloud

---

## 🗄️ 表结构详解

### 1. 核心用户表

#### 1.1 profiles（用户配置文件）
**用途**: 存储用户的核心信息和配置

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | - | 用户唯一标识（Supabase Auth UID） |
| username | TEXT | YES | - | 用户名 |
| email | TEXT | YES | - | 邮箱 |
| avatar_url | TEXT | YES | - | 头像URL |
| full_name | TEXT | YES | - | 全名 |
| display_name | TEXT | YES | - | 显示名称 |
| bio | TEXT | YES | - | 个人简介 |
| points | INTEGER | YES | 0 | 积分（已弃用，请使用user_points表） |
| website | TEXT | YES | - | 个人网站 |
| avatar_config | JSONB | YES | - | 头像配置 |
| is_studying | BOOLEAN | YES | false | 是否正在自习 |
| companion_id | UUID | YES | - | 自习伙伴ID（外键→profiles.id） |
| total_study_time | INTEGER | YES | 0 | 累计学习时长（分钟） |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |
| updated_at | TIMESTAMPTZ | YES | now() | 更新时间 |

**索引**:
- `profiles_pkey` (主键)
- `idx_profiles_is_studying` (部分索引，is_studying=true)
- `idx_profiles_companion_id`
- `idx_profiles_total_study_time` (部分索引，>0)

**关系**:
- 自引用: `companion_id` → `profiles.id` (自习伙伴)

#### 1.2 users（用户视图）
**用途**: profiles表的简化视图，用于向后兼容

```sql
CREATE VIEW users AS
  SELECT id, email, username,
         COALESCE(display_name, username) AS display_name,
         avatar_url, bio, created_at, updated_at
  FROM profiles;
```

---

### 2. 社交功能表

#### 2.1 friends（好友关系）
**用途**: 存储用户之间的好友关系（双向存储）

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| friend_id | UUID | NO | - | 好友ID（外键→profiles.id） |
| status | TEXT | NO | 'accepted' | 好友状态 |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**索引**:
- `friends_pkey` (主键)
- `idx_friends_user_id`
- `idx_friends_friend_id`
- `friends_user_id_friend_id_key` (唯一约束，user_id + friend_id)

**关系**:
- `user_id` → `profiles.id`
- `friend_id` → `profiles.id`

**当前数据**: 8条记录

#### 2.2 chat_messages（聊天消息）
**用途**: 存储好友之间的聊天消息

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| conversation_id | TEXT | NO | - | 会话ID（由user_id+friend_id组成） |
| sender_id | UUID | NO | - | 发送者ID（外键→profiles.id） |
| receiver_id | UUID | NO | - | 接收者ID（外键→profiles.id） |
| content | TEXT | YES | - | 消息内容 |
| message_type | TEXT | NO | 'text' | 消息类型：text, image, video, mixed |
| media_uri | TEXT | YES | - | 媒体文件URL |
| media_type | TEXT | YES | - | MIME类型 |
| media_size | BIGINT | YES | - | 文件大小（字节） |
| media_metadata | JSONB | YES | - | 媒体元数据 |
| created_at | TIMESTAMPTZ | YES | now() | 发送时间 |

**索引**:
- `chat_messages_pkey` (主键)
- `idx_chat_messages_conversation_id`
- `idx_chat_messages_sender_id`
- `idx_chat_messages_message_type`
- `idx_chat_messages_media_uri`
- `idx_chat_messages_conversation_media`

**关系**:
- `sender_id` → `profiles.id`
- `receiver_id` → `profiles.id`

**当前数据**: 79条记录

---

### 3. 设置相关表（新建于 2026-02-17）

#### 3.1 user_settings（用户隐私设置）
**用途**: 存储用户的隐私和安全设置

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| allow_stranger_search | BOOLEAN | YES | true | 允许陌生人通过邮箱/用户名查找 |
| show_online_status | BOOLEAN | YES | true | 显示在线状态 |
| allow_study_invites | BOOLEAN | YES | true | 允许好友邀请自习 |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |
| updated_at | TIMESTAMPTZ | YES | now() | 更新时间 |

**索引**:
- `user_settings_pkey` (主键)
- `idx_user_settings_user_id` (唯一)

**触发器**:
- `update_user_settings_updated_at` - 自动更新updated_at字段

**RLS 策略**:
- 用户只能查看自己的设置
- 用户只能插入自己的设置
- 用户只能更新自己的设置

**当前数据**: 7条记录 (100%用户覆盖)

#### 3.2 user_points（用户积分）
**用途**: 存储用户的积分和等级信息

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| total_points | INTEGER | NO | 0 | 总积分 |
| level | INTEGER | NO | 1 | 等级（1-10） |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |
| updated_at | TIMESTAMPTZ | YES | now() | 更新时间 |

**索引**:
- `user_points_pkey` (主键)
- `idx_user_points_user_id` (唯一)
- `idx_user_points_total_points` (DESC)
- `idx_user_points_level`

**触发器**:
- `update_user_points_updated_at` - 自动更新updated_at字段
- `calculate_user_level` - 根据积分自动计算等级

**当前数据**: 7条记录 (100%用户覆盖)

**等级规则**:
```
Level 1: 0-99 分
Level 2: 100-499 分
Level 3: 500-1499 分
Level 4: 1500-2999 分
Level 5: 3000-4999 分
Level 6-10: 每2000分升一级
```

#### 3.3 point_transactions（积分交易记录）
**用途**: 记录所有积分变动历史

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| points_change | INTEGER | NO | - | 积分变化（正数=获得，负数=消费） |
| transaction_type | TEXT | NO | - | 交易类型 |
| description | TEXT | YES | - | 交易描述 |
| metadata | JSONB | YES | - | 额外元数据 |
| balance_after | INTEGER | NO | - | 交易后的余额 |
| created_at | TIMESTAMPTZ | YES | now() | 交易时间 |

**交易类型**:
- `study_complete` - 完成专注学习
- `study_streak` - 连续学习奖励
- `daily_login` - 每日登录
- `achievement` - 成就解锁
- `social_share` - 社交分享
- `redeem` - 兑换奖励
- `admin_adjust` - 管理员调整

**索引**:
- `point_transactions_pkey` (主键)
- `idx_point_transactions_user_id`
- `idx_point_transactions_type`
- `idx_point_transactions_created_at` (DESC)

**函数**:
- `add_user_points(user_id, points, type, description)` - 添加积分并记录交易
- `get_user_points_stats(user_id)` - 获取积分统计

---

### 4. 学习功能表

#### 4.1 study_sessions（学习记录）
**用途**: 记录用户的专注学习会话

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| duration_minutes | INTEGER | NO | - | 专注时长（分钟） |
| started_at | TIMESTAMPTZ | YES | - | 开始时间 |
| completed_at | TIMESTAMPTZ | YES | - | 完成时间 |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**当前数据**: 5条记录

#### 4.2 study_rooms（自习室）
**用途**: 自习室信息

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| name | TEXT | NO | - | 自习室名称 |
| description | TEXT | YES | - | 描述 |
| max_members | INTEGER | NO | 10 | 最大成员数 |
| created_by | UUID | NO | - | 创建者ID（外键→profiles.id） |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**当前数据**: 4条记录

#### 4.3 study_room_members（自习室成员）
**用途**: 自习室成员关系

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| room_id | UUID | NO | - | 自习室ID（外键→study_rooms.id） |
| user_id | UUID | NO | - | 用户ID（外键→profiles.id） |
| joined_at | TIMESTAMPTZ | YES | now() | 加入时间 |

**当前数据**: 5条记录

---

### 5. 通知系统表

#### 5.1 notifications（通知）
**用途**: 存储系统通知

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| recipient_id | UUID | NO | - | 接收者ID（外键→profiles.id） |
| content | TEXT | NO | - | 通知内容 |
| is_read | BOOLEAN | NO | false | 是否已读 |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**当前数据**: 5条记录

#### 5.2 mails（邮件）
**用途**: 应用内邮件系统

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | NO | gen_random_uuid() | 主键 |
| recipient_id | UUID | NO | - | 接收者ID（外键→profiles.id） |
| sender_id | UUID | YES | - | 发送者ID（外键→profiles.id） |
| subject | TEXT | NO | - | 邮件主题 |
| content | TEXT | NO | - | 邮件内容 |
| is_read | BOOLEAN | NO | false | 是否已读 |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**当前数据**: 4条记录

#### 5.3 unread_counts（未读计数）
**用途**: 存储用户的未读消息计数

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| user_id | UUID | NO | - | 用户ID（主键，外键→profiles.id） |
| unread_mail_count | INTEGER | NO | 0 | 未读邮件数 |
| unread_notification_count | INTEGER | NO | 0 | 未读通知数 |
| updated_at | TIMESTAMPTZ | YES | now() | 更新时间 |

**当前数据**: 8条记录

---

### 6. 其他功能表

#### 6.1 pairing_requests（配对请求）
**用途**: Clawbot 手机端配对请求管理

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | NO | - | 请求ID（主键） |
| device_id | TEXT | NO | - | 设备ID |
| device_name | TEXT | NO | - | 设备名称 |
| device_type | TEXT | NO | - | 设备类型 |
| status | TEXT | NO | 'pending' | 状态：pending, approved, rejected, cancelled |
| device_token | TEXT | YES | - | 审批后的设备令牌 |
| approved_at | TIMESTAMPTZ | YES | - | 审批时间 |
| approved_by | TEXT | YES | - | 审批者 |
| cancelled_at | TIMESTAMPTZ | YES | - | 取消时间 |
| platform | JSONB | YES | - | 平台信息 |
| user_agent | TEXT | YES | - | 用户代理 |
| message | TEXT | YES | - | 拒绝/错误信息 |
| expires_at | TIMESTAMPTZ | YES | - | 过期时间（默认10分钟） |
| created_at | TIMESTAMPTZ | YES | now() | 创建时间 |

**触发器**:
- `update_pairing_requests_updated_at` - 自动更新时间戳
- `cleanup_expired_pairing_requests()` - 清理过期请求

**当前数据**: 15条记录

#### 6.2 friend_latest_messages（视图）
**用途**: 好友最新消息视图

```sql
CREATE VIEW friend_latest_messages AS
SELECT DISTINCT ON (user_id, friend_id)
    user_id,
    friend_id,
    content,
    created_at
FROM chat_messages
ORDER BY user_id, friend_id, created_at DESC;
```

---

## 🔗 完整关系图

```
profiles (用户核心表)
│
├─→ user_settings (1:1) ✨
├─→ user_points (1:1) ✨
├─→ point_transactions (1:N) ✨
├─→ friends (1:N 双向)
├─→ chat_messages (1:N)
├─→ unread_counts (1:1)
├─→ notifications (1:N)
├─→ mails (1:N)
├─→ study_sessions (1:N)
├─→ study_rooms (1:N 创建者)
├─→ pairing_requests (独立)
│
└─→ companion_id → profiles.id (自引用)
```

---

## 📈 数据统计

**最后统计**: 2026-02-17 10:30 UTC+8

| 表名 | 记录数 | 说明 |
|------|--------|------|
| profiles | 7 | 用户数量 |
| user_settings | 7 | 100%覆盖 ✅ |
| user_points | 7 | 100%覆盖 ✅ |
| friends | 8 | 好友关系 |
| chat_messages | 79 | 聊天消息 |
| study_sessions | 5 | 学习记录 |
| study_rooms | 4 | 自习室 |
| study_room_members | 5 | 自习室成员 |
| notifications | 5 | 通知 |
| mails | 4 | 邮件 |
| unread_counts | 8 | 未读计数 |
| pairing_requests | 15 | 配对请求 |

**用户列表**:
1. admin (Level 1, 0积分)
2. alice (Level 1, 0积分)
3. bob (Level 1, 0积分)
4. carol (Level 1, 0积分)
5. david (Level 1, 0积分)
6. emma (Level 1, 0积分)
7. xiaoming (Level 1, 0积分)

---

## 🛠️ 数据库函数

### 积分相关

#### add_user_points()
添加积分并记录交易

```sql
SELECT add_user_points(
  user_id := 'uuid',
  points := 100,
  type := 'study_complete',
  description := '完成专注学习25分钟'
);
```

#### calculate_user_level()
根据积分自动计算等级

```sql
SELECT calculate_user_level(total_points := 1500);
-- 返回: 3
```

#### get_user_points_stats()
获取用户积分统计

```sql
SELECT * FROM get_user_points_stats('user_uuid');
```

---

## 🔍 常用查询示例

### 查询用户完整信息

```sql
SELECT
  p.id,
  p.username,
  p.email,
  up.total_points,
  up.level,
  us.allow_stranger_search,
  us.show_online_status,
  COUNT(DISTINCT fr.friend_id) as friends_count
FROM profiles p
LEFT JOIN user_points up ON p.id = up.user_id
LEFT JOIN user_settings us ON p.id = us.user_id
LEFT JOIN friends fr ON p.id = fr.user_id
GROUP BY p.id, p.username, p.email, up.total_points, up.level,
         us.allow_stranger_search, us.show_online_status;
```

### 查询用户积分历史

```sql
SELECT
  pt.transaction_type,
  pt.points_change,
  pt.description,
  pt.balance_after,
  pt.created_at
FROM point_transactions pt
WHERE pt.user_id = 'user_uuid'
ORDER BY pt.created_at DESC
LIMIT 20;
```

### 查询正在自习的用户

```sql
SELECT
  p.username,
  p.is_studying,
  sr.name as room_name
FROM profiles p
LEFT JOIN study_room_members srm ON p.id = srm.user_id
LEFT JOIN study_rooms sr ON srm.room_id = sr.id
WHERE p.is_studying = true;
```

### 查询好友列表

```sql
SELECT
  fr.id,
  p.username,
  p.avatar_url,
  p.display_name,
  cm.content as last_message,
  cm.created_at as last_message_time
FROM friends fr
JOIN profiles p ON fr.friend_id = p.id
LEFT JOIN chat_messages cm ON (
  cm.conversation_id = fr.user_id || '-' || fr.friend_id
  OR cm.conversation_id = fr.friend_id || '-' || fr.user_id
)
ORDER BY cm.created_at DESC NULLS LAST;
```

---

## 📝 数据迁移历史

| 日期 | 文件 | 说明 |
|------|------|------|
| - | src/database/complete-init.sql | 初始化核心表 |
| 2026-02-11 | database/add-is-studying-to-profiles.sql | 添加is_studying字段 |
| 2026-02-11 | database/add-companion-to-profiles.sql | 添加companion_id字段 |
| 2026-02-11 | database/add-study-time-to-profiles.sql | 添加total_study_time字段 |
| 2026-02-12 | database/add-media-support-to-chat-messages.sql | 添加多媒体支持 |
| 2026-02-13 | database/add-pairing-requests-table.sql | 创建配对请求表 |
| 2026-02-16 | database/add-points-system.sql | 创建积分系统 |
| 2026-02-17 | database/add-user-settings.sql | 创建用户设置表 ✨ |

---

## 🔧 维护建议

### 定期检查

```sql
-- 1. 检查孤儿记录
SELECT 'user_settings' as table_name, COUNT(*) FROM user_settings us
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = us.user_id)
UNION ALL
SELECT 'user_points' as table_name, COUNT(*) FROM user_points up
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = up.user_id);

-- 2. 检查覆盖率
SELECT
  COUNT(*) as total_users,
  COUNT(us.user_id) as with_settings,
  COUNT(up.user_id) as with_points,
  ROUND(COUNT(us.user_id)::NUMERIC / COUNT(*) * 100, 2) as settings_coverage,
  ROUND(COUNT(up.user_id)::NUMERIC / COUNT(*) * 100, 2) as points_coverage
FROM profiles p
LEFT JOIN user_settings us ON p.id = us.user_id
LEFT JOIN user_points up ON p.id = up.user_id;

-- 3. 清理过期配对请求
DELETE FROM pairing_requests
WHERE status = 'pending'
AND expires_at < NOW();
```

---

## 🚀 性能优化建议

### 已实现的索引
- ✅ 所有关键字段都有索引
- ✅ 外键字段都有索引
- ✅ 频繁查询的字段有索引

### 可选优化
- [ ] 添加分区（当数据量>100万时）
- [ ] 添加全文搜索（聊天消息）
- [ ] 添加缓存层（Redis）

---

## 📞 联系方式

**数据库问题**: 联系后端团队
**功能建议**: 联系产品团队
**文档更新**: 修改本文档并更新日期

---

**文档版本**: v1.0
**最后更新**: 2026-02-17 10:30:00 UTC+8

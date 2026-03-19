# Supabase 数据库迁移指南

> 执行日期: 2026-03-19
> 目的: 修复数据库 RLS 安全问题

---

## ⚠️ 执行前备份

**重要**: 执行迁移前请确保已备份数据库。

```sql
-- 在 Supabase Dashboard > SQL Editor 中执行备份
-- 或使用 pg_dump 进行完整备份
```

---

## 📋 迁移清单

按顺序执行以下 3 个迁移文件：

### ✅ 迁移 1/3: 用户会话管理

**文件**: `database/migrations/001_add_user_sessions.sql`

**内容**:
- 创建 `user_sessions` 表 (单设备登录管理)
- 为 `profiles` 表添加 `active_session_id` 列
- 启用 RLS 并创建会话访问策略

**执行语句**:
```sql
-- ============================================
-- Migration: Per-Platform Single Session Management
-- 重要：分两步走，避免循环外键依赖
-- ============================================

-- 第一步：创建 user_sessions 表，暂不加 user_id 外键约束
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios')),
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE is_active = true;

-- 第二步：给 profiles 加 active_session_id 列
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_profiles_active_session ON profiles(active_session_id) WHERE active_session_id IS NOT NULL;

-- 为 user_sessions.user_id 补上外键
ALTER TABLE user_sessions
  ADD CONSTRAINT fk_user_sessions_user_id
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- RLS 策略
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sessions_select_own" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_sessions_insert_own" ON user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_sessions_update_own" ON user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_sessions_delete_own" ON user_sessions FOR DELETE USING (auth.uid() = user_id);

-- 过期清理函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  UPDATE user_sessions SET is_active = false WHERE is_active = true AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

**验证**:
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_sessions';
-- 期望结果: rowsecurity = true
```

---

### ✅ 迁移 2/3: profiles 表 RLS

**文件**: `database/migrations/002_security_profiles_rls.sql`

**内容**:
- 为 `profiles` 表启用 RLS
- 添加 SELECT/UPDATE 策略防止会话劫持
- 增强 `user_sessions` UPDATE 策略的 WITH CHECK

**执行语句**:
```sql
-- ============================================
-- Migration: Security Fixes for Session Management
-- P0 Critical: Add RLS to profiles table
-- ============================================

-- P0: profiles 表 RLS 策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

-- P1: user_sessions UPDATE 策略加 WITH CHECK
DROP POLICY IF EXISTS "user_sessions_update_own" ON user_sessions;

CREATE POLICY "user_sessions_update_own" ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- P1: user_sessions DELETE 策略
DROP POLICY IF EXISTS "user_sessions_delete_own" ON user_sessions;

CREATE POLICY "user_sessions_delete_own" ON user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 清理函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE is_active = true
    AND expires_at < NOW()
    AND auth.uid() = user_id;
END;
$$;
```

**验证**:
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';
-- 期望结果: rowsecurity = true
```

---

### ✅ 迁移 3/3: 所有敏感表 RLS (新增)

**文件**: `database/migrations/003_enable_rls_all_sensitive_tables.sql`

**内容**:
- 为 14 个用户数据表启用 RLS
- 为 4 个参考表启用只读策略
- 所有敏感表使用 `WITH CHECK` 防止跨用户攻击

**执行语句**:
```sql
-- ============================================
-- Migration: Enable RLS for All Sensitive Tables
-- P0 Security Fix
-- ============================================

-- Section 1: Friends & Social
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friends_select_own" ON friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friends_insert_own" ON friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "friends_update_own" ON friends FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friends_delete_own" ON friends FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friend_requests_select_own" ON friend_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "friend_requests_insert_own" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "friend_requests_update_own" ON friend_requests FOR UPDATE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "friend_requests_delete_own" ON friend_requests FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Section 2: Chat & Messaging
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own" ON chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "chat_messages_insert_own" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "chat_messages_update_own" ON chat_messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id) WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "chat_messages_delete_own" ON chat_messages FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "unread_counts_select_own" ON unread_counts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "unread_counts_insert_own" ON unread_counts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "unread_counts_update_own" ON unread_counts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "unread_counts_delete_own" ON unread_counts FOR DELETE USING (auth.uid() = user_id);

-- Section 3: Notifications & Mails
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "mails_select_own" ON mails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mails_insert_own" ON mails FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mails_update_own" ON mails FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mails_delete_own" ON mails FOR DELETE USING (auth.uid() = user_id);

-- Section 4: Study Sessions & Rooms
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_sessions_select_own" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "study_sessions_insert_own" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_sessions_update_own" ON study_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_sessions_delete_own" ON study_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "study_rooms_select_all" ON study_rooms FOR SELECT USING (true);
CREATE POLICY "study_rooms_insert_own" ON study_rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "study_rooms_update_own" ON study_rooms FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "study_rooms_delete_own" ON study_rooms FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "study_room_members_select_own" ON study_room_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "study_room_members_insert_own" ON study_room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_room_members_update_own" ON study_room_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "study_room_members_delete_own" ON study_room_members FOR DELETE USING (auth.uid() = user_id);

-- Section 5: Points & Transactions
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points_select_own" ON user_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_points_insert_own" ON user_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_points_update_own" ON user_points FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_points_delete_own" ON user_points FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "point_transactions_select_own" ON point_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "point_transactions_insert_own" ON point_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "point_transactions_update_own" ON point_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "point_transactions_delete_own" ON point_transactions FOR DELETE USING (auth.uid() = user_id);

-- Section 6: Achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_select_own" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_achievements_insert_own" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_achievements_update_own" ON user_achievements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_achievements_delete_own" ON user_achievements FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "achievements_select_all" ON achievements FOR SELECT USING (true);

-- Section 7: Mall & Purchases
ALTER TABLE mall_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchased_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mall_items_select_all" ON mall_items FOR SELECT USING (true);

CREATE POLICY "user_purchased_items_select_own" ON user_purchased_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_purchased_items_insert_own" ON user_purchased_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_purchased_items_update_own" ON user_purchased_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_purchased_items_delete_own" ON user_purchased_items FOR DELETE USING (auth.uid() = user_id);

-- Section 8: Outfits
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outfits_select_all" ON outfits FOR SELECT USING (true);

CREATE POLICY "user_outfits_select_own" ON user_outfits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_outfits_insert_own" ON user_outfits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_outfits_update_own" ON user_outfits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_outfits_delete_own" ON user_outfits FOR DELETE USING (auth.uid() = user_id);

-- Section 9: Todos & Schedules
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select_own" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "todos_insert_own" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_update_own" ON todos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_delete_own" ON todos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "schedules_select_own" ON schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedules_insert_own" ON schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedules_update_own" ON schedules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedules_delete_own" ON schedules FOR DELETE USING (auth.uid() = user_id);

-- Section 10: User Settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_delete_own" ON user_settings FOR DELETE USING (auth.uid() = user_id);
```

**验证**:
```sql
-- 检查所有表 RLS 状态
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## 🔍 验证检查清单

执行完成后，运行以下查询确认所有 RLS 已启用：

```sql
-- 期望结果: 所有表 rowsecurity = true
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns', 'raster_columns', 'raster_overviews')
ORDER BY tablename;
```

---

## 📊 RLS 覆盖表清单

| 表名 | RLS 状态 | 策略类型 |
|------|----------|----------|
| `profiles` | ✅ | 用户私有 |
| `user_sessions` | ✅ | 用户私有 |
| `friends` | ✅ | 关系双方 |
| `friend_requests` | ✅ | 关系双方 |
| `chat_messages` | ✅ | 消息双方 |
| `unread_counts` | ✅ | 用户私有 |
| `notifications` | ✅ | 用户私有 |
| `mails` | ✅ | 用户私有 |
| `study_sessions` | ✅ | 用户私有 |
| `study_rooms` | ✅ | 公开只读 |
| `study_room_members` | ✅ | 用户私有 |
| `user_points` | ✅ | 用户私有 |
| `point_transactions` | ✅ | 用户私有 |
| `achievements` | ✅ | 公开只读 |
| `user_achievements` | ✅ | 用户私有 |
| `mall_items` | ✅ | 公开只读 |
| `user_purchased_items` | ✅ | 用户私有 |
| `outfits` | ✅ | 公开只读 |
| `user_outfits` | ✅ | 用户私有 |
| `todos` | ✅ | 用户私有 |
| `schedules` | ✅ | 用户私有 |
| `user_settings` | ✅ | 用户私有 |

---

## ⚠️ 执行后测试

建议使用不同用户的 anon key 测试：

```sql
-- 测试 1: 确认无法读取他人数据
SELECT * FROM chat_messages LIMIT 1;
-- 应该只返回当前用户的消息

-- 测试 2: 确认无法修改他人数据
UPDATE friends SET status = 'blocked' WHERE friend_id = '其他用户ID';
-- 应该返回 0 rows affected 或权限错误
```

---

## 📁 相关文件

- `database/migrations/001_add_user_sessions.sql`
- `database/migrations/002_security_profiles_rls.sql`
- `database/migrations/003_enable_rls_all_sensitive_tables.sql` (新增)
- `docs/reports/DATABASE_MIGRATION_GUIDE.md` (本文件)

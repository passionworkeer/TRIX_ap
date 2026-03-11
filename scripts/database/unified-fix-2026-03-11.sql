-- ============================================
-- 数据库统一修复脚本
-- 执行日期: 2026-03-11
-- 说明: 基于实际 Supabase 数据库结构修复
-- ============================================

-- ============================================
-- 1. 修复 study_sessions 表
-- 添加 is_completed, earned_points 字段
-- 注意：当前表使用 started_at/ended_at 字段
-- ============================================

ALTER TABLE study_sessions
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS earned_points INTEGER DEFAULT 0;

-- 创建索引 (如果不存在)
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started ON study_sessions(started_at DESC);

-- ============================================
-- 2. 修复 profiles 表
-- 添加缺失字段
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- 创建索引 (如果不存在)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_companion_id ON profiles(companion_id);

-- ============================================
-- 3. 修复 chat_messages 表
-- 添加 Web 端需要的字段
-- 注意：不创建 room_id（因为没有 chat_rooms 表）
-- ============================================

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS sender_id UUID,
ADD COLUMN IF NOT EXISTS receiver_id UUID,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- ============================================
-- 4. 启用 RLS (如果尚未启用)
-- ============================================

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. 创建 RLS 策略 (如果不存在)
-- ============================================

-- study_sessions 策略 - SELECT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own study sessions'
    ) THEN
        CREATE POLICY "Users can view own study sessions" ON study_sessions
            FOR SELECT USING (user_id = auth.uid());
    END IF;
END
$$;

-- study_sessions 策略 - INSERT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert study sessions'
    ) THEN
        CREATE POLICY "Users can insert study sessions" ON study_sessions
            FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
END
$$;

-- study_sessions 策略 - UPDATE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own study sessions'
    ) THEN
        CREATE POLICY "Users can update own study sessions" ON study_sessions
            FOR UPDATE USING (user_id = auth.uid());
    END IF;
END
$$;

-- study_sessions 策略 - DELETE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own study sessions'
    ) THEN
        CREATE POLICY "Users can delete own study sessions" ON study_sessions
            FOR DELETE USING (user_id = auth.uid());
    END IF;
END
$$;

-- profiles 策略
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'profiles_own'
    ) THEN
        CREATE POLICY "profiles_own" ON profiles
            FOR ALL USING (auth.uid() = id);
    END IF;
END
$$;

-- chat_messages 策略 - SELECT (用户只能查看自己参与的对话)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own chat messages'
    ) THEN
        CREATE POLICY "Users can view own chat messages" ON chat_messages
            FOR SELECT USING (
                sender_id = auth.uid() OR receiver_id = auth.uid()
            );
    END IF;
END
$$;

-- chat_messages 策略 - INSERT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert chat messages'
    ) THEN
        CREATE POLICY "Users can insert chat messages" ON chat_messages
            FOR INSERT WITH CHECK (sender_id = auth.uid());
    END IF;
END
$$;

-- chat_messages 策略 - UPDATE (只能更新自己的消息)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own chat messages'
    ) THEN
        CREATE POLICY "Users can update own chat messages" ON chat_messages
            FOR UPDATE USING (sender_id = auth.uid());
    END IF;
END
$$;

-- chat_messages 策略 - DELETE (只能删除自己的消息)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own chat messages'
    ) THEN
        CREATE POLICY "Users can delete own chat messages" ON chat_messages
            FOR DELETE USING (sender_id = auth.uid());
    END IF;
END
$$;

-- ============================================
-- 验证修复结果
-- ============================================

-- 查看 study_sessions 表结构
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'study_sessions'
ORDER BY ordinal_position;

-- 查看 profiles 表结构
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 查看 chat_messages 表结构
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;

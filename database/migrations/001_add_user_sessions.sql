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

-- 第二步：给 profiles 加 active_session_id 列（TEXT，不做 FK 约束，避免循环引用）
-- 注意：profiles 表早已存在，这里是 ALTER TABLE，不是 CREATE TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_profiles_active_session ON profiles(active_session_id) WHERE active_session_id IS NOT NULL;

-- 为 user_sessions.user_id 补上外键（表建好后才能加外键）
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

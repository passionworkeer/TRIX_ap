-- ============================================
-- 好友在线状态功能 - 数据库迁移
-- 执行方式：Supabase Dashboard > SQL Editor
-- ============================================

-- 1. 添加 last_active_at 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles(last_active_at);

-- 3. 添加在线状态可见性设置（隐私控制）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true;

-- 4. 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略

-- 允许用户读取自己的 profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 允许用户更新自己的 last_active_at
DROP POLICY IF EXISTS "Users can update own last_active_at" ON profiles;
CREATE POLICY "Users can update own last_active_at" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 允许用户读取好友的 last_active_at
DROP POLICY IF EXISTS "Friends can view last_active_at" ON profiles;
CREATE POLICY "Friends can view last_active_at" ON profiles
  FOR SELECT
  USING (
    id IN (
      SELECT friend_id FROM friends WHERE user_id = auth.uid()
    )
    OR id = auth.uid()
  );

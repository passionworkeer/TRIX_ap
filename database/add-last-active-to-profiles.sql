-- ============================================
-- RLS 策略：确保只有好友能查看在线状态
-- ============================================

-- 启用 RLS（如果尚未启用）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own last_active_at" ON profiles;
DROP POLICY IF EXISTS "Friends can view last_active_at" ON profiles;

-- 允许用户读取自己的 profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 允许用户更新自己的 last_active_at
CREATE POLICY "Users can update own last_active_at" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 允许用户读取好友的 last_active_at（仅 id 和 last_active_at 字段）
CREATE POLICY "Friends can view last_active_at" ON profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT friend_id FROM friends WHERE user_id = auth.uid()
    )
    OR id = auth.uid()
  )
  WITH CHECK (
    id IN (
      SELECT friend_id FROM friends WHERE user_id = auth.uid()
    )
    OR id = auth.uid()
  );

-- ============================================
-- 隐私控制（可选）
-- ============================================

-- 添加在线状态可见性设置
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.show_online_status IS '是否向好友显示在线状态';

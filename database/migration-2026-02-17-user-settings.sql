-- ============================================
-- 🎯 TRIX 3D Companion - 数据库迁移脚本
-- ============================================
-- 执行时间: 2026-02-17
-- 用途: 添加用户隐私设置功能
-- ============================================

-- ============================================
-- 1. 用户隐私设置表 (user_settings)
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- 隐私设置
  allow_stranger_search BOOLEAN DEFAULT true, -- 允许陌生人通过邮箱/用户名查找
  show_online_status BOOLEAN DEFAULT true,    -- 显示在线状态
  allow_study_invites BOOLEAN DEFAULT true,   -- 允许好友邀请自习

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- 2. 触发器：更新 updated_at 字段
-- ============================================
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- ============================================
-- 3. 为现有用户创建默认设置
-- ============================================
INSERT INTO user_settings (user_id)
SELECT id FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM user_settings WHERE user_settings.user_id = profiles.id
);

-- ============================================
-- 4. RLS 策略（如果启用了 RLS）
-- ============================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的设置
CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以插入自己的设置
CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的设置
CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- ✅ 迁移完成
-- ============================================
-- 验证表是否创建成功
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

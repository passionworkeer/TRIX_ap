-- ============================================
-- 为 profiles 表添加 is_studying 字段
-- ============================================
-- 功能: 记录用户当前是否在自习状态
-- 作者: AI Assistant
-- 日期: 2026-02-11
-- ============================================

-- 1. 添加 is_studying 字段（默认 false）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false;

-- 2. 为该字段创建索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_profiles_is_studying 
ON profiles(is_studying) 
WHERE is_studying = true;

-- 3. 添加注释
COMMENT ON COLUMN profiles.is_studying IS '用户是否正在自习（true=自习中, false=未自习）';

-- 4. 启用 Realtime（让好友能实时看到状态变化）
-- 注意：这需要在 Supabase Dashboard 中手动启用，或使用以下语句
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- 5. 验证字段是否添加成功
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_studying';

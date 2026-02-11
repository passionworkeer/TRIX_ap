-- ============================================
-- 🏅 为 profiles 表添加专注时长字段
-- ============================================
-- 用途: 持久化用户的累计专注时长
-- 使用说明: 在 Supabase Dashboard 的 SQL Editor 中执行
-- ============================================

-- 添加 total_study_time 字段 (单位: 分钟)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0;

-- 添加索引以加速查询
CREATE INDEX IF NOT EXISTS idx_profiles_total_study_time 
ON profiles(total_study_time) 
WHERE total_study_time > 0;

-- 添加注释
COMMENT ON COLUMN profiles.total_study_time IS '累计专注时长(分钟)';

-- ============================================
-- 验证字段已添加
-- ============================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'total_study_time';

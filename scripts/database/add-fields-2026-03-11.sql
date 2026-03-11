-- ============================================
-- 补充缺失字段脚本
-- 执行日期: 2026-03-11
-- 说明: 补充 school, grade 字段到 profiles 表
-- ============================================

-- 添加 school 和 grade 字段到 profiles 表
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS grade TEXT;

-- 验证
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('school', 'grade');

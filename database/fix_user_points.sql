-- ============================================
-- 修复 user_points 表缺少的字段
-- 执行时间: 2026-03-06
-- ============================================

-- 添加 total_earned 字段（累计获得积分）
ALTER TABLE IF EXISTS user_points
ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0;

-- 添加 total_spent 字段（累计消费积分）
ALTER TABLE IF EXISTS user_points
ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0;

-- ============================================
-- 验证添加结果
-- ============================================
SELECT * FROM user_points LIMIT 1;

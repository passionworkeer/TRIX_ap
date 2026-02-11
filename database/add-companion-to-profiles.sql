-- ============================================
-- 🎯 添加 companion_id 字段到 profiles 表
-- ============================================
-- 用途: 记录正在一起自习的好友 ID，实现双向关联
-- 创建时间: 2026-02-11
-- ============================================

-- 1. 添加 companion_id 字段（外键关联到 profiles 表自身）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. 添加索引，加速查询
CREATE INDEX IF NOT EXISTS idx_profiles_companion_id ON profiles(companion_id);

-- 3. 添加注释
COMMENT ON COLUMN profiles.companion_id IS '正在一起自习的好友 ID（双向关联）';

-- 4. 验证查询
-- 查看所有一起自习的配对
SELECT 
  u1.username AS user1,
  u2.username AS user2,
  u1.is_studying AS user1_studying,
  u2.is_studying AS user2_studying
FROM profiles u1
LEFT JOIN profiles u2 ON u1.companion_id = u2.id
WHERE u1.companion_id IS NOT NULL;

-- ============================================
-- 📝 使用说明
-- ============================================
-- 1. 在 Supabase Dashboard -> SQL Editor 执行此脚本
-- 2. 当用户 A 加入用户 B 的自习室时：
--    - 更新 A.is_studying = true, A.companion_id = B.id
--    - 更新 B.companion_id = A.id （建立双向关联）
-- 3. 当用户停止自习时：
--    - 清除双方的 companion_id
--    - 更新双方的 is_studying = false
-- ============================================

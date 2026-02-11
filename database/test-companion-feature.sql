-- ============================================
-- 🧪 Companion ID 功能测试 SQL
-- ============================================
-- 用途: 验证 companion_id 字段工作正常
-- ============================================

-- 步骤 1: 查看所有用户（找到两个测试用户）
SELECT 
  id,
  username,
  email,
  is_studying,
  companion_id,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 复制上面结果中两个用户的 ID，例如:
-- User A (admin): 9d52cc23-b580-411a-aeca-7167ec9e4a40
-- User B (xiaoming): bd49b054-7e8d-45e0-863e-0a7d89d51bf3


-- 步骤 2: 模拟"加入自习室"的双向更新
-- ⚠️ 将下面的 UUID 替换为你实际的用户 ID！

-- 假设: User B (xiaoming) 加入 User A (admin) 的自习室
DO $$
DECLARE
  user_a_id UUID := '9d52cc23-b580-411a-aeca-7167ec9e4a40';  -- ← 替换为 admin 的 ID
  user_b_id UUID := 'bd49b054-7e8d-45e0-863e-0a7d89d51bf3';  -- ← 替换为 xiaoming 的 ID
BEGIN
  -- 更新 User B: 设置为正在自习 + 关联到 User A
  UPDATE profiles 
  SET is_studying = true, companion_id = user_a_id
  WHERE id = user_b_id;
  
  -- 更新 User A: 关联到 User B
  UPDATE profiles 
  SET companion_id = user_b_id
  WHERE id = user_a_id;
  
  RAISE NOTICE '✅ 双向连接建立成功！';
END $$;


-- 步骤 3: 验证更新结果
SELECT 
  id,
  username,
  is_studying,
  companion_id,
  CASE 
    WHEN companion_id IS NOT NULL THEN '👥 有伙伴'
    ELSE '👤 单独'
  END as status
FROM profiles
WHERE id IN (
  '9d52cc23-b580-411a-aeca-7167ec9e4a40',  -- ← admin 的 ID
  'bd49b054-7e8d-45e0-863e-0a7d89d51bf3'   -- ← xiaoming 的 ID
);

-- 预期结果:
-- admin:    is_studying = true,  companion_id = xiaoming_id
-- xiaoming: is_studying = true,  companion_id = admin_id


-- 步骤 4: 清理测试数据（可选）
-- 取消下面的注释来重置状态
/*
UPDATE profiles 
SET is_studying = false, companion_id = null
WHERE id IN (
  '9d52cc23-b580-411a-aeca-7167ec9e4a40',
  'bd49b054-7e8d-45e0-863e-0a7d89d51bf3'
);

SELECT 'Cleaned up test data' as message;
*/


-- ============================================
-- 📋 简化版 (推荐使用这个!)
-- ============================================
-- 直接使用子查询，无需手动替换 ID

-- 1. 查看当前状态
SELECT 
  username,
  email,
  is_studying,
  companion_id
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- 2. 自动获取两个用户并建立连接
WITH users AS (
  SELECT id, username 
  FROM profiles 
  ORDER BY created_at DESC 
  LIMIT 2
),
user_a AS (SELECT id FROM users OFFSET 0 LIMIT 1),
user_b AS (SELECT id FROM users OFFSET 1 LIMIT 1)
UPDATE profiles
SET 
  is_studying = true,
  companion_id = CASE 
    WHEN id = (SELECT id FROM user_a) THEN (SELECT id FROM user_b)
    WHEN id = (SELECT id FROM user_b) THEN (SELECT id FROM user_a)
  END
WHERE id IN (SELECT id FROM user_a UNION SELECT id FROM user_b)
RETURNING id, username, companion_id;

-- 3. 验证结果
SELECT 
  p1.username as user1,
  p2.username as user2,
  p1.companion_id as user1_companion,
  p2.companion_id as user2_companion,
  CASE 
    WHEN p1.companion_id = p2.id AND p2.companion_id = p1.id 
    THEN '✅ 双向连接正确'
    ELSE '❌ 连接错误'
  END as validation
FROM profiles p1
CROSS JOIN profiles p2
WHERE p1.companion_id = p2.id
LIMIT 5;

-- ============================================
-- 🔍 调试查询
-- ============================================

-- 查看谁在自习
SELECT username, is_studying, companion_id 
FROM profiles 
WHERE is_studying = true;

-- 查看所有配对关系
SELECT 
  p1.username || ' ↔️ ' || p2.username as pair,
  p1.id as user1_id,
  p2.id as user2_id
FROM profiles p1
JOIN profiles p2 ON p1.companion_id = p2.id
WHERE p1.companion_id IS NOT NULL;

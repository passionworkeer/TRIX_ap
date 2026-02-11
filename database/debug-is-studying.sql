-- ============================================
-- 调试和测试 is_studying 功能的 SQL 脚本
-- ============================================
-- 用途: 检查数据、手动设置测试状态
-- 日期: 2026-02-11
-- ============================================

-- 📋 第一步: 检查 is_studying 字段是否存在
-- ============================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_studying';

-- 预期输出: 应该看到 is_studying | boolean | false | YES


-- 📊 第二步: 查看所有用户的自习状态
-- ============================================
SELECT 
  id,
  username,
  is_studying,
  created_at
FROM profiles
ORDER BY username;

-- 这会显示所有用户及其当前的自习状态


-- 🔍 第三步: 查看好友关系表
-- ============================================
SELECT 
  f.id,
  f.user_id,
  f.friend_id,
  f.status,
  p1.username AS user_name,
  p2.username AS friend_name,
  p2.is_studying AS friend_is_studying
FROM friends f
LEFT JOIN profiles p1 ON f.user_id = p1.id
LEFT JOIN profiles p2 ON f.friend_id = p2.id
WHERE f.status = 'accepted'
ORDER BY p1.username, p2.username;

-- 这会显示所有好友关系及其自习状态


-- 🧪 第四步: 手动设置测试数据
-- ============================================
-- 假设你有两个测试账户: test1@test.com 和 test2@test.com
-- 让 test2 进入自习状态（这样 test1 应该能看到他）

-- 方法 1: 按用户名更新
UPDATE profiles
SET is_studying = true
WHERE username = 'test2'; -- 替换为实际的用户名

-- 方法 2: 按邮箱更新（需要 join auth.users）
UPDATE profiles
SET is_studying = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'test2@test.com'
);

-- 方法 3: 直接按 ID 更新（最精确）
-- UPDATE profiles SET is_studying = true WHERE id = 'your-user-id-here';


-- ✅ 第五步: 验证更新是否成功
-- ============================================
SELECT 
  p.id,
  p.username,
  p.is_studying,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.is_studying = true;

-- 应该看到刚才设置为 true 的用户


-- 🔄 第六步: 模拟完整的好友自习场景
-- ============================================
-- 假设用户 A (test1) 想看到用户 B (test2) 在自习

-- 1. 确保他们是好友
SELECT * FROM friends 
WHERE (user_id = 'user-a-id' AND friend_id = 'user-b-id')
   OR (user_id = 'user-b-id' AND friend_id = 'user-a-id');

-- 2. 设置用户 B 为自习状态
UPDATE profiles SET is_studying = true WHERE id = 'user-b-id';

-- 3. 模拟前端查询（用户 A 查看正在自习的好友）
WITH my_friends AS (
  SELECT friend_id 
  FROM friends 
  WHERE user_id = 'user-a-id' 
    AND status = 'accepted'
)
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.is_studying
FROM profiles p
INNER JOIN my_friends mf ON p.id = mf.friend_id
WHERE p.is_studying = true;

-- 预期: 应该看到用户 B 的信息


-- 🧹 第七步: 清理测试数据
-- ============================================
-- 测试完成后，将所有用户状态重置为 false
-- UPDATE profiles SET is_studying = false WHERE is_studying = true;


-- 💡 第八步: 实时调试查询
-- ============================================
-- 如果前端弹窗显示"暂时没有好友在自习"，执行以下查询排查问题

-- A. 检查当前登录用户的好友列表
DO $$
DECLARE
  current_user_id UUID := 'your-current-user-id'; -- 替换为实际 ID
BEGIN
  RAISE NOTICE '=== 好友列表 ===';
  PERFORM * FROM friends WHERE user_id = current_user_id;
  
  RAISE NOTICE '=== 好友的 profiles ===';
  PERFORM p.* 
  FROM profiles p
  WHERE p.id IN (
    SELECT friend_id FROM friends WHERE user_id = current_user_id AND status = 'accepted'
  );
  
  RAISE NOTICE '=== 正在自习的好友 ===';
  PERFORM p.* 
  FROM profiles p
  WHERE p.id IN (
    SELECT friend_id FROM friends WHERE user_id = current_user_id AND status = 'accepted'
  )
  AND p.is_studying = true;
END $$;


-- 📌 快速设置脚本（复制粘贴即用）
-- ============================================
-- 将下面的用户名/邮箱替换为你的测试账户

-- 设置 test2 为自习状态
UPDATE profiles SET is_studying = true 
WHERE username = 'test2' OR id IN (
  SELECT id FROM auth.users WHERE email = 'test2@test.com'
);

-- 验证
SELECT username, is_studying FROM profiles WHERE username IN ('test1', 'test2');

-- 预期输出:
-- test1 | false
-- test2 | true

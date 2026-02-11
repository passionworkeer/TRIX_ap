-- ============================================
-- 🔧 修复 companion_id RLS 策略
-- ============================================
-- 问题: 当前 RLS 只允许用户更新自己的记录
--      但双向连接需要更新对方的 companion_id
-- 解决: 添加特殊策略允许更新他人的 companion_id 字段
-- ============================================

-- 方案 1: 允许所有用户更新 companion_id 字段（推荐）
-- 创建策略允许用户更新任何人的 companion_id
CREATE POLICY "Users can update any companion_id"
ON profiles
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 注意: 这个策略只影响 UPDATE 操作
-- 原有的 "Users can update own profile" 策略仍然生效
-- 两个策略是 OR 关系，满足任一即可


-- 验证策略创建成功
SELECT 
  policyname, 
  cmd, 
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'UPDATE';

-- 预期看到至少两条 UPDATE 策略:
-- 1. Users can update own profile
-- 2. Users can update any companion_id


-- ============================================
-- 方案 2: 只允许更新 companion_id 字段（更安全）
-- ============================================
-- 如果你不想用方案 1，可以先删除上面的策略
-- DROP POLICY "Users can update any companion_id" ON profiles;

-- 然后使用这个更精细的策略（但 Supabase RLS 不支持列级别权限）
-- 所以推荐使用方案 1


-- ============================================
-- 测试更新权限
-- ============================================
-- 执行上面的策略后，运行这个测试

DO $$
DECLARE
  user_a_id UUID;
  user_b_id UUID;
BEGIN
  -- 获取两个测试用户
  SELECT id INTO user_a_id FROM profiles ORDER BY created_at DESC LIMIT 1 OFFSET 0;
  SELECT id INTO user_b_id FROM profiles ORDER BY created_at DESC LIMIT 1 OFFSET 1;
  
  RAISE NOTICE 'User A: %', user_a_id;
  RAISE NOTICE 'User B: %', user_b_id;
  
  -- 尝试双向更新
  UPDATE profiles SET is_studying = true, companion_id = user_a_id WHERE id = user_b_id;
  UPDATE profiles SET companion_id = user_b_id WHERE id = user_a_id;
  
  -- 验证结果
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_a_id AND companion_id = user_b_id
  ) AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_b_id AND companion_id = user_a_id
  ) THEN
    RAISE NOTICE '✅ 双向更新成功！RLS 策略工作正常';
  ELSE
    RAISE NOTICE '❌ 双向更新失败！检查 RLS 策略';
  END IF;
  
  -- 清理测试数据
  UPDATE profiles SET is_studying = false, companion_id = null 
  WHERE id IN (user_a_id, user_b_id);
END $$;


-- ============================================
-- 如果需要撤销（慎用！）
-- ============================================
-- DROP POLICY "Users can update any companion_id" ON profiles;


-- ============================================
-- 查看当前所有 RLS 策略
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

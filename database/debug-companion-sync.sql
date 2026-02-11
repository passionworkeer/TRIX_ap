-- ============================================
-- 🔍 诊断 companion_id 同步问题
-- ============================================
-- 创建时间: 2026-02-11
-- 用途: 检查为什么 companion_id 没有正确更新
-- ============================================

-- 1. 检查 companion_id 字段是否存在
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'companion_id';

-- 预期结果: 应该返回一行
-- column_name: companion_id
-- data_type: uuid
-- is_nullable: YES

-- 如果返回空，说明字段不存在，需要执行迁移！
-- 👉 执行: database/add-companion-to-profiles.sql


-- 2. 查看当前所有用户的 companion_id 状态
SELECT 
  id,
  username,
  email,
  is_studying,
  companion_id,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 预期: 
-- - 如果有人在一起自习，companion_id 应该互相指向
-- - 例如: A.companion_id = B.id AND B.companion_id = A.id


-- 3. 查看 profiles 表的 RLS 策略
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
WHERE tablename = 'profiles';

-- 检查是否有 UPDATE 权限
-- 如果没有允许用户更新自己记录的策略，需要添加！


-- 4. 测试手动更新 companion_id（替换 <YOUR_USER_ID> 和 <FRIEND_ID>）
-- 取消下面注释来测试

-- UPDATE profiles 
-- SET companion_id = '<FRIEND_ID>'
-- WHERE id = '<YOUR_USER_ID>';

-- SELECT id, username, companion_id FROM profiles WHERE id = '<YOUR_USER_ID>';


-- 5. 查看最近的数据库更新日志（如果有 audit 表）
-- SELECT * FROM audit.record_version 
-- WHERE table_name = 'profiles' 
-- ORDER BY created_at DESC 
-- LIMIT 10;


-- ============================================
-- 🛠️ 常见问题修复
-- ============================================

-- 问题 1: companion_id 字段不存在
-- 解决方案: 执行迁移脚本
/*
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS companion_id UUID 
REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_companion_id 
ON profiles(companion_id);
*/

-- 问题 2: RLS 策略阻止更新
-- 解决方案: 添加 UPDATE 策略
/*
-- 允许用户更新自己的记录
CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- 或者允许更新其他用户的 companion_id（如果需要）
CREATE POLICY "Users can update companion_id" 
ON profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);
*/

-- 问题 3: 外键约束问题
-- 检查外键
/*
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'profiles' 
AND tc.constraint_type = 'FOREIGN KEY';
*/

-- ============================================
-- 📝 使用说明
-- ============================================
-- 1. 在 Supabase Dashboard -> SQL Editor 逐条执行上面的查询
-- 2. 根据结果判断问题所在
-- 3. 应用对应的修复方案
-- ============================================

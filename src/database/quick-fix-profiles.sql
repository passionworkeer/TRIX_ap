-- ============================================
-- 🔧 快速修复脚本 - Profiles 表列名问题
-- ============================================
-- 问题: profiles 表使用 full_name 而不是 display_name
-- 解决: 更新触发器和相关查询
-- ============================================

-- 如果你已经执行了之前版本的 setup-auth-trigger.sql
-- 请先删除旧的触发器和函数,然后重新创建

-- ============================================
-- 步骤 1: 删除旧的触发器和函数
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================
-- 步骤 2: 创建新的触发器函数 (匹配实际的 profiles 表结构)
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, points, avatar_config)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    0,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 步骤 3: 创建新的触发器
-- ============================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 步骤 4: 为已存在的用户创建 Profile (如果需要)
-- ============================================
INSERT INTO profiles (id, username, points, avatar_config)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1)),
  0,
  '{}'::jsonb
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ✅ 修复完成！
-- ============================================

-- 验证修复结果:
SELECT 
  u.id,
  u.email,
  p.username,
  p.points,
  p.avatar_config
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

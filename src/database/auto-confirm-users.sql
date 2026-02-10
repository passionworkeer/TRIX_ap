-- ============================================
-- 🔧 自动确认新注册用户的邮箱
-- ============================================
-- 问题: 用户注册后需要确认邮箱才能登录
-- 解决: 修改触发器,自动确认邮箱
-- ============================================

-- ============================================
-- 步骤 1: 手动确认已存在的用户
-- ============================================
-- 只更新 email_confirmed_at (confirmed_at 是生成列,会自动更新)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email LIKE '%@trix.app'
  AND email_confirmed_at IS NULL;

-- ============================================
-- 步骤 2: 修改触发器,自动确认新用户
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建 profile
  INSERT INTO profiles (id, username, points, avatar_config)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    0,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 步骤 3: 创建第二个触发器来自动确认邮箱
-- ============================================
-- 注意: 这个触发器在用户创建后立即确认邮箱
CREATE OR REPLACE FUNCTION auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 自动确认邮箱 (只更新 email_confirmed_at)
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;

CREATE TRIGGER on_auth_user_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user();

-- ============================================
-- ✅ 完成！
-- ============================================

-- 验证设置:
SELECT 
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
WHERE email LIKE '%@trix.app'
ORDER BY created_at DESC;

-- ============================================
-- 测试:
-- ============================================
-- 1. 在应用中注册新用户
-- 2. 立即尝试登录 (无需确认邮箱)
-- 3. 应该可以成功登录!
-- ============================================

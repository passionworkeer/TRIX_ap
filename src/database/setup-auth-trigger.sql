-- ============================================
-- 🎯 Supabase 认证触发器 - 自动创建 Profile
-- ============================================
-- 创建时间: 2026-02-10
-- 用途: 当新用户注册时,自动创建对应的 profile 记录
-- 使用方法: 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 1. 创建 profiles 表 (如果不存在)
-- ============================================
-- 注意: 根据实际的 profiles 表结构
-- 实际表结构: id, username, points, avatar_config, created_at, updated_at

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  avatar_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 启用 Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略: 所有人可以查看 profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- 创建 RLS 策略: 用户只能更新自己的 profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 创建 RLS 策略: 用户可以插入自己的 profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. 创建触发器函数 - 自动创建 Profile
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
-- 3. 创建触发器 - 监听新用户注册
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 4. 更新 profiles 的 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON profiles;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- ✅ 触发器创建完成！
-- ============================================
-- 
-- 现在,当用户通过以下方式注册时:
-- 
-- const { data, error } = await supabase.auth.signUp({
--   email: 'alice@trix.app',
--   password: '123456',
--   options: {
--     data: {
--       username: 'alice'
--     }
--   }
-- })
-- 
-- 会自动创建:
-- ✅ auth.users 表中的用户记录
-- ✅ profiles 表中的 profile 记录 (包含 username, points, avatar_config)
-- 
-- ============================================

-- ============================================
-- 验证触发器是否创建成功
-- ============================================

-- 查看所有触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('profiles')
ORDER BY event_object_table, trigger_name;

-- 查看 auth.users 的触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- ============================================
-- 测试触发器
-- ============================================
-- 注意: 这个测试需要在应用中进行,因为直接 INSERT auth.users 不会触发
-- 
-- 在你的应用中执行注册:
-- 1. 打开应用 http://localhost:5173/
-- 2. 点击"立即注册"
-- 3. 填写: alice / alice@trix.app / 123456
-- 4. 点击注册
-- 
-- 然后运行以下查询验证:

SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  p.username,
  p.points,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'alice@trix.app';

-- 如果 profile 记录存在且 profile_created_at 不为空,说明触发器工作正常!

-- ============================================
-- 手动为已存在的用户创建 Profile (如果需要)
-- ============================================

-- 如果有用户是在创建触发器之前注册的,需要手动创建 profile:
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

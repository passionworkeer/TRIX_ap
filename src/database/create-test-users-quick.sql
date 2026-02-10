-- ============================================
-- 🎯 快速创建测试用户 - Alice 和 Bob
-- ============================================
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 方法 1: 使用 Supabase Extensions (如果可用)
-- 注意: 这需要 supabase_admin 扩展

-- 创建用户 Alice
SELECT extensions.create_user(
  'alice@trix.app',
  '123456',
  '{"username": "alice"}'::jsonb,
  true  -- auto confirm
);

-- 创建用户 Bob
SELECT extensions.create_user(
  'bob@trix.app',
  '123456',
  '{"username": "bob"}'::jsonb,
  true  -- auto confirm
);

-- ============================================
-- 如果上面的方法不工作,使用下面的替代方法:
-- ============================================

-- 方法 2: 直接插入 auth.users (需要 service_role 权限)
-- 注意: 这个方法只在有 service_role 权限时才能工作

DO $$
DECLARE
  alice_id uuid;
  bob_id uuid;
BEGIN
  -- 生成 UUID
  alice_id := gen_random_uuid();
  bob_id := gen_random_uuid();
  
  -- 插入 Alice
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    alice_id,
    'authenticated',
    'authenticated',
    'alice@trix.app',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"username": "alice"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
  
  -- 插入 Bob
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    bob_id,
    'authenticated',
    'authenticated',
    'bob@trix.app',
    crypt('123456', gen_salt('bf')),
    NOW(),
    '{"username": "bob"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
  
  -- 创建对应的 profiles
  INSERT INTO profiles (id, username, points, avatar_config)
  VALUES 
    (alice_id, 'alice', 0, '{}'::jsonb),
    (bob_id, 'bob', 0, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Users created successfully!';
  RAISE NOTICE 'Alice ID: %', alice_id;
  RAISE NOTICE 'Bob ID: %', bob_id;
END $$;

-- ============================================
-- 验证创建结果
-- ============================================
SELECT 
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data->>'username' as username,
  created_at
FROM auth.users
WHERE email IN ('alice@trix.app', 'bob@trix.app');

-- 检查 profiles
SELECT 
  p.id,
  p.username,
  p.points,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email IN ('alice@trix.app', 'bob@trix.app');

-- ============================================
-- ✅ 完成！
-- ============================================
-- 
-- 现在可以登录了:
-- - alice@trix.app / 123456
-- - bob@trix.app / 123456
-- 
-- ============================================

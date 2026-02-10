-- ============================================
-- 🤝 设置测试账号的好友关系
-- ============================================
-- 账号1: 123@trix.app
-- 账号2: 1234@trix.app
-- ============================================

-- 第一步: 获取两个用户的 UUID (从 auth.users 表)
-- 注意: 需要先在 Supabase Dashboard 查看这两个用户的实际 UUID

-- 假设用户 UUID 如下 (需要替换为实际 UUID):
-- 123@trix.app  的 UUID: 请从 auth.users 表查询
-- 1234@trix.app 的 UUID: 请从 auth.users 表查询

-- ============================================
-- 方案1: 使用动态查询 (推荐)
-- ============================================

DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- 查找 123@trix.app 的 UUID
  SELECT id INTO user1_id FROM auth.users WHERE email = '123@trix.app';
  
  -- 查找 1234@trix.app 的 UUID
  SELECT id INTO user2_id FROM auth.users WHERE email = '1234@trix.app';
  
  -- 检查用户是否存在
  IF user1_id IS NULL THEN
    RAISE EXCEPTION '用户 123@trix.app 不存在,请先创建';
  END IF;
  
  IF user2_id IS NULL THEN
    RAISE EXCEPTION '用户 1234@trix.app 不存在,请先创建';
  END IF;
  
  -- 输出找到的 UUID (用于调试)
  RAISE NOTICE '用户1 (123@trix.app) UUID: %', user1_id;
  RAISE NOTICE '用户2 (1234@trix.app) UUID: %', user2_id;
  
  -- 为 123@trix.app 添加 1234@trix.app 为好友
  INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying)
  VALUES (
    user1_id,
    user2_id::text, -- 使用 UUID 作为 friend_id
    '1234', -- 显示名称
    '', -- 头像 URL
    'online', -- 状态
    '测试账号2 - 1234@trix.app', -- 个人简介
    0, -- 学习时长
    false -- 是否在学习
  )
  ON CONFLICT (friend_id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- 为 1234@trix.app 添加 123@trix.app 为好友
  INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying)
  VALUES (
    user2_id,
    user1_id::text, -- 使用 UUID 作为 friend_id
    '123', -- 显示名称
    '', -- 头像 URL
    'online', -- 状态
    '测试账号1 - 123@trix.app', -- 个人简介
    0, -- 学习时长
    false -- 是否在学习
  )
  ON CONFLICT (friend_id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- 初始化未读消息计数 (123@trix.app 看 1234@trix.app)
  INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
  VALUES (
    user1_id,
    user2_id::text,
    0,
    NULL,
    NULL
  )
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  -- 初始化未读消息计数 (1234@trix.app 看 123@trix.app)
  INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
  VALUES (
    user2_id,
    user1_id::text,
    0,
    NULL,
    NULL
  )
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  RAISE NOTICE '✅ 好友关系创建成功！';
  RAISE NOTICE '123@trix.app 和 1234@trix.app 现在是好友了';
  
END $$;

-- ============================================
-- 验证好友关系
-- ============================================

-- 查看 123@trix.app 的好友列表
SELECT 
  f.friend_id,
  f.name,
  f.status,
  f.bio,
  u.email as user_email
FROM friends f
JOIN auth.users u ON f.user_id = u.id
WHERE u.email = '123@trix.app';

-- 查看 1234@trix.app 的好友列表
SELECT 
  f.friend_id,
  f.name,
  f.status,
  f.bio,
  u.email as user_email
FROM friends f
JOIN auth.users u ON f.user_id = u.id
WHERE u.email = '1234@trix.app';

-- 查看未读消息计数
SELECT 
  u.email,
  uc.friend_id,
  uc.unread_count,
  uc.last_message
FROM unread_counts uc
JOIN auth.users u ON uc.user_id = u.id
WHERE u.email IN ('123@trix.app', '1234@trix.app')
ORDER BY u.email;

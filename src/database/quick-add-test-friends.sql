-- ============================================
-- 🤝 快速添加测试账号为好友
-- ============================================
-- 账号1: 123@trix.app
-- 账号2: 1234@trix.app
-- ============================================

DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  user1_email TEXT := '123@trix.app';
  user2_email TEXT := '1234@trix.app';
BEGIN
  -- 查找两个用户的 UUID
  SELECT id INTO user1_id FROM auth.users WHERE email = user1_email;
  SELECT id INTO user2_id FROM auth.users WHERE email = user2_email;
  
  -- 检查用户是否存在
  IF user1_id IS NULL THEN
    RAISE EXCEPTION '用户 % 不存在', user1_email;
  END IF;
  
  IF user2_id IS NULL THEN
    RAISE EXCEPTION '用户 % 不存在', user2_email;
  END IF;
  
  RAISE NOTICE '用户1 (%) UUID: %', user1_email, user1_id;
  RAISE NOTICE '用户2 (%) UUID: %', user2_email, user2_id;
  
  -- 先在 public.users 表创建用户记录（如果不存在）
  INSERT INTO users (id, email, username, display_name)
  VALUES (user1_id, user1_email, '123', '123')
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO users (id, email, username, display_name)
  VALUES (user2_id, user2_email, '1234', '1234')
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '✅ 用户记录已创建';
  
  -- 为 123@trix.app 添加 1234@trix.app 为好友
  INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying)
  VALUES (
    user1_id,
    user2_id::text,
    '1234',
    '',
    'online',
    '测试账号 1234@trix.app',
    0,
    false
  )
  ON CONFLICT (friend_id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- 为 1234@trix.app 添加 123@trix.app 为好友
  INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying)
  VALUES (
    user2_id,
    user1_id::text,
    '123',
    '',
    'online',
    '测试账号 123@trix.app',
    0,
    false
  )
  ON CONFLICT (friend_id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- 初始化未读消息计数
  INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
  VALUES (user1_id, user2_id::text, 0, NULL, NULL)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
  VALUES (user2_id, user1_id::text, 0, NULL, NULL)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  RAISE NOTICE '✅ 好友关系创建成功！';
  RAISE NOTICE '123@trix.app 和 1234@trix.app 现在是好友了';
  
END $$;

-- 验证好友关系
SELECT 
  u.email as user_email,
  f.friend_id,
  f.name,
  f.status
FROM friends f
JOIN auth.users u ON f.user_id = u.id
WHERE u.email IN ('123@trix.app', '1234@trix.app')
ORDER BY u.email;

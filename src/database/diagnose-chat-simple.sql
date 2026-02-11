-- ============================================
-- 聊天功能快速诊断脚本（简化版）
-- ============================================
-- 用途: 快速检查数据库配置
-- 使用: 在 Supabase SQL Editor 中执行
-- ============================================

-- 1️⃣ 检查表结构
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;

-- 期望看到:
-- conversation_id | text
-- sender_id       | uuid
-- receiver_id     | uuid

-- ============================================
-- 2️⃣ 检查测试账号
SELECT 
  id,
  email,
  username
FROM users 
ORDER BY created_at DESC
LIMIT 5;

-- 复制两个账号的完整 UUID

-- ============================================
-- 3️⃣ 检查好友关系
SELECT 
  u1.email as user_email,
  u2.email as friend_email
FROM friends f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
LIMIT 10;

-- ============================================
-- 4️⃣ 检查现有聊天记录
SELECT 
  id,
  LEFT(conversation_id, 20) as conv_id_prefix,
  LEFT(text, 30) as message,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 5️⃣ 诊断总结
DO $$
DECLARE
  has_conversation_id boolean;
  rls_enabled boolean;
  user_count integer;
BEGIN
  -- 检查表结构
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'chat_messages' 
    AND column_name = 'conversation_id'
  ) INTO has_conversation_id;

  -- 检查 RLS
  SELECT relrowsecurity 
  INTO rls_enabled
  FROM pg_class 
  WHERE relname = 'chat_messages';

  -- 检查用户数量
  SELECT COUNT(*) INTO user_count FROM users;

  RAISE NOTICE '========================================';
  RAISE NOTICE '聊天功能诊断报告';
  RAISE NOTICE '========================================';
  RAISE NOTICE '表结构: %', CASE WHEN has_conversation_id THEN '✅ 正确' ELSE '❌ 需要更新' END;
  RAISE NOTICE 'RLS 状态: %', CASE WHEN rls_enabled THEN '已启用' ELSE '已禁用' END;
  RAISE NOTICE '用户数量: %', user_count;
  RAISE NOTICE '========================================';
  
  IF NOT has_conversation_id THEN
    RAISE NOTICE '❌ 请执行: complete-init.sql';
  ELSE
    RAISE NOTICE '✅ 数据库配置正确！';
  END IF;
  
  RAISE NOTICE '下一步: 在 Dashboard 检查 Realtime 是否启用';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 聊天功能 MVP 诊断脚本
-- ============================================
-- 用途: 快速检查数据库配置是否正确
-- 使用: 在 Supabase SQL Editor 中执行
-- ============================================

-- 1️⃣ 检查 chat_messages 表结构
-- ============================================
SELECT 
  '1. 表结构检查' as check_item,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;

-- 期望结果:
-- id               | uuid      | NO
-- conversation_id  | text      | NO
-- sender_id        | uuid      | NO
-- receiver_id      | uuid      | NO
-- text             | text      | NO
-- is_read          | boolean   | YES
-- created_at       | timestamp | YES

-- ============================================
-- 2️⃣ 检查 RLS 策略
-- ============================================
SELECT 
  '2. RLS 策略检查' as check_item,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'SELECT 策略已配置'
    ELSE 'SELECT 策略未配置'
  END as policy_status
FROM pg_policies 
WHERE tablename = 'chat_messages';

-- 如果返回空结果，说明没有配置 RLS 策略
-- 可以临时禁用 RLS 用于测试: ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3️⃣ 检查测试账号
-- ============================================
SELECT 
  '3. 测试账号检查' as check_item,
  id,
  email,
  username,
  display_name,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 5;

-- 复制两个账号的 UUID 用于测试

-- ============================================
-- 4️⃣ 检查好友关系
-- ============================================
SELECT 
  '4. 好友关系检查' as check_item,
  f.user_id,
  u1.email as user_email,
  f.friend_id,
  u2.email as friend_email,
  f.created_at
FROM friends f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
ORDER BY f.created_at DESC
LIMIT 10;

-- 确保测试账号之间有双向好友关系

-- ============================================
-- 5️⃣ 检查现有聊天记录
-- ============================================
SELECT 
  '5. 聊天记录检查' as check_item,
  id,
  conversation_id,
  LEFT(sender_id::text, 8) as sender_id_prefix,
  LEFT(receiver_id::text, 8) as receiver_id_prefix,
  LEFT(text, 30) as message_preview,
  is_read,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 10;

-- 如果为空，说明还没有聊天记录（正常）

-- ============================================
-- 6️⃣ 检查表的 Realtime 状态
-- ============================================
-- ⚠️ Realtime 状态需要在 Supabase Dashboard 中手动检查
-- 前往: Database → Replication → 找到 chat_messages → 确保开关是绿色

-- 以下查询用于检查表是否存在于发布中（可能在某些版本不可用，如报错请忽略）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE tablename = 'chat_messages' 
    AND schemaname = 'public'
  ) THEN
    RAISE NOTICE '✅ chat_messages 表已添加到 Realtime 发布';
  ELSE
    RAISE NOTICE '⚠️  chat_messages 表未找到在 Realtime 发布中';
    RAISE NOTICE '💡 请在 Supabase Dashboard → Database → Replication 中手动启用';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  无法检查 Realtime 状态（权限不足或版本不支持）';
    RAISE NOTICE '💡 请在 Supabase Dashboard → Database → Replication 中手动检查';
END $$;

-- ============================================
-- 7️⃣ 快速测试: 插入一条消息
-- ============================================
-- ⚠️ 替换下面的 UUID 为你的测试账号 ID

-- 示例: 假设账号 A 的 UUID 是 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
--       账号 B 的 UUID 是 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- 取消注释并替换 UUID 后执行:

-- INSERT INTO chat_messages (
--   conversation_id,
--   sender_id,
--   receiver_id,
--   text,
--   is_read
-- ) VALUES (
--   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
--   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- 账号 A 发送
--   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- 给账号 B
--   '测试消息: 数据库诊断脚本',
--   false
-- ) RETURNING id, text, created_at;

-- 如果插入成功，说明表结构正确且 RLS 允许写入

-- ============================================
-- 8️⃣ 诊断结果总结
-- ============================================

DO $$
DECLARE
  table_exists boolean;
  has_conversation_id boolean;
  rls_enabled boolean;
  has_policies boolean;
BEGIN
  -- 检查表是否存在
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'chat_messages'
  ) INTO table_exists;

  -- 检查是否有 conversation_id 字段
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'chat_messages' 
    AND column_name = 'conversation_id'
  ) INTO has_conversation_id;

  -- 检查 RLS 是否启用
  SELECT relrowsecurity 
  INTO rls_enabled
  FROM pg_class 
  WHERE relname = 'chat_messages';

  -- 检查是否有策略
  SELECT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'chat_messages'
  ) INTO has_policies;

  -- 输出诊断报告
  RAISE NOTICE '========================================';
  RAISE NOTICE '聊天功能诊断报告';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ 表存在: %', CASE WHEN table_exists THEN '是' ELSE '否' END;
  RAISE NOTICE '✓ 表结构正确 (有 conversation_id): %', CASE WHEN has_conversation_id THEN '是 ✅' ELSE '否 ❌' END;
  RAISE NOTICE '✓ RLS 启用: %', CASE WHEN rls_enabled THEN '是' ELSE '否' END;
  RAISE NOTICE '✓ RLS 策略配置: %', CASE WHEN has_policies THEN '是 ✅' ELSE '否 ⚠️' END;
  RAISE NOTICE '========================================';
  
  IF NOT has_conversation_id THEN
    RAISE NOTICE '❌ 数据库表结构不匹配！';
    RAISE NOTICE '💡 请执行: src/database/complete-init.sql';
  END IF;

  IF rls_enabled AND NOT has_policies THEN
    RAISE NOTICE '⚠️  RLS 已启用但没有策略，会阻止所有访问！';
    RAISE NOTICE '💡 选项 1: 临时禁用 RLS (测试用)';
    RAISE NOTICE '   ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;';
    RAISE NOTICE '💡 选项 2: 配置正确的 RLS 策略 (生产用)';
  END IF;

  IF table_exists AND has_conversation_id THEN
    RAISE NOTICE '✅ 数据库配置正确，可以开始测试！';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 诊断脚本执行完毕
-- ============================================
-- 下一步:
-- 1. 查看上面的输出结果
-- 2. 如果有 ❌ 错误，按照提示修复
-- 3. 在 Supabase Dashboard 检查 Realtime 是否启用
-- 4. 运行应用程序，打开浏览器控制台查看日志
-- ============================================

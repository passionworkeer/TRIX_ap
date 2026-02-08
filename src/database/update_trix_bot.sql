-- ============================================
-- 🔄 更新 TRIX 机器人配置
-- ============================================
-- 这个脚本用于更新已存在的数据库，将 Clawbot 改名为 TRIX 机器人
-- 在 Supabase SQL 编辑器中执行此脚本

-- 1. 更新好友表中的机器人名称和创建时间（置顶）
UPDATE friends
SET 
  name = 'TRIX 机器人',
  created_at = NOW(),
  updated_at = NOW()
WHERE friend_id = 'clawbot';

-- 2. 更新聊天记录中的欢迎消息
UPDATE chat_messages
SET 
  text = '你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。',
  created_at = NOW()
WHERE friend_id = 'clawbot' 
  AND sender = 'bot'
  AND text LIKE '%Clawbot Gateway%';

-- 3. 更新未读计数表中的最后消息
UPDATE unread_counts
SET 
  last_message = '你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。',
  last_message_time = NOW()
WHERE friend_id = 'clawbot';

-- 4. 验证更新结果
SELECT 
  friend_id,
  name,
  bio,
  created_at,
  updated_at
FROM friends
WHERE friend_id = 'clawbot';

-- 应该看到：
-- friend_id: clawbot
-- name: TRIX 机器人
-- created_at: (最新时间 - 置顶效果)

-- 5. 检查聊天记录
SELECT 
  friend_id,
  sender,
  text,
  created_at
FROM chat_messages
WHERE friend_id = 'clawbot'
ORDER BY created_at DESC
LIMIT 5;

-- 应该看到最新的欢迎消息：
-- "你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。"

-- ============================================
-- Clawbot Channel 数据库表结构（Supabase）
-- ============================================

-- 1. pairings 表：存储配对信息
CREATE TABLE IF NOT EXISTS pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_code TEXT UNIQUE NOT NULL,
  pairing_token TEXT UNIQUE,
  user_id UUID,
  device_id TEXT NOT NULL,
  device_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paired_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  socket_id TEXT
);

-- 索引：提高查询性能
CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code);
CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id);
CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id);
CREATE INDEX IF NOT EXISTS idx_status ON pairings(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_on_paired
  ON pairings(device_id) WHERE status = 'paired';
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_on_paired
  ON pairings(user_id) WHERE status = 'paired';

-- 2. chat_messages 表：存储聊天消息
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id TEXT,
  pairing_id UUID REFERENCES pairings(id),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  media_url TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot', 'app')),
  timestamp BIGINT NOT NULL,
  message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：提高查询性能
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_device_id ON chat_messages(device_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pairing_id ON chat_messages(pairing_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender);

-- 3. 启用 RLS (Row Level Security)
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略：允许匿名访问（因为 Clawbot Channel 不使用 Supabase Auth）
CREATE POLICY "允许所有人访问 pairings" ON pairings
  FOR ALL USING (true);

CREATE POLICY "允许所有人访问 chat_messages" ON chat_messages
  FOR ALL USING (true);

-- ============================================
-- 完成！
-- ============================================

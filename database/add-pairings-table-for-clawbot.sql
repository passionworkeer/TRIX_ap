-- ============================================
-- 🤖 Clawbot Channel - pairings 表
-- ============================================
-- **用途**: 存储 App 和 PC 端的配对信息
-- **执行方式**: 在 Supabase SQL Editor 中执行
-- ============================================

-- 创建 pairings 表
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

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code);
CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id);
CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id);
CREATE INDEX IF NOT EXISTS idx_status ON pairings(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_on_paired
  ON pairings(device_id) WHERE status = 'paired';
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_on_paired
  ON pairings(user_id) WHERE status = 'paired';

-- 启用 RLS (Row Level Security)
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：允许匿名访问（Clawbot Channel 不使用 Supabase Auth）
CREATE POLICY "允许所有人访问 pairings" ON pairings
  FOR ALL USING (true);

-- ============================================
-- ✅ 完成！
-- ============================================
-- 执行此 SQL 后，pairings 表将创建完成
-- 然后服务器代码将能够使用 Supabase 进行配对管理
-- ============================================

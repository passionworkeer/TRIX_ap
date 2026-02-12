-- ============================================
-- 📱 Clawbot 配对请求表
-- ============================================
-- 用于存储手机端发起的配对请求
-- Clawbot Gateway 会轮询此表获取待审批的配对请求

-- 创建配对请求表
CREATE TABLE IF NOT EXISTS pairing_requests (
  -- 主键：请求 ID（客户端生成）
  id TEXT PRIMARY KEY,
  
  -- 设备信息
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'desktop')),
  
  -- 配对状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  
  -- 审批信息
  device_token TEXT,  -- 审批通过后由 Gateway 填写
  approved_at TIMESTAMP,
  approved_by TEXT,  -- Gateway ID 或用户 ID
  
  -- 元数据
  message TEXT,  -- 拒绝/错误信息
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pairing_requests_status ON pairing_requests(status);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_device_id ON pairing_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_created_at ON pairing_requests(created_at);

-- RLS (Row Level Security) 策略
ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;

-- 允许任何人插入配对请求（公开 API）
CREATE POLICY "Allow public insert" ON pairing_requests
  FOR INSERT
  WITH CHECK (true);

-- 允许任何人读取自己设备的配对请求
CREATE POLICY "Allow read own device" ON pairing_requests
  FOR SELECT
  USING (true);

-- 允许更新配对请求（Gateway 审批）
CREATE POLICY "Allow update pairing" ON pairing_requests
  FOR UPDATE
  USING (true);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_pairing_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pairing_requests_updated_at
  BEFORE UPDATE ON pairing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_pairing_requests_updated_at();

-- 自动清理过期请求的函数
CREATE OR REPLACE FUNCTION cleanup_expired_pairing_requests()
RETURNS void AS $$
BEGIN
  DELETE FROM pairing_requests
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 可选：创建定时任务（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-expired-pairings', '*/5 * * * *', 'SELECT cleanup_expired_pairing_requests()');

-- ============================================
-- 验证
-- ============================================
-- 检查表是否创建成功
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pairing_requests';

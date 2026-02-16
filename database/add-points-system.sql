-- ============================================
-- 🎯 TRIX 3D Companion - 积分系统
-- ============================================
-- 创建时间: 2026-02-16
-- 用途: 用户积分激励系统
-- 功能:
--   - 用户通过专注学习获得积分
--   - 记录积分变动历史
--   - 支持积分查询和统计
-- ============================================

-- ============================================
-- 1. 用户积分表 (user_points)
-- ============================================
-- 存储用户的积分余额
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_total_points ON user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_level ON user_points(level);

-- 添加注释
COMMENT ON TABLE user_points IS '用户积分表';
COMMENT ON COLUMN user_points.user_id IS '用户ID';
COMMENT ON COLUMN user_points.total_points IS '总积分';
COMMENT ON COLUMN user_points.level IS '等级（基于积分计算）';

-- ============================================
-- 2. 积分交易记录表 (point_transactions)
-- ============================================
-- 记录所有积分变动历史
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL, -- 正数为获得，负数为消费
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'study_complete',      -- 完成专注学习
    'study_streak',        -- 连续学习奖励
    'daily_login',         -- 每日登录
    'achievement',         -- 成就解锁
    'social_share',        -- 社交分享
    'redeem',             -- 兑换奖励
    'admin_adjust'        -- 管理员调整
  )),
  description TEXT,
  metadata JSONB, -- 存储额外信息（如学习时长、连续天数等）
  balance_after INTEGER NOT NULL, -- 交易后的余额
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at DESC);

-- 添加注释
COMMENT ON TABLE point_transactions IS '积分交易记录表';
COMMENT ON COLUMN point_transactions.points_change IS '积分变化（正数=获得，负数=消费）';
COMMENT ON COLUMN point_transactions.transaction_type IS '交易类型';
COMMENT ON COLUMN point_transactions.metadata IS '额外信息（JSON格式）';
COMMENT ON COLUMN point_transactions.balance_after IS '交易后的余额';

-- ============================================
-- 3. 触发器：更新 updated_at 字段
-- ============================================
CREATE OR REPLACE FUNCTION update_user_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_points_updated_at ON user_points;
CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON user_points
  FOR EACH ROW EXECUTE FUNCTION update_user_points_updated_at();

-- ============================================
-- 4. 函数：计算用户等级
-- ============================================
-- 根据积分自动计算等级
CREATE OR REPLACE FUNCTION calculate_user_level(total_points INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF total_points < 100 THEN
    RETURN 1;
  ELSIF total_points < 500 THEN
    RETURN 2;
  ELSIF total_points < 1500 THEN
    RETURN 3;
  ELSIF total_points < 3000 THEN
    RETURN 4;
  ELSIF total_points < 6000 THEN
    RETURN 5;
  ELSIF total_points < 10000 THEN
    RETURN 6;
  ELSIF total_points < 15000 THEN
    RETURN 7;
  ELSIF total_points < 25000 THEN
    RETURN 8;
  ELSIF total_points < 40000 THEN
    RETURN 9;
  ELSE
    RETURN 10;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_user_level IS '根据积分计算用户等级（1-10级）';

-- ============================================
-- 5. 函数：添加积分
-- ============================================
-- 为用户添加积分并记录交易
CREATE OR REPLACE FUNCTION add_user_points(
  p_user_id UUID,
  p_points INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_new_level INTEGER;
BEGIN
  -- 获取当前积分
  SELECT COALESCE(total_points, 0) INTO v_current_points
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 计算新积分
  v_new_points := v_current_points + p_points;

  -- 确保积分不为负
  IF v_new_points < 0 THEN
    RAISE EXCEPTION '积分不足';
  END IF;

  -- 计算新等级
  v_new_level := calculate_user_level(v_new_points);

  -- 插入或更新用户积分
  INSERT INTO user_points (user_id, total_points, level)
  VALUES (p_user_id, v_new_points, v_new_level)
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_points = EXCLUDED.total_points,
    level = EXCLUDED.level,
    updated_at = NOW();

  -- 记录交易
  INSERT INTO point_transactions (
    user_id,
    points_change,
    transaction_type,
    description,
    metadata,
    balance_after
  ) VALUES (
    p_user_id,
    p_points,
    p_transaction_type,
    p_description,
    p_metadata,
    v_new_points
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_user_points IS '为用户添加积分并记录交易历史';

-- ============================================
-- 6. 函数：获取用户积分统计
-- ============================================
-- 返回用户的积分统计信息
CREATE OR REPLACE FUNCTION get_user_points_stats(p_user_id UUID)
RETURNS TABLE (
  total_points INTEGER,
  level INTEGER,
  today_earned INTEGER,
  week_earned INTEGER,
  total_transactions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(up.total_points, 0) AS total_points,
    COALESCE(up.level, 1) AS level,
    COALESCE(
      (SELECT COALESCE(SUM(pt.points_change), 0)
       FROM point_transactions pt
       WHERE pt.user_id = p_user_id
         AND pt.points_change > 0
         AND DATE(pt.created_at) = CURRENT_DATE),
      0
    ) AS today_earned,
    COALESCE(
      (SELECT COALESCE(SUM(pt.points_change), 0)
       FROM point_transactions pt
       WHERE pt.user_id = p_user_id
         AND pt.points_change > 0
         AND pt.created_at >= DATE_TRUNC('week', NOW())),
      0
    ) AS week_earned,
    COALESCE(
      (SELECT COUNT(*)
       FROM point_transactions pt
       WHERE pt.user_id = p_user_id),
      0
    ) AS total_transactions
  FROM user_points up
  WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_points_stats IS '获取用户积分统计信息';

-- ============================================
-- 7. 视图：用户积分概览
-- ============================================
CREATE OR REPLACE VIEW user_points_overview AS
SELECT
  u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  COALESCE(up.total_points, 0) AS total_points,
  COALESCE(up.level, 1) AS level,
  (
    SELECT COUNT(*)
    FROM point_transactions pt
    WHERE pt.user_id = u.id
      AND DATE(pt.created_at) = CURRENT_DATE
      AND pt.points_change > 0
  ) AS today_transactions
FROM profiles u
LEFT JOIN user_points up ON u.id = up.user_id
ORDER BY up.total_points DESC NULLS LAST;

COMMENT ON VIEW user_points_overview IS '用户积分排行榜';

-- ============================================
-- 8. 初始化现有用户的积分
-- ============================================
-- 为所有现有用户创建积分记录（初始为0）
INSERT INTO user_points (user_id, total_points, level)
SELECT id, 0, 1 FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 9. 启用 RLS
-- ============================================
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（开发模式：允许所有操作）
DROP POLICY IF EXISTS "Allow all user_points operations" ON user_points;
CREATE POLICY "Allow all user_points operations" ON user_points
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all point_transactions operations" ON point_transactions;
CREATE POLICY "Allow all point_transactions operations" ON point_transactions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 使用示例
-- ============================================
-- 添加积分示例：
-- SELECT add_user_points(
--   '11111111-1111-1111-1111-111111111111',
--   100,
--   'study_complete',
--   '完成30分钟专注学习',
--   '{"duration": 30, "subject": "数学"}'::jsonb
-- );

-- 查询积分统计：
-- SELECT * FROM get_user_points_stats('11111111-1111-1111-1111-111111111111');

-- 查询积分排行榜：
-- SELECT * FROM user_points_overview LIMIT 10;

-- ============================================
-- 完成！
-- ============================================
-- ✅ 积分系统已创建
-- 📊 包含2个表：user_points, point_transactions
-- 🔧 包含3个函数：calculate_user_level, add_user_points, get_user_points_stats
-- 📈 包含1个视图：user_points_overview
-- ============================================

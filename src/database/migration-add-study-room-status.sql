-- ============================================
-- 🎯 TRIX - 自习室状态字段迁移
-- ============================================
-- 创建时间: 2026-02-10
-- 用途: 为 study_room_members 表添加实时状态和心跳字段
-- ============================================

-- 添加 status 字段 (focusing, idle, away)
ALTER TABLE study_room_members 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle' 
CHECK (status IN ('focusing', 'idle', 'away'));

-- 添加 last_seen 字段 (最后活跃时间)
ALTER TABLE study_room_members 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 添加 display_name 字段 (显示名称)
ALTER TABLE study_room_members 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 添加 avatar_url 字段 (头像 URL)
ALTER TABLE study_room_members 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_study_room_members_status ON study_room_members(status);
CREATE INDEX IF NOT EXISTS idx_study_room_members_last_seen ON study_room_members(last_seen);

-- 创建一个辅助函数用于 upsert 自习室成员状态
CREATE OR REPLACE FUNCTION upsert_study_room_member(
  p_room_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_display_name TEXT,
  p_avatar_url TEXT
) RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  INSERT INTO study_room_members (
    room_id, 
    user_id, 
    status, 
    display_name, 
    avatar_url, 
    last_seen,
    is_active
  )
  VALUES (
    p_room_id, 
    p_user_id, 
    p_status, 
    p_display_name, 
    p_avatar_url, 
    NOW(),
    true
  )
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET
    status = EXCLUDED.status,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    last_seen = NOW(),
    is_active = true
  RETURNING id INTO v_member_id;
  
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql;

-- 创建一个清理过期成员的函数 (超过 5 分钟未活跃)
CREATE OR REPLACE FUNCTION cleanup_inactive_members() 
RETURNS void AS $$
BEGIN
  UPDATE study_room_members
  SET status = 'idle', is_active = false
  WHERE last_seen < NOW() - INTERVAL '5 minutes'
    AND status != 'idle';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ✅ 迁移完成！
-- ============================================
-- 
-- 新增字段：
-- - status: 'focusing' | 'idle' | 'away'
-- - last_seen: 最后活跃时间
-- - display_name: 显示名称
-- - avatar_url: 头像 URL
--
-- 新增函数：
-- - upsert_study_room_member(): 更新或插入成员状态
-- - cleanup_inactive_members(): 清理过期成员
--
-- ============================================

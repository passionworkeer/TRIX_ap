-- ============================================
-- 🚀 TRIX 3D Companion - 统一数据库初始化脚本
-- ============================================
-- **用途**: 一键初始化完整的数据库结构
-- **版本**: v1.2.0 (2026-02-17)
-- **执行方式**: 在Supabase SQL Editor中全选并执行
-- ============================================

-- ============================================
-- 第一部分：核心表结构
-- ============================================

-- 1.1 用户配置文件表（profiles）
-- 注意：id字段由Supabase Auth自动创建，这里只需要添加扩展字段
DO $$
BEGIN
    -- 添加扩展字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'username'
    ) THEN
        -- profiles表由Supabase Auth自动创建
        -- 这里只需要确认它存在
        NULL;
    END IF;
END $$;

-- 1.2 好友关系表（friends）
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 复合唯一约束（双向关系）
CREATE UNIQUE INDEX IF NOT EXISTS friends_user_id_friend_id_key
ON friends(user_id, friend_id);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- 1.3 聊天消息表（chat_messages）
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    message_type TEXT NOT NULL DEFAULT 'text',
    media_uri TEXT,
    media_type TEXT,
    media_size BIGINT,
    media_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type
ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_uri
ON chat_messages(media_uri) WHERE media_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_media
ON chat_messages(conversation_id, message_type);

-- 1.4 未读计数表（unread_counts）
CREATE TABLE IF NOT EXISTS unread_counts (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    unread_mail_count INTEGER NOT NULL DEFAULT 0,
    unread_notification_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 通知表（notifications）
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
ON notifications(is_read) WHERE is_read = false;

-- 1.6 邮件表（mails）
CREATE TABLE IF NOT EXISTS mails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mails_recipient_id
ON mails(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mails_is_read
ON mails(is_read) WHERE is_read = false;

-- 1.7 学习记录表（study_sessions）
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id
ON study_sessions(user_id);

-- 1.8 自习室表（study_rooms）
CREATE TABLE IF NOT EXISTS study_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    max_members INTEGER NOT NULL DEFAULT 10,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_created_by
ON study_rooms(created_by);

-- 1.9 自习室成员表（study_room_members）
CREATE TABLE IF NOT EXISTS study_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS study_room_members_room_user
ON study_room_members(room_id, user_id);

-- ============================================
-- 第二部分：扩展字段
-- ============================================

-- 2.1 添加学习状态字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'is_studying'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_studying BOOLEAN DEFAULT false;
        CREATE INDEX idx_profiles_is_studying ON profiles(is_studying) WHERE is_studying = true;
    END IF;
END $$;

-- 2.2 添加自习伙伴字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'companion_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN companion_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        CREATE INDEX idx_profiles_companion_id ON profiles(companion_id);
    END IF;
END $$;

-- 2.3 添加累计学习时长字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'total_study_time'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_study_time INTEGER DEFAULT 0;
        CREATE INDEX idx_profiles_total_study_time ON profiles(total_study_time) WHERE total_study_time > 0;
    END IF;
END $$;

-- 2.4 添加积分字段（向后兼容）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'points'
    ) THEN
        ALTER TABLE profiles ADD COLUMN points INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- 第三部分：功能模块表
-- ============================================

-- 3.1 配对请求表
CREATE TABLE IF NOT EXISTS pairing_requests (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    device_token TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    cancelled_at TIMESTAMPTZ,
    platform JSONB,
    user_agent TEXT,
    message TEXT,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_device_id
ON pairing_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_status
ON pairing_requests(status);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_expires_at
ON pairing_requests(expires_at) WHERE status = 'pending';

-- 配对请求触发器
CREATE OR REPLACE FUNCTION update_pairing_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pairing_requests_updated_at ON pairing_requests;
CREATE TRIGGER update_pairing_requests_updated_at BEFORE UPDATE ON pairing_requests
    FOR EACH ROW EXECUTE FUNCTION update_pairing_requests_updated_at();

-- 清理过期配对请求函数
CREATE OR REPLACE FUNCTION cleanup_expired_pairing_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM pairing_requests
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 3.2 用户积分表
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_total_points ON user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_level ON user_points(level);

-- 3.3 积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'study_complete',
        'study_streak',
        'daily_login',
        'achievement',
        'social_share',
        'redeem',
        'admin_adjust'
    )),
    description TEXT,
    metadata JSONB,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id
ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type
ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at
ON point_transactions(created_at DESC);

-- 3.4 用户隐私设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    allow_stranger_search BOOLEAN DEFAULT true,
    show_online_status BOOLEAN DEFAULT true,
    allow_study_invites BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- user_settings 触发器
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- user_points 触发器
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
-- 第四部分：视图
-- ============================================

-- 4.1 用户视图（简化profiles表）
CREATE OR REPLACE VIEW users AS
SELECT
    id,
    email,
    username,
    COALESCE(display_name, username) AS display_name,
    avatar_url,
    bio,
    created_at,
    updated_at
FROM profiles;

-- 4.2 好友最新消息视图
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT DISTINCT ON (user_id, friend_id)
    user_id,
    friend_id,
    content,
    created_at
FROM chat_messages
ORDER BY user_id, friend_id, created_at DESC;

-- 4.3 积分排行榜视图
CREATE OR REPLACE VIEW user_points_overview AS
SELECT
    p.id,
    p.username,
    up.total_points,
    up.level,
    RANK() OVER (ORDER BY up.total_points DESC) as rank,
    ROW_NUMBER() OVER (ORDER BY up.total_points DESC) as row_num
FROM profiles p
JOIN user_points up ON p.id = up.user_id
ORDER BY up.total_points DESC;

-- ============================================
-- 第五部分：辅助函数
-- ============================================

-- 5.1 计算用户等级
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
    ELSIF total_points < 5000 THEN
        RETURN 5;
    ELSE
        -- Level 6+: 每2000分升一级
        RETURN 5 + ((total_points - 5000) / 2000);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5.2 添加积分
CREATE OR REPLACE FUNCTION add_user_points(
    p_user_id UUID,
    p_points INTEGER,
    p_type TEXT,
    p_description TEXT
)
RETURNS void AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- 获取当前余额
    SELECT total_points INTO v_balance
    FROM user_points
    WHERE user_id = p_user_id;

    -- 如果记录不存在，插入新记录
    IF NOT FOUND THEN
        INSERT INTO user_points (user_id, total_points)
        VALUES (p_user_id, p_points);
        v_balance := p_points;
    ELSE
        -- 更新积分
        UPDATE user_points
        SET total_points = total_points + p_points,
            level = calculate_user_level(total_points + p_points)
        WHERE user_id = p_user_id;
        v_balance := total_points + p_points;
    END IF;

    -- 记录交易
    INSERT INTO point_transactions (user_id, points_change, transaction_type, description, balance_after)
    VALUES (p_user_id, p_points, p_type, p_description, v_balance);
END;
$$ LANGUAGE plpgsql;

-- 5.3 获取积分统计
CREATE OR REPLACE FUNCTION get_user_points_stats(p_user_id UUID)
RETURNS TABLE(
    total_points INTEGER,
    level INTEGER,
    next_level_points INTEGER,
    points_to_next_level INTEGER,
    total_transactions BIGINT
) AS $$
DECLARE
    v_level INTEGER;
    v_points INTEGER;
BEGIN
    SELECT level, total_points
    INTO v_level, v_points
    FROM user_points
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        v_level := 1;
        v_points := 0;
    END IF;

    RETURN QUERY
    SELECT
        v_points,
        v_level,
        CASE
            WHEN v_level >= 5 THEN (v_level + 1) * 2000
            ELSE 100
        END as next_level_points,
        CASE
            WHEN v_level >= 5 THEN ((v_level + 1) * 2000) - v_points
            WHEN v_level = 1 THEN 100 - v_points
            WHEN v_level = 2 THEN 500 - v_points
            WHEN v_level = 3 THEN 1500 - v_points
            WHEN v_level = 4 THEN 3000 - v_points
            ELSE 5000 - v_points
        END as points_to_next_level,
        (SELECT COUNT(*) FROM point_transactions WHERE user_id = p_user_id)
    ;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 第六部分：RLS 策略（行级安全）
-- ============================================

-- 启用RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- user_settings 策略
CREATE POLICY IF NOT EXISTS "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 第七部分：初始化数据
-- ============================================

-- 为现有用户创建积分记录（如果有profiles但没有user_points）
INSERT INTO user_points (user_id, total_points, level)
SELECT
    id,
    COALESCE(points, 0),
    CASE
        WHEN COALESCE(points, 0) >= 5000 THEN 5
        WHEN COALESCE(points, 0) >= 3000 THEN 4
        WHEN COALESCE(points, 0) >= 1500 THEN 3
        WHEN COALESCE(points, 0) >= 500 THEN 2
        ELSE 1
    END
FROM profiles
WHERE NOT EXISTS (
    SELECT 1 FROM user_points WHERE user_points.user_id = profiles.id
);

-- 为现有用户创建设置记录（如果有profiles但没有user_settings）
INSERT INTO user_settings (user_id)
SELECT id
FROM profiles
WHERE NOT EXISTS (
    SELECT 1 FROM user_settings WHERE user_settings.user_id = profiles.id
);

-- ============================================
-- 第八部分：验证
-- ============================================

-- 查询所有创建的表
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '========================================';

    RAISE NOTICE '创建的表数量: %',
        (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE');

    RAISE NOTICE '创建的视图数量: %',
        (SELECT COUNT(*) FROM information_schema.views
         WHERE table_schema = 'public');

    RAISE NOTICE '外键关系数量: %',
        (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = 'public'
         AND constraint_type = 'FOREIGN KEY');
END $$;

-- 显示表列表
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- ✅ 初始化完成
-- ============================================

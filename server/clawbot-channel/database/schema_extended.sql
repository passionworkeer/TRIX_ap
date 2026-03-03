-- ============================================
-- TRIX3D 扩展数据库 Schema
-- 创建日期: 2026-03-03
-- 说明: 聊天、学习、配对、地点、积分、快照、通知
-- ============================================

-- ============================================
-- 1. 聊天相关表
-- ============================================

-- 聊天房间表
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    last_message_id UUID,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);

-- 聊天参与者在 rooms 表中 (别名 chat_room_participants)
CREATE TABLE IF NOT EXISTS chat_room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'owner')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_participants_room ON chat_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_participants_user ON chat_room_participants(user_id);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'voice')),
    media_url TEXT,
    reply_to_id UUID REFERENCES chat_messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ============================================
-- 2. 学习相关表
-- ============================================

-- 学习记录表
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    subject TEXT,
    topic TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_start ON study_sessions(start_time);

-- 学习统计表
CREATE TABLE IF NOT EXISTS study_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    total_study_time INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    subjects JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_study_stats_user_date ON study_stats(user_id, date);

-- ============================================
-- 3. 配对相关表
-- ============================================

-- 配对请求表
CREATE TABLE IF NOT EXISTS pairing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_id UUID,
    device_name TEXT,
    device_type TEXT DEFAULT 'bot' CHECK (device_type IN ('bot', 'phone', 'tablet')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    token TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairing_requests_user ON pairing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_token ON pairing_requests(token);

-- 已配对设备表
CREATE TABLE IF NOT EXISTS paired_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_id UUID NOT NULL,
    device_name TEXT,
    device_type TEXT DEFAULT 'bot',
    paired_at TIMESTAMPTZ DEFAULT NOW(),
    last_connected_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_paired_devices_user ON paired_devices(user_id);

-- ============================================
-- 4. 地点相关表
-- ============================================

-- 地点/位置表
CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    category TEXT,
    tags TEXT[],
    rating DECIMAL(2, 1),
    image_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_location ON places(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);

-- 用户地点收藏表
CREATE TABLE IF NOT EXISTS place_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_place_favorites_user ON place_favorites(user_id);

-- 用户位置分享表
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    altitude DECIMAL(8, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    timestamp TIMESTAMPTZ NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_timestamp ON user_locations(timestamp);

-- ============================================
-- 5. 积分相关表 (扩展)
-- ============================================

-- 积分表 (如果不存在)
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);

-- 积分变动记录表 (如果不存在)
CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'deduct', 'refund')),
    reason TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at);

-- ============================================
-- 6. 快照相关表
-- ============================================

-- AI 快照表
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    analysis_text TEXT,
    analysis_type TEXT DEFAULT 'general',
    tags TEXT[],
    score DECIMAL(5, 2),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at);

-- ============================================
-- 7. 通知相关表
-- ============================================

-- 用户通知表
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- 设备令牌表
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    app_version TEXT,
    device_model TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- ============================================
-- 8. RLS 策略 (Row Level Security)
-- ============================================

-- 聊天房间 RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 学习记录 RLS
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_stats ENABLE ROW LEVEL SECURITY;

-- 配对 RLS
ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE paired_devices ENABLE ROW LEVEL SECURITY;

-- 地点 RLS
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- 快照 RLS
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- 通知 RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 聊天房间: 用户只能看到自己参与的房间
CREATE POLICY "Users can view own chat rooms" ON chat_rooms
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- 消息: 用户只能看到自己房间的消息
CREATE POLICY "Users can view own room messages" ON chat_messages
    FOR SELECT USING (
        room_id IN (SELECT room_id FROM chat_room_participants WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert messages" ON chat_messages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

-- 学习记录: 用户只能看到自己的
CREATE POLICY "Users can view own study sessions" ON study_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert study sessions" ON study_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 配对: 用户只能看到自己的
CREATE POLICY "Users can view own pairing requests" ON pairing_requests
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own paired devices" ON paired_devices
    FOR SELECT USING (user_id = auth.uid());

-- 地点收藏: 用户只能看到自己的
CREATE POLICY "Users can view own place favorites" ON place_favorites
    FOR SELECT USING (user_id = auth.uid());

-- 快照: 用户只能看到自己的
CREATE POLICY "Users can view own snapshots" ON snapshots
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert snapshots" ON snapshots
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 通知: 用户只能看到自己的
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 积分: 用户只能看到自己的
CREATE POLICY "Users can view own points" ON user_points
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own points transactions" ON points_transactions
    FOR SELECT USING (user_id = auth.uid());

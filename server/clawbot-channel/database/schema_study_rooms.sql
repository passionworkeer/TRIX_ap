-- ============================================
-- TRIX3D 学习房间数据库 Schema
-- ============================================

-- 学习房间表
CREATE TABLE IF NOT EXISTS study_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT,
    host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    description TEXT,
    max_participants INTEGER DEFAULT 5,
    current_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'paused', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_rooms_code ON study_rooms(code);
CREATE INDEX IF NOT EXISTS idx_study_rooms_host ON study_rooms(host_id);

-- 学习房间参与者表
CREATE TABLE IF NOT EXISTS study_room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES study_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'participant', 'observer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_room_participants_room ON study_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_study_room_participants_user ON study_room_participants(user_id);

-- RLS
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view study rooms" ON study_rooms
    FOR SELECT USING (true);

CREATE POLICY "Users can create study rooms" ON study_rooms
    FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can view room participants" ON study_room_participants
    FOR SELECT USING (true);

CREATE POLICY "Users can join study rooms" ON study_room_participants
    FOR INSERT WITH CHECK (user_id = auth.uid());

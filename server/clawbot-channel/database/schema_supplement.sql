-- ============================================
-- TRIX3D 补充数据库 Schema
-- 添加遗漏的表
-- ============================================

-- 未读消息计数表
CREATE TABLE IF NOT EXISTS unread_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    unread_count INTEGER DEFAULT 0,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_unread_counts_user ON unread_counts(user_id);

-- RLS
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unread counts" ON unread_counts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own unread counts" ON unread_counts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own unread counts" ON unread_counts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 用户配置表 (扩展 profiles)
-- ============================================

-- 添加通知偏好字段到 profiles (如果不存在)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"push_enabled": true, "study_reminder": true, "friend_request": true, "system_notification": true}';

-- ============================================
-- AI 对话/Clawbot 消息表
-- ============================================

CREATE TABLE IF NOT EXISTS clawbot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clawbot_conversations_user ON clawbot_conversations(user_id);

CREATE TABLE IF NOT EXISTS clawbot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES clawbot_conversations(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    tokens INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clawbot_messages_conversation ON clawbot_messages(conversation_id);

-- RLS
ALTER TABLE clawbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON clawbot_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations" ON clawbot_conversations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own messages" ON clawbot_messages
    FOR SELECT USING (
        conversation_id IN (SELECT id FROM clawbot_conversations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create messages" ON clawbot_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (SELECT id FROM clawbot_conversations WHERE user_id = auth.uid())
    );

-- ============================================
-- 学习目标表
-- ============================================

CREATE TABLE IF NOT EXISTS study_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    target_minutes INTEGER NOT NULL,
    current_minutes INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_goals_user ON study_goals(user_id);

ALTER TABLE study_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study goals" ON study_goals
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create study goals" ON study_goals
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own study goals" ON study_goals
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete study goals" ON study_goals
    FOR DELETE USING (user_id = auth.uid());

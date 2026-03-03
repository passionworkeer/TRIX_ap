-- ============================================
-- TRIX3D MVP 数据库 Schema
-- 创建日期: 2026-03-03
-- 说明: 用户、好友、日程、待办、成就、商城、衣柜、学习历史
-- ============================================

-- ============================================
-- 1. 扩展 profiles 表 (如果不存在)
-- ============================================

-- 添加用户扩展字段
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_active INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_study_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES auth.users(id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_points ON profiles(points);
CREATE INDEX IF NOT EXISTS idx_profiles_days_active ON profiles(days_active);

-- ============================================
-- 2. 好友关系表
-- ============================================

CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'away')),
    bio TEXT,
    study_time INTEGER DEFAULT 0,
    is_studying BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- ============================================
-- 3. 好友请求表
-- ============================================

CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id, status);

-- ============================================
-- 4. 日程表
-- ============================================

CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    reminder_minutes_before INTEGER,
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);

-- ============================================
-- 5. 待办事项表
-- ============================================

CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT false,
    due_date TIMESTAMPTZ,
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_is_completed ON todos(is_completed);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

-- ============================================
-- 6. 成就表
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT NOT NULL,
    requirement INTEGER NOT NULL,
    type TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    achievement_id TEXT REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ============================================
-- 7. 商城商品表
-- ============================================

CREATE TABLE IF NOT EXISTS mall_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    price INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('clothing', 'accessory', 'prop')),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_purchased_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id(id) ON DELETE UUID REFERENCES mall_items CASCADE NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mall_items_category ON mall_items(category, is_active);
CREATE INDEX IF NOT EXISTS idx_user_purchased_items_user ON user_purchased_items(user_id);

-- ============================================
-- 8. 装扮/衣柜表
-- ============================================

CREATE TABLE IF NOT EXISTS outfits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('hair', 'top', 'bottom', 'shoes', 'accessory', 'background')),
    image_url TEXT,
    preview_image_url TEXT,
    description TEXT,
    price INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_outfits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE NOT NULL,
    is_equipped BOOLEAN DEFAULT false,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, outfit_id)
);

CREATE INDEX IF NOT EXISTS idx_user_outfits_user ON user_outfits(user_id, is_equipped);

-- ============================================
-- 9. 用户积分表
-- ============================================

CREATE TABLE IF NOT EXISTS user_points (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. 积分交易记录表
-- ============================================

CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'refund')),
    description TEXT,
    related_item_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);

-- ============================================
-- 11. 购买历史表
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES mall_items(id) ON DELETE CASCADE NOT NULL,
    points_spent INTEGER NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_user ON purchase_history(user_id);

-- ============================================
-- 12. 学习会话表 (扩展)
-- ============================================

-- 添加 companion_id 字段用于记录一起学习的用户
ALTER TABLE IF EXISTS study_sessions
ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES auth.users(id);

-- ============================================
-- 13. 初始化默认数据
-- ============================================

-- 初始化成就数据
INSERT INTO achievements (id, name, name_en, description, icon, category, requirement, type, rarity) VALUES
('duration_10', '初学者', 'Beginner', '累计专注 10 分钟', '🌱', 'duration', 10, 'total_minutes', 'common'),
('duration_60', '一小时学者', 'Hour Scholar', '累计专注 60 分钟', '📖', 'duration', 60, 'total_minutes', 'common'),
('duration_300', '五小时大师', 'Five Hour Master', '累计专注 300 分钟', '🎓', 'duration', 300, 'total_minutes', 'rare'),
('duration_1000', '千分钟达人', 'Thousand Minute Pro', '累计专注 1000 分钟', '🏆', 'duration', 1000, 'total_minutes', 'epic'),
('duration_5000', '专注传奇', 'Focus Legend', '累计专注 5000 分钟', '👑', 'duration', 5000, 'total_minutes', 'legendary'),
('single_25', '番茄达人', 'Pomodoro Master', '单次专注 25 分钟', '🍅', 'duration', 25, 'single_session', 'common'),
('single_45', '深度学习者', 'Deep Learner', '单次专注 45 分钟', '🧠', 'duration', 45, 'single_session', 'rare'),
('single_60', '一小时王者', 'Hour Champion', '单次专注 60 分钟', '⚡', 'duration', 60, 'single_session', 'epic'),
('streak_3', '三天坚持', 'Three Day Streak', '连续学习 3 天', '🔥', 'streak', 3, 'daily_streak', 'common'),
('streak_7', '一周达人', 'Week Warrior', '连续学习 7 天', '💪', 'streak', 7, 'daily_streak', 'rare'),
('streak_30', '月度冠军', 'Monthly Champion', '连续学习 30 天', '🌟', 'streak', 30, 'daily_streak', 'epic'),
('streak_100', '百日英雄', 'Hundred Day Hero', '连续学习 100 天', '🦸', 'streak', 100, 'daily_streak', 'legendary'),
('social_first', '结伴学习', 'Study Buddy', '和好友一起学习 1 次', '🤝', 'social', 1, 'friends_studied', 'common'),
('social_10', '学习伙伴', 'Learning Partner', '和好友一起学习 10 次', '👥', 'social', 10, 'friends_studied', 'rare'),
('early_bird', '早起鸟', 'Early Bird', '在早上 7 点前开始学习', '🌅', 'special', 1, 'early_bird', 'rare'),
('night_owl', '夜猫子', 'Night Owl', '在晚上 10 点后开始学习', '🦉', 'special', 1, 'night_owl', 'rare'),
('perfect_month', '完美月份', 'Perfect Month', '一个月内每天都有学习', '📅', 'milestone', 30, 'perfect_month', 'legendary')
ON CONFLICT (id) DO NOTHING;

-- 初始化商城商品数据
INSERT INTO mall_items (name, description, image_url, price, category, display_order) VALUES
('学习套装', '专注学习的必备套装', 'https://example.com/item1.png', 100, 'clothing', 1),
('效率徽章', '提升学习效率的徽章', 'https://example.com/item2.png', 50, 'accessory', 2),
('背景主题', '学习背景主题', 'https://example.com/item3.png', 30, 'prop', 3)
ON CONFLICT DO NOTHING;

-- 初始化装扮数据
INSERT INTO outfits (name, category, image_url, price) VALUES
('默认发型', 'hair', 'https://example.com/hair1.png', 0),
('酷炫发型', 'hair', 'https://example.com/hair2.png', 100),
('休闲上衣', 'top', 'https://example.com/top1.png', 0),
('正装上衣', 'top', 'https://example.com/top2.png', 150),
('舒适裤子', 'bottom', 'https://example.com/bottom1.png', 0),
('运动鞋', 'shoes', 'https://example.com/shoes1.png', 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- 14. 创建 RLS 策略 (行级安全)
-- ============================================

-- 好友表 RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own friends" ON friends;
CREATE POLICY "users can manage own friends" ON friends
    FOR ALL USING (auth.uid() = user_id);

-- 好友请求表 RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own friend requests" ON friend_requests;
CREATE POLICY "users can manage own friend requests" ON friend_requests
    FOR ALL USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- 日程表 RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own schedules" ON schedules;
CREATE POLICY "users can manage own schedules" ON schedules
    FOR ALL USING (auth.uid() = user_id);

-- 待办表 RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own todos" ON todos;
CREATE POLICY "users can manage own todos" ON todos
    FOR ALL USING (auth.uid() = user_id);

-- 用户成就表 RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own achievements" ON user_achievements;
CREATE POLICY "users can view own achievements" ON user_achievements
    FOR ALL USING (auth.uid() = user_id);

-- 用户购买表 RLS
ALTER TABLE user_purchased_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own purchases" ON user_purchased_items;
CREATE POLICY "users can view own purchases" ON user_purchased_items
    FOR ALL USING (auth.uid() = user_id);

-- 用户装扮表 RLS
ALTER TABLE user_outfits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own outfits" ON user_outfits;
CREATE POLICY "users can view own outfits" ON user_outfits
    FOR ALL USING (auth.uid() = user_id);

-- 用户积分表 RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own points" ON user_points;
CREATE POLICY "users can manage own points" ON user_points
    FOR ALL USING (auth.uid() = user_id);

-- 积分交易记录表 RLS
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own transactions" ON points_transactions;
CREATE POLICY "users can view own transactions" ON points_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 购买历史表 RLS
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own purchase history" ON purchase_history;
CREATE POLICY "users can view own purchase history" ON purchase_history
    FOR ALL USING (auth.uid() = user_id);

-- 成就表公开读取
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can view achievements" ON achievements;
CREATE POLICY "anyone can view achievements" ON achievements
    FOR SELECT USING (true);

-- 商城商品表公开读取
ALTER TABLE mall_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can view active mall items" ON mall_items;
CREATE POLICY "anyone can view active mall items" ON mall_items
    FOR SELECT USING (is_active = true);

-- 装扮表公开读取
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can view active outfits" ON outfits;
CREATE POLICY "anyone can view active outfits" ON outfits
    FOR SELECT USING (is_active = true);

-- ============================================
-- 完成
-- ============================================
SELECT 'Database schema created successfully!' as result;

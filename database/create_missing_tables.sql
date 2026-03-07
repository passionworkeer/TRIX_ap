-- ============================================
-- TRIX 3D Companion 数据库补充表
-- 执行时间: 2026-03-06
-- 说明: MVP 必需的表缺失，需要创建
-- ============================================

-- ============================================
-- 1. 好友请求表
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

-- RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own friend requests" ON friend_requests;
CREATE POLICY "users can manage own friend requests" ON friend_requests
    FOR ALL USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ============================================
-- 2. 待办事项表
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

-- RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own todos" ON todos;
CREATE POLICY "users can manage own todos" ON todos FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. 日程表
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

-- RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own schedules" ON schedules;
CREATE POLICY "users can manage own schedules" ON schedules FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 4. 成就表
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

-- 插入默认成就数据
INSERT INTO achievements (id, name, name_en, description, icon, category, requirement, type, rarity) VALUES
('duration_10', '初学者', 'Beginner', '累计专注 10 分钟', '🌱', 'duration', 10, 'total_minutes', 'common'),
('duration_60', '一小时学者', 'Hour Scholar', '累计专注 60 分钟', '📖', 'duration', 60, 'total_minutes', 'common'),
('duration_300', '五小时大师', 'Five Hour Master', '累计专注 300 分钟', '🎓', 'duration', 300, 'total_minutes', 'rare'),
('duration_1000', '千分钟达人', 'Thousand Minute Pro', '累计专注 1000 分钟', '🏆', 'duration', 1000, 'total_minutes', 'epic'),
('streak_3', '三天坚持', 'Three Day Streak', '连续学习 3 天', '🔥', 'streak', 3, 'daily_streak', 'common'),
('streak_7', '一周达人', 'Week Warrior', '连续学习 7 天', '💪', 'streak', 7, 'daily_streak', 'rare')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements are viewable by everyone" ON achievements FOR SELECT USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own achievements" ON user_achievements;
CREATE POLICY "users can manage own achievements" ON user_achievements FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 5. 商城商品表
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
    item_id UUID REFERENCES mall_items(id) ON DELETE CASCADE NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mall_items_category ON mall_items(category, is_active);
CREATE INDEX IF NOT EXISTS idx_user_purchased_items_user ON user_purchased_items(user_id);

-- 插入默认商品
INSERT INTO mall_items (name, description, image_url, price, category, display_order) VALUES
('学习套装', '专注学习的必备套装', 'https://example.com/item1.png', 100, 'clothing', 1),
('效率徽章', '提升学习效率的徽章', 'https://example.com/item2.png', 50, 'accessory', 2),
('背景主题', '学习背景主题', 'https://example.com/item3.png', 30, 'prop', 3)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE mall_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mall_items are viewable by everyone" ON mall_items FOR SELECT USING (true);

ALTER TABLE user_purchased_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own purchased items" ON user_purchased_items;
CREATE POLICY "users can manage own purchased items" ON user_purchased_items FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 6. 装扮/衣柜表
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

-- 插入默认装扮
INSERT INTO outfits (name, category, image_url, price) VALUES
('默认发型', 'hair', 'https://example.com/hair1.png', 0),
('酷炫发型', 'hair', 'https://example.com/hair2.png', 100),
('休闲上衣', 'top', 'https://example.com/top1.png', 0),
('正装上衣', 'top', 'https://example.com/top2.png', 150),
('舒适裤子', 'bottom', 'https://example.com/bottom1.png', 0),
('运动鞋', 'shoes', 'https://example.com/shoes1.png', 0)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outfits are viewable by everyone" ON outfits FOR SELECT USING (true);

ALTER TABLE user_outfits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own outfits" ON user_outfits;
CREATE POLICY "users can manage own outfits" ON user_outfits FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 7. 积分交易记录表
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

-- RLS
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own points transactions" ON points_transactions;
CREATE POLICY "users can manage own points transactions" ON points_transactions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 8. 购买历史表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES mall_items(id) ON DELETE CASCADE NOT NULL,
    points_spent INTEGER NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_user ON purchase_history(user_id);

-- RLS
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can manage own purchase history" ON purchase_history;
CREATE POLICY "users can manage own purchase history" ON purchase_history FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 验证创建结果
-- ============================================
SELECT 'friend_requests' as table_name, count(*) as rows FROM friend_requests
UNION ALL
SELECT 'todos', count(*) FROM todos
UNION ALL
SELECT 'schedules', count(*) FROM schedules
UNION ALL
SELECT 'achievements', count(*) FROM achievements
UNION ALL
SELECT 'user_achievements', count(*) FROM user_achievements
UNION ALL
SELECT 'mall_items', count(*) FROM mall_items
UNION ALL
SELECT 'user_purchased_items', count(*) FROM user_purchased_items
UNION ALL
SELECT 'outfits', count(*) FROM outfits
UNION ALL
SELECT 'user_outfits', count(*) FROM user_outfits
UNION ALL
SELECT 'points_transactions', count(*) FROM points_transactions
UNION ALL
SELECT 'purchase_history', count(*) FROM purchase_history;

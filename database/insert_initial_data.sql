-- ============================================
-- 插入初始数据 (修正版)
-- 执行时间: 2026-03-06
-- ============================================

-- ============================================
-- 1. 成就数据
-- ============================================
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

-- ============================================
-- 2. 商城商品数据 (修正: 移除 display_order)
-- ============================================
INSERT INTO mall_items (name, description, image_url, price, category) VALUES
('学习套装', '专注学习的必备套装，包含高效学习工具', 'https://example.com/item1.png', 100, 'clothing'),
('效率徽章', '提升学习效率的徽章，专注力+10%', 'https://example.com/item2.png', 50, 'accessory'),
('背景主题', '学习背景主题，让学习更有氛围', 'https://example.com/item3.png', 30, 'prop'),
('能量饮料', '学习时补充能量，效率+20%', 'https://example.com/item4.png', 80, 'prop'),
('静音键盘', '安静的键盘，不打扰他人', 'https://example.com/item5.png', 150, 'accessory')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 装扮/衣柜数据 (修正: 移除多余字段)
-- ============================================
INSERT INTO outfits (name, category, image_url, description, price) VALUES
('默认发型', 'hair', 'https://example.com/hair1.png', '默认发型', 0),
('酷炫发型', 'hair', 'https://example.com/hair2.png', '潮流酷炫发型', 100),
('淑女发型', 'hair', 'https://example.com/hair3.png', '温婉淑女发型', 150),
('休闲上衣', 'top', 'https://example.com/top1.png', '舒适休闲上衣', 0),
('正装上衣', 'top', 'https://example.com/top2.png', '正式场合上衣', 150),
('运动上衣', 'top', 'https://example.com/top3.png', '运动风格上衣', 80),
('舒适裤子', 'bottom', 'https://example.com/bottom1.png', '舒适日常裤子', 0),
('正装裤子', 'bottom', 'https://example.com/bottom2.png', '正式场合裤子', 100),
('运动鞋', 'shoes', 'https://example.com/shoes1.png', '舒适运动鞋', 0),
('皮鞋', 'shoes', 'https://example.com/shoes2.png', '正式皮鞋', 120),
('基础配饰', 'accessory', 'https://example.com/acc1.png', '简约基础配饰', 0),
('时尚配饰', 'accessory', 'https://example.com/acc2.png', '潮流时尚配饰', 80),
('默认背景', 'background', 'https://example.com/bg1.png', '默认学习背景', 0),
('星空背景', 'background', 'https://example.com/bg2.png', '璀璨星空背景', 50),
('自然背景', 'background', 'https://example.com/bg3.png', '清新自然背景', 50)
ON CONFLICT DO NOTHING;

-- ============================================
-- 验证数据插入结果
-- ============================================
SELECT 'achievements' as table_name, count(*) as rows FROM achievements
UNION ALL
SELECT 'mall_items', count(*) FROM mall_items
UNION ALL
SELECT 'outfits', count(*) FROM outfits;

USE trix_companion;

INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'test1@trix.app', 'testuser1', 'trix-demo-salt-01:CnSyc8o0i0LtC62yh2zlNW5GmaN31zCGLh2hv2Ev8Ks0e2xsiTfUIxwkaGZTgYTHVuL2CToRGccwZrm_NWUP6Q', NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'test2@trix.app', 'testuser2', 'trix-demo-salt-02:HeMFJmZN_TVasiCRWG7XORXIFh8XrWXNn90KH-jW94oBus824k3_aZt9fvri3D0T_xd9w7DgLUs2GIEsnHIjJg', NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'test3@trix.app', 'mentor3', 'trix-demo-salt-03:IM9klpyqtBiuZltAXhry8YktUojVdbFaVHa_O_cl0AKCPXDyUjv0Dg4VXe31WwQXsI3igF6C0fuH-epxMTCYcg', NOW(), NOW())
ON DUPLICATE KEY UPDATE
email = VALUES(email),
username = VALUES(username),
password_hash = VALUES(password_hash),
updated_at = VALUES(updated_at);

INSERT INTO profiles (
  id, username, email, avatar_url, full_name, display_name, bio, points, website,
  is_studying, companion_id, total_study_time, last_active_at, current_streak,
  days_active, interaction_count, show_online_status, school, grade, active_session_id,
  created_at, updated_at
) VALUES
('11111111-1111-1111-1111-111111111111', 'testuser1', 'test1@trix.app', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', '测试用户一', '测试用户一', 'TRIX Web 演示账号', 1280, 'https://trix.example.com', 1, NULL, 540, DATE_SUB(NOW(), INTERVAL 3 MINUTE), 7, 21, 38, 1, 'TRIX 实验中学', '高二', NULL, NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'testuser2', 'test2@trix.app', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', '测试用户二', '测试用户二', '学习搭子', 860, 'https://trix.example.com', 0, NULL, 420, DATE_SUB(NOW(), INTERVAL 18 MINUTE), 4, 15, 22, 1, 'TRIX 实验中学', '高一', NULL, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'mentor3', 'test3@trix.app', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', '学习导师三', '学习导师三', '负责课堂演示', 2200, 'https://trix.example.com', 0, NULL, 1260, DATE_SUB(NOW(), INTERVAL 2 HOUR), 12, 45, 61, 1, 'TRIX 实验中学', '高三', NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE
username = VALUES(username),
email = VALUES(email),
avatar_url = VALUES(avatar_url),
full_name = VALUES(full_name),
display_name = VALUES(display_name),
bio = VALUES(bio),
points = VALUES(points),
website = VALUES(website),
is_studying = VALUES(is_studying),
companion_id = VALUES(companion_id),
total_study_time = VALUES(total_study_time),
last_active_at = VALUES(last_active_at),
current_streak = VALUES(current_streak),
days_active = VALUES(days_active),
interaction_count = VALUES(interaction_count),
show_online_status = VALUES(show_online_status),
school = VALUES(school),
grade = VALUES(grade),
active_session_id = VALUES(active_session_id),
updated_at = VALUES(updated_at);

UPDATE profiles
SET companion_id = CASE id
  WHEN '11111111-1111-1111-1111-111111111111' THEN '22222222-2222-2222-2222-222222222222'
  WHEN '22222222-2222-2222-2222-222222222222' THEN '11111111-1111-1111-1111-111111111111'
  ELSE NULL
END
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

INSERT INTO user_points (id, user_id, total_points, level, total_earned, total_spent, created_at, updated_at) VALUES
('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1280, 13, 1680, 400, NOW(), NOW()),
('aaaaaaaa-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 860, 9, 920, 60, NOW(), NOW()),
('aaaaaaaa-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 2200, 22, 2200, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
total_points = VALUES(total_points),
level = VALUES(level),
total_earned = VALUES(total_earned),
total_spent = VALUES(total_spent),
updated_at = VALUES(updated_at);

INSERT INTO friends (id, user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at, updated_at) VALUES
('bbbbbbbb-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '测试用户二', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', 'accepted', '学习搭子', 420, 0, NOW(), NOW()),
('bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '测试用户一', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'accepted', 'TRIX Web 演示账号', 540, 1, NOW(), NOW()),
('bbbbbbbb-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '学习导师三', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 'accepted', '负责课堂演示', 1260, 0, NOW(), NOW()),
('bbbbbbbb-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '测试用户一', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'accepted', 'TRIX Web 演示账号', 540, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
name = VALUES(name),
avatar_url = VALUES(avatar_url),
status = VALUES(status),
bio = VALUES(bio),
study_time = VALUES(study_time),
is_studying = VALUES(is_studying),
updated_at = VALUES(updated_at);

INSERT INTO unread_counts (id, user_id, friend_id, unread_count, last_message, last_message_time, updated_at) VALUES
('cccccccc-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 2, '今天的进度不错，继续保持。', DATE_SUB(NOW(), INTERVAL 12 MINUTE), NOW()),
('cccccccc-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, '收到，晚点一起复盘。', DATE_SUB(NOW(), INTERVAL 12 MINUTE), NOW())
ON DUPLICATE KEY UPDATE
unread_count = VALUES(unread_count),
last_message = VALUES(last_message),
last_message_time = VALUES(last_message_time),
updated_at = VALUES(updated_at);

INSERT INTO chat_messages (id, conversation_id, sender_id, receiver_id, text, is_read, message_type, created_at) VALUES
('dddddddd-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '今天一起把数据库作业收尾。', 1, 'text', DATE_SUB(NOW(), INTERVAL 35 MINUTE)),
('dddddddd-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '可以，先把 MySQL schema 跑通。', 0, 'text', DATE_SUB(NOW(), INTERVAL 28 MINUTE)),
('dddddddd-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '演示账号已经准备好了。', 0, 'text', DATE_SUB(NOW(), INTERVAL 1 HOUR))
ON DUPLICATE KEY UPDATE
text = VALUES(text),
is_read = VALUES(is_read);

INSERT INTO notifications (id, user_id, type, title, content, avatar_url, is_read, created_at) VALUES
('eeeeeeee-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'friend_request', '好友请求', '学习导师三 想添加你为好友', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 0, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('eeeeeeee-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'study', '学习提醒', '今晚 20:00 有复盘任务。', NULL, 0, DATE_SUB(NOW(), INTERVAL 3 HOUR))
ON DUPLICATE KEY UPDATE
title = VALUES(title),
content = VALUES(content),
avatar_url = VALUES(avatar_url),
is_read = VALUES(is_read),
created_at = VALUES(created_at);

INSERT INTO mails (id, user_id, from_user_id, from_name, from_avatar, subject, preview, content, is_read, created_at) VALUES
('ffffffff-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '学习导师三', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 'TRIX Web 端作业说明', '请按要求完成 MySQL 迁移版演示。', '请在 Web 端完成菜单迁移、MySQL 登录和作业材料整理。', 0, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('ffffffff-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NULL, '系统通知', NULL, '积分到账', '完成学习后已发放积分。', '你在一次学习记录中获得了 40 积分。', 1, DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE
subject = VALUES(subject),
preview = VALUES(preview),
content = VALUES(content),
is_read = VALUES(is_read),
created_at = VALUES(created_at);

INSERT INTO todos (id, user_id, title, description, completed, priority, due_date, tags, sync_status, created_at, updated_at) VALUES
('1111aaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '完成数据库 schema', '把 Supabase 风格表转成 MySQL', 0, 'high', DATE_ADD(NOW(), INTERVAL 1 DAY), JSON_ARRAY('mysql', 'schema'), 'synced', NOW(), NOW()),
('1111aaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '整理作业报告', '补 ER 图、数据字典和演示步骤', 0, 'medium', DATE_ADD(NOW(), INTERVAL 2 DAY), JSON_ARRAY('report'), 'synced', NOW(), NOW()),
('2222aaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '复习 SQL JOIN', '准备课堂展示说明', 1, 'low', DATE_SUB(NOW(), INTERVAL 1 DAY), JSON_ARRAY('study'), 'synced', NOW(), NOW())
ON DUPLICATE KEY UPDATE
title = VALUES(title),
description = VALUES(description),
completed = VALUES(completed),
priority = VALUES(priority),
due_date = VALUES(due_date),
tags = VALUES(tags),
sync_status = VALUES(sync_status),
updated_at = VALUES(updated_at);

INSERT INTO schedules (id, user_id, title, description, start_time, end_time, all_day, location, reminder_minutes_before, reminder_minutes, repeat_type, color, sync_status, created_at, updated_at) VALUES
('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '数据库作业答辩', '演示 Web + MySQL 改造结果', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 1 HOUR), 0, '教室 A101', 30, 30, NULL, 'blue', 'synced', NOW(), NOW()),
('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '整理 PPT 素材', '导出截图和结构图', DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 2 HOUR), 0, '图书馆', 20, 20, NULL, 'green', 'synced', NOW(), NOW())
ON DUPLICATE KEY UPDATE
title = VALUES(title),
description = VALUES(description),
start_time = VALUES(start_time),
end_time = VALUES(end_time),
all_day = VALUES(all_day),
location = VALUES(location),
reminder_minutes_before = VALUES(reminder_minutes_before),
reminder_minutes = VALUES(reminder_minutes),
repeat_type = VALUES(repeat_type),
color = VALUES(color),
sync_status = VALUES(sync_status),
updated_at = VALUES(updated_at);

INSERT INTO study_sessions (id, user_id, subject, duration, started_at, ended_at, start_time, end_time, notes, companion_id, tags, focus_score, is_completed, earned_points, created_at) VALUES
('aaaa2222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '数据库设计', 120, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 2 HOUR), '完成作业 schema 草稿', '22222222-2222-2222-2222-222222222222', JSON_ARRAY('mysql', 'design'), 92, 1, 240, NOW()),
('aaaa2222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '前端改造', 80, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 80 MINUTE), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 80 MINUTE), '替换 Supabase 登录链路', NULL, JSON_ARRAY('web', 'auth'), 88, 1, 160, NOW()),
('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'SQL 复习', 65, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 65 MINUTE), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 65 MINUTE), '学习 JOIN 和窗口函数', '11111111-1111-1111-1111-111111111111', JSON_ARRAY('sql'), 86, 1, 130, NOW())
ON DUPLICATE KEY UPDATE
subject = VALUES(subject),
duration = VALUES(duration),
started_at = VALUES(started_at),
ended_at = VALUES(ended_at),
start_time = VALUES(start_time),
end_time = VALUES(end_time),
notes = VALUES(notes),
companion_id = VALUES(companion_id),
tags = VALUES(tags),
focus_score = VALUES(focus_score),
is_completed = VALUES(is_completed),
earned_points = VALUES(earned_points);

INSERT INTO user_locations (id, user_id, latitude, longitude, accuracy, is_sharing, updated_at) VALUES
('cccc1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 39.9042000, 116.4074000, 15.00, 1, NOW()),
('cccc1111-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 39.9051000, 116.4089000, 18.00, 1, NOW())
ON DUPLICATE KEY UPDATE
latitude = VALUES(latitude),
longitude = VALUES(longitude),
accuracy = VALUES(accuracy),
is_sharing = VALUES(is_sharing),
updated_at = VALUES(updated_at);

INSERT INTO user_location_settings (id, user_id, is_enabled, visibility, show_accuracy, update_interval, updated_at) VALUES
('dddd1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'friends_only', 1, 300, NOW()),
('dddd1111-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 1, 'friends_only', 1, 300, NOW())
ON DUPLICATE KEY UPDATE
is_enabled = VALUES(is_enabled),
visibility = VALUES(visibility),
show_accuracy = VALUES(show_accuracy),
update_interval = VALUES(update_interval),
updated_at = VALUES(updated_at);

INSERT INTO places (id, name, category, latitude, longitude, description, emoji, open_hours, is_active, created_at) VALUES
('cccccccc-1111-1111-1111-111111111111', 'TRIX 图书馆', 'study', 39.9049000, 116.4092000, '安静的自习区域', '📚', '08:00-22:00', 1, NOW()),
('cccccccc-2222-2222-2222-222222222222', 'TRIX 食堂', 'dining', 39.9033000, 116.4069000, '补给能量的地方', '🍽️', '07:00-20:30', 1, NOW()),
('cccccccc-3333-3333-3333-333333333333', 'TRIX 公园', 'park', 39.9061000, 116.4118000, '课间放松散步', '🌳', '全天开放', 1, NOW())
ON DUPLICATE KEY UPDATE
name = VALUES(name),
category = VALUES(category),
latitude = VALUES(latitude),
longitude = VALUES(longitude),
description = VALUES(description),
emoji = VALUES(emoji),
open_hours = VALUES(open_hours),
is_active = VALUES(is_active);

INSERT INTO user_favorite_places (id, user_id, place_id, created_at) VALUES
('eeee1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-1111-1111-1111-111111111111', NOW())
ON DUPLICATE KEY UPDATE
created_at = VALUES(created_at);

INSERT INTO user_sessions (id, user_id, platform, device_id, device_name, device_info, session_token, clawbot_endpoint, is_active, created_at, last_active_at, expires_at) VALUES
('ffff1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'web', 'web-demo-device-1', 'Chrome on Windows', JSON_OBJECT('browser', 'Chrome', 'device', 'Windows'), 'demo-session-token', NULL, 1, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))
ON DUPLICATE KEY UPDATE
device_id = VALUES(device_id),
device_name = VALUES(device_name),
device_info = VALUES(device_info),
session_token = VALUES(session_token),
is_active = VALUES(is_active),
last_active_at = VALUES(last_active_at),
expires_at = VALUES(expires_at);

INSERT INTO user_settings (id, user_id, allow_stranger_search, show_online_status, allow_study_invites, created_at, updated_at) VALUES
('ffff2222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
allow_stranger_search = VALUES(allow_stranger_search),
show_online_status = VALUES(show_online_status),
allow_study_invites = VALUES(allow_study_invites),
updated_at = VALUES(updated_at);

INSERT INTO feature_flags (id, `key`, enabled, value, description, environment, rollout_percentage, target_user_ids, target_groups, updated_at) VALUES
('fefe1111-0000-0000-0000-000000000001', 'new-chat-ui', 0, NULL, 'Enable new chat interface', 'production', 0, NULL, NULL, NOW()),
('fefe1111-0000-0000-0000-000000000002', 'voice-messages', 1, NULL, 'Enable voice message recording', 'production', 100, NULL, NULL, NOW()),
('fefe1111-0000-0000-0000-000000000003', 'study-room-v2', 0, NULL, 'Enable new study room experience', 'production', 10, NULL, NULL, NOW()),
('fefe1111-0000-0000-0000-000000000004', 'ai-companion', 1, NULL, 'Enable AI companion features', 'production', 100, NULL, NULL, NOW()),
('fefe1111-0000-0000-0000-000000000005', 'web-push', 0, NULL, 'Enable Web Push notifications', 'production', 0, NULL, NULL, NOW()),
('fefe1111-0000-0000-0000-000000000006', 'maintenance-mode', 0, NULL, 'Enable maintenance mode', 'production', 0, NULL, NULL, NOW())
ON DUPLICATE KEY UPDATE
enabled = VALUES(enabled),
value = VALUES(value),
description = VALUES(description),
rollout_percentage = VALUES(rollout_percentage),
updated_at = VALUES(updated_at);

INSERT INTO achievements (id, name, name_en, description, icon, category, requirement, type, rarity, points_reward) VALUES
('duration_10', '初学者', 'Beginner', '累计专注 10 分钟', '🌱', 'duration', 10, 'total_minutes', 'common', 0),
('duration_60', '入门', 'Getting Started', '累计专注 1 小时', '📚', 'duration', 60, 'total_minutes', 'common', 10),
('duration_300', '学习达人', 'Study Master', '累计专注 5 小时', '🎯', 'duration', 300, 'total_minutes', 'rare', 50),
('streak_3', '三天连续', '3 Day Streak', '连续学习 3 天', '🔥', 'streak', 3, 'consecutive_days', 'common', 20),
('streak_7', '一周坚持', 'Week Warrior', '连续学习 7 天', '💪', 'streak', 7, 'consecutive_days', 'rare', 50),
('friends_5', '社交达人', 'Social Butterfly', '添加 5 个好友', '🤝', 'social', 5, 'friend_count', 'common', 30)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
name_en = VALUES(name_en),
description = VALUES(description),
icon = VALUES(icon),
category = VALUES(category),
requirement = VALUES(requirement),
type = VALUES(type),
rarity = VALUES(rarity),
points_reward = VALUES(points_reward);

INSERT INTO user_achievements (id, user_id, achievement_id, metadata, unlocked_at) VALUES
('aaaa3333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'duration_60', JSON_OBJECT('source', 'seed'), NOW()),
('aaaa3333-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'streak_3', JSON_OBJECT('source', 'seed'), NOW())
ON DUPLICATE KEY UPDATE
metadata = VALUES(metadata),
unlocked_at = VALUES(unlocked_at);

INSERT INTO mall_items (id, name, description, image_url, price, category, display_order, is_active, created_at) VALUES
('aaaa4444-0000-0000-0000-000000000001', '基础卫衣', '适合课堂演示的默认服装', 'https://images.unsplash.com/photo-1523398002811-999ca8dec234', 120, 'clothing', 1, 1, NOW()),
('aaaa4444-0000-0000-0000-000000000002', '学习耳机', '专注学习的小配件', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', 80, 'accessory', 2, 1, NOW()),
('aaaa4444-0000-0000-0000-000000000003', '桌面摆件', '点缀学习空间的道具', 'https://images.unsplash.com/photo-1503602642458-232111445657', 60, 'prop', 3, 1, NOW())
ON DUPLICATE KEY UPDATE
name = VALUES(name),
description = VALUES(description),
image_url = VALUES(image_url),
price = VALUES(price),
category = VALUES(category),
display_order = VALUES(display_order),
is_active = VALUES(is_active);

INSERT INTO user_purchased_items (id, user_id, item_id, quantity, points_spent, purchased_at) VALUES
('aaaa5555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa4444-0000-0000-0000-000000000001', 1, 120, NOW())
ON DUPLICATE KEY UPDATE
quantity = VALUES(quantity),
points_spent = VALUES(points_spent),
purchased_at = VALUES(purchased_at);

INSERT INTO outfits (id, name, category, image_url, preview_image_url, description, price, is_active, created_at) VALUES
('bbbb4444-0000-0000-0000-000000000001', '校服帽子', 'hat', 'https://images.unsplash.com/photo-1521369909029-2afed882baee', 'https://images.unsplash.com/photo-1521369909029-2afed882baee', '适合校园场景', 90, 1, NOW()),
('bbbb4444-0000-0000-0000-000000000002', '轻盈披风', 'cape', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b', '学习搭子专属披风', 150, 1, NOW()),
('bbbb4444-0000-0000-0000-000000000003', '星光魔杖', 'wand', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f', '演示用魔法道具', 220, 1, NOW()),
('bbbb4444-0000-0000-0000-000000000004', '深蓝背景', 'background', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3', '适合夜间学习', 180, 1, NOW())
ON DUPLICATE KEY UPDATE
name = VALUES(name),
category = VALUES(category),
image_url = VALUES(image_url),
preview_image_url = VALUES(preview_image_url),
description = VALUES(description),
price = VALUES(price),
is_active = VALUES(is_active);

INSERT INTO user_outfits (id, user_id, outfit_id, is_equipped, purchased_at) VALUES
('bbbb5555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbb4444-0000-0000-0000-000000000001', 1, NOW()),
('bbbb5555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbb4444-0000-0000-0000-000000000002', 0, NOW())
ON DUPLICATE KEY UPDATE
is_equipped = VALUES(is_equipped),
purchased_at = VALUES(purchased_at);

INSERT INTO point_transactions (id, user_id, amount, type, points_change, transaction_type, description, related_item_id, metadata, balance_after, created_at) VALUES
('dddd4444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 240, 'earn', 240, 'study_complete', '完成数据库设计学习', NULL, JSON_OBJECT('duration_minutes', 120), 1280, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('dddd4444-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', -120, 'spend', -120, 'redeem', '购买基础卫衣', 'aaaa4444-0000-0000-0000-000000000001', JSON_OBJECT('source', 'mall'), 1160, DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE
amount = VALUES(amount),
type = VALUES(type),
points_change = VALUES(points_change),
transaction_type = VALUES(transaction_type),
description = VALUES(description),
related_item_id = VALUES(related_item_id),
metadata = VALUES(metadata),
balance_after = VALUES(balance_after);

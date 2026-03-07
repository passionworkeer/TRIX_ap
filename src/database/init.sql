-- ============================================
-- 🎯 TRIX 3D Companion - Supabase 数据库初始化脚本
-- ============================================
-- 创建时间: 2026-02-05
-- 用途: 初始化所有数据表和 mock 数据
-- ============================================

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 插入当前用户（你自己）
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('00000000-0000-0000-0000-000000000001', 'me@trix.app', 'me', '我', '', '学习中的程序员 💻')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 好友表 (friends)
-- ============================================
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT UNIQUE NOT NULL, -- 好友的唯一标识
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')),
  bio TEXT,
  study_time INTEGER DEFAULT 0, -- 学习时长（分钟）
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

-- 插入 mock 好友数据（6 个好友）
-- TRIX 机器人置顶（created_at 最新）
INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'clawbot', 'TRIX 机器人', '', 'online', '🤖 AI 智能助手 - 随时为你服务', 0, false, NOW()),
('00000000-0000-0000-0000-000000000001', 'alice', 'Alice', '', 'online', 'UI/UX 设计师 ✨ 热爱创意和美学', 240, true, NOW() - INTERVAL '1 day'),
('00000000-0000-0000-0000-000000000001', 'bob', 'Bob', '', 'online', '算法竞赛爱好者 🏆 代码改变世界', 180, true, NOW() - INTERVAL '2 days'),
('00000000-0000-0000-0000-000000000001', 'carol', 'Carol', '', 'busy', '机器学习研究生 🤖 探索AI的未来', 320, false, NOW() - INTERVAL '3 days'),
('00000000-0000-0000-0000-000000000001', 'david', 'David', '', 'online', '健身达人 💪 热爱运动和编程', 150, true, NOW() - INTERVAL '4 days'),
('00000000-0000-0000-0000-000000000001', 'emma', 'Emma', '', 'offline', '文学爱好者 📚 在书中寻找答案', 0, false, NOW() - INTERVAL '5 days')
ON CONFLICT (friend_id) DO NOTHING;

-- ============================================
-- 3. 聊天记录表 (chat_messages)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friend_id TEXT NOT NULL, -- 对应好友的 friend_id
  sender TEXT NOT NULL CHECK (sender IN ('user', 'friend', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_chat_messages_friend_id ON chat_messages(friend_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- 添加语音消息相关字段（保持向后兼容）
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS voice_url TEXT,
ADD COLUMN IF NOT EXISTS voice_duration INTEGER,
ADD COLUMN IF NOT EXISTS voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS voice_mime_type TEXT;

-- 插入 mock 聊天记录 - Alice (设计师好友)
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('alice', 'user', '嗨 Alice！昨天的设计评审怎么样？', NOW() - INTERVAL '8 hours'),
('alice', 'friend', '很顺利！客户很喜欢我们的方案 🎉', NOW() - INTERVAL '7 hours 55 minutes'),
('alice', 'friend', '不过他们想要修改一些配色方案', NOW() - INTERVAL '7 hours 54 minutes'),
('alice', 'user', '哇太棒了！需要我帮忙调整吗？', NOW() - INTERVAL '7 hours 50 minutes'),
('alice', 'friend', '暂时不用，我自己可以搞定 😊', NOW() - INTERVAL '7 hours 45 minutes'),
('alice', 'friend', '对了，周末要不要一起去看设计展？', NOW() - INTERVAL '3 hours 20 minutes'),
('alice', 'user', '好啊！几点？在哪里？', NOW() - INTERVAL '3 hours 15 minutes'),
('alice', 'friend', '周六下午2点，在市中心艺术馆', NOW() - INTERVAL '3 hours 10 minutes'),
('alice', 'user', '完美！到时候见 👋', NOW() - INTERVAL '2 hours'),
('alice', 'friend', '刚才完成了视频渲染，效果超赞！✨', NOW() - INTERVAL '5 minutes'),
('alice', 'friend', '嘿，视频渲染完成了', NOW() - INTERVAL '2 minutes');

-- 插入 mock 聊天记录 - Bob (算法学习伙伴)
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('bob', 'friend', '早上好！今天准备复习算法', NOW() - INTERVAL '10 hours'),
('bob', 'user', '巧了，我也是！要不要一起？', NOW() - INTERVAL '9 hours 55 minutes'),
('bob', 'friend', '好啊！我正在看动态规划', NOW() - INTERVAL '9 hours 50 minutes'),
('bob', 'user', 'DP确实有点难，哪道题卡住了？', NOW() - INTERVAL '9 hours 45 minutes'),
('bob', 'friend', '背包问题的变种，状态转移方程写不出来 😅', NOW() - INTERVAL '9 hours 40 minutes'),
('bob', 'user', '我给你画个图解释一下，等会儿发给你', NOW() - INTERVAL '6 hours 40 minutes'),
('bob', 'friend', '太感谢了！你真是救星 🙏', NOW() - INTERVAL '6 hours 35 minutes'),
('bob', 'friend', '最近在学数据结构，有点难啊', NOW() - INTERVAL '3 hours'),
('bob', 'user', '哪个部分不懂？我可以帮你', NOW() - INTERVAL '2 hours 55 minutes'),
('bob', 'friend', '图的遍历算法，BFS 和 DFS 有点混', NOW() - INTERVAL '2 hours 50 minutes'),
('bob', 'user', '简单！BFS 用队列，DFS 用栈或递归', NOW() - INTERVAL '2 hours 45 minutes'),
('bob', 'friend', '哦明白了！你解释得真清楚 👍', NOW() - INTERVAL '2 hours 40 minutes'),
('bob', 'friend', '周末一起去图书馆吗？', NOW() - INTERVAL '10 minutes');

-- 插入 mock 聊天记录 - Carol (项目组员)
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('carol', 'friend', '嗨！你看到教授发的新作业了吗？', NOW() - INTERVAL '12 hours'),
('carol', 'user', '看到了，是关于机器学习的项目对吧？', NOW() - INTERVAL '11 hours 55 minutes'),
('carol', 'friend', '对！要做一个图像分类模型', NOW() - INTERVAL '11 hours 50 minutes'),
('carol', 'user', '听起来很有挑战性，我们组队吧？', NOW() - INTERVAL '11 hours 40 minutes'),
('carol', 'friend', '太好了！我正想找你合作 🤝', NOW() - INTERVAL '11 hours 35 minutes'),
('carol', 'friend', '项目进度如何？我这边已经完成数据分析了', NOW() - INTERVAL '4 hours'),
('carol', 'user', '我还在做算法实现，可能还需要两天', NOW() - INTERVAL '3 hours 50 minutes'),
('carol', 'friend', '没关系，我们还有时间。需要帮忙吗？', NOW() - INTERVAL '15 minutes');

-- 插入 mock 聊天记录 - David (运动伙伴)
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('david', 'friend', '兄弟，明天一起打篮球吗？🏀', NOW() - INTERVAL '20 hours'),
('david', 'user', '可以啊！几点开始？', NOW() - INTERVAL '19 hours 55 minutes'),
('david', 'friend', '下午4点，操场见！', NOW() - INTERVAL '19 hours 50 minutes'),
('david', 'user', '好的，到时候见 👍', NOW() - INTERVAL '19 hours 45 minutes'),
('david', 'friend', '对了，记得带球鞋', NOW() - INTERVAL '10 hours'),
('david', 'user', '收到！我有新买的 Nike', NOW() - INTERVAL '9 hours 55 minutes'),
('david', 'friend', '今天自习室见！💪', NOW() - INTERVAL '5 hours'),
('david', 'user', '好的，下午 2 点见', NOW() - INTERVAL '4 hours 55 minutes'),
('david', 'friend', '我已经到了，在三楼靠窗位置', NOW() - INTERVAL '1 hour'),
('david', 'user', '马上到！5分钟', NOW() - INTERVAL '55 minutes');

-- 插入 mock 聊天记录 - Emma (考试伙伴)
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('emma', 'friend', '你好呀！最近过得怎么样？', NOW() - INTERVAL '2 days'),
('emma', 'user', '挺好的！忙着准备期末考试', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
('emma', 'friend', '我也是！压力好大啊 😓', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
('emma', 'user', '要不要一起复习？互相帮助', NOW() - INTERVAL '1 day 16 hours'),
('emma', 'friend', '好主意！明天图书馆见？', NOW() - INTERVAL '1 day 15 hours 55 minutes'),
('emma', 'user', '完美！我带笔记', NOW() - INTERVAL '1 day 15 hours 50 minutes'),
('emma', 'friend', '明天考试，好紧张 😰', NOW() - INTERVAL '1 day'),
('emma', 'user', '放轻松，你准备得很充分了！', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes'),
('emma', 'friend', '谢谢鼓励！一起加油 💪', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
('emma', 'friend', '考完试我们去吃火锅庆祝吧！🍲', NOW() - INTERVAL '20 minutes');

-- 插入 mock 聊天记录 - TRIX 机器人
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('clawbot', 'bot', '你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。', NOW());

-- ============================================
-- 4. 未读消息计数表 (unread_counts)
-- ============================================
CREATE TABLE IF NOT EXISTS unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 创建索引
CREATE INDEX idx_unread_counts_user_id ON unread_counts(user_id);
CREATE INDEX idx_unread_counts_friend_id ON unread_counts(friend_id);

-- 插入未读计数（根据最新聊天记录）
INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time) VALUES
('00000000-0000-0000-0000-000000000001', 'alice', 2, '嘿，视频渲染完成了', NOW() - INTERVAL '2 minutes'),
('00000000-0000-0000-0000-000000000001', 'bob', 1, '周末一起去图书馆吗？', NOW() - INTERVAL '10 minutes'),
('00000000-0000-0000-0000-000000000001', 'carol', 1, '没关系，我们还有时间。需要帮忙吗？', NOW() - INTERVAL '15 minutes'),
('00000000-0000-0000-0000-000000000001', 'david', 0, '马上到！5分钟', NOW() - INTERVAL '55 minutes'),
('00000000-0000-0000-0000-000000000001', 'emma', 1, '考完试我们去吃火锅庆祝吧！🍲', NOW() - INTERVAL '20 minutes'),
('00000000-0000-0000-0000-000000000001', 'clawbot', 0, '你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。', NOW())
ON CONFLICT (user_id, friend_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  last_message = EXCLUDED.last_message,
  last_message_time = EXCLUDED.last_message_time;

-- ============================================
-- 5. 通知表 (notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'friend_request', 'study', 'achievement')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  avatar_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- 插入 mock 通知数据
INSERT INTO notifications (user_id, type, title, content, avatar_url, is_read, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'message', '新消息', 'Alice 给你发送了一条消息', '', false, NOW() - INTERVAL '2 minutes'),
('00000000-0000-0000-0000-000000000001', 'study', '学习提醒', 'David 邀请你加入自习室', '', false, NOW() - INTERVAL '1 hour'),
('00000000-0000-0000-0000-000000000001', 'achievement', '成就解锁', '连续学习 7 天！继续保持 🎉', '', false, NOW() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000001', 'system', '系统通知', '你的学习报告已生成，点击查看', '', true, NOW() - INTERVAL '5 hours'),
('00000000-0000-0000-0000-000000000001', 'friend_request', '好友请求', 'Frank 想要添加你为好友', '', true, NOW() - INTERVAL '1 day');

-- ============================================
-- 6. 邮件表 (mails)
-- ============================================
CREATE TABLE IF NOT EXISTS mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_avatar TEXT,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_mails_user_id ON mails(user_id);
CREATE INDEX idx_mails_is_read ON mails(is_read);
CREATE INDEX idx_mails_created_at ON mails(created_at);

-- 插入 mock 邮件数据
INSERT INTO mails (user_id, from_name, from_avatar, subject, preview, content, is_read, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Alice', '', '周末设计展邀请', '嘿！周六有个很棒的设计展览，要不要一起去看看？', '详细内容...', false, NOW() - INTERVAL '30 minutes'),
('00000000-0000-0000-0000-000000000001', 'Bob', '', '算法学习资料分享', '我整理了一些 DP 的学习资料，分享给你～', '详细内容...', false, NOW() - INTERVAL '3 hours'),
('00000000-0000-0000-0000-000000000001', 'Carol', '', '项目协作邀请', '嘿！我们的项目需要你的帮助，能一起讨论一下设计方案吗？', '详细内容...', true, NOW() - INTERVAL '1 day'),
('00000000-0000-0000-0000-000000000001', 'TRIX Team', '', '欢迎使用 TRIX！', '感谢你加入 TRIX 学习社区！这里有一些快速入门指南...', '详细内容...', true, NOW() - INTERVAL '2 days');

-- ============================================
-- 7. 学习记录表 (study_sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL, -- 学习时长（分钟）
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at);

-- 插入 mock 学习记录
INSERT INTO study_sessions (user_id, subject, duration, started_at, ended_at, notes) VALUES
('00000000-0000-0000-0000-000000000001', '算法与数据结构', 120, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', '复习了动态规划'),
('00000000-0000-0000-0000-000000000001', '机器学习', 90, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '90 minutes', '完成了图像分类项目'),
('00000000-0000-0000-0000-000000000001', 'Web 开发', 150, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '150 minutes', '学习 React Hooks');

-- ============================================
-- 8. 自习室表 (study_rooms)
-- ============================================
CREATE TABLE IF NOT EXISTS study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_study_rooms_is_public ON study_rooms(is_public);
CREATE INDEX idx_study_rooms_created_by ON study_rooms(created_by);

-- 插入 mock 自习室
INSERT INTO study_rooms (name, description, capacity, current_members, is_public, created_by) VALUES
('算法刷题小组', '一起刷 LeetCode，互相鼓励！', 10, 3, true, '00000000-0000-0000-0000-000000000001'),
('前端学习交流', '分享前端技术，共同进步', 15, 5, true, '00000000-0000-0000-0000-000000000001'),
('考研冲刺营', '考研最后冲刺，一起加油！', 20, 8, true, '00000000-0000-0000-0000-000000000001');

-- ============================================
-- 9. 自习室成员表 (study_room_members)
-- ============================================
CREATE TABLE IF NOT EXISTS study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT, -- 如果是好友
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, friend_id)
);

-- 创建索引
CREATE INDEX idx_study_room_members_room_id ON study_room_members(room_id);
CREATE INDEX idx_study_room_members_user_id ON study_room_members(user_id);
CREATE INDEX idx_study_room_members_is_active ON study_room_members(is_active);

-- ============================================
-- 10. 创建视图 - 好友最新消息
-- ============================================
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT 
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.bio,
  f.study_time,
  f.is_studying,
  uc.unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN unread_counts uc ON f.friend_id = uc.friend_id
ORDER BY uc.last_message_time DESC NULLS LAST;

-- ============================================
-- 11. 创建函数 - 发送消息并更新未读计数
-- ============================================
CREATE OR REPLACE FUNCTION send_message(
  p_friend_id TEXT,
  p_sender TEXT,
  p_text TEXT
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- 插入消息
  INSERT INTO chat_messages (friend_id, sender, text)
  VALUES (p_friend_id, p_sender, p_text)
  RETURNING id INTO v_message_id;
  
  -- 更新未读计数（如果是好友发送的消息）
  IF p_sender = 'friend' OR p_sender = 'bot' THEN
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 1, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      unread_count = unread_counts.unread_count + 1,
      last_message = p_text,
      last_message_time = NOW();
  ELSE
    -- 用户发送的消息，只更新最后消息，不增加未读
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 0, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      last_message = p_text,
      last_message_time = NOW();
  END IF;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. 创建函数 - 标记消息已读
-- ============================================
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id UUID,
  p_friend_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE unread_counts
  SET unread_count = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. 启用行级安全策略 (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. 待办事项表 (todos) - Workbench 功能
-- ============================================
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 索引
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_completed ON todos(completed);

-- ============================================
-- 11. 日程表 (schedules) - Workbench 功能
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  reminder_minutes_before INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- 索引
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);

-- 启用 RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Todos 表策略
CREATE POLICY "Todos are viewable by owner" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Todos can be created by owner" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Todos can be updated by owner" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Todos can be deleted by owner" ON todos FOR DELETE USING (auth.uid() = user_id);

-- Schedules 表策略
CREATE POLICY "Schedules are viewable by owner" ON schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Schedules can be created by owner" ON schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Schedules can be updated by owner" ON schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Schedules can be deleted by owner" ON schedules FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 14. 创建 RLS 策略（允许所有操作，后续可以根据需求细化）
-- ============================================

-- Users 表策略
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (true);

-- Friends 表策略
CREATE POLICY "Friends are viewable by everyone" ON friends FOR SELECT USING (true);
CREATE POLICY "Friends can be managed by owner" ON friends FOR ALL USING (true);

-- Chat messages 表策略
CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat messages can be created by anyone" ON chat_messages FOR INSERT WITH CHECK (true);

-- Unread counts 表策略
CREATE POLICY "Unread counts are viewable by everyone" ON unread_counts FOR SELECT USING (true);
CREATE POLICY "Unread counts can be managed by anyone" ON unread_counts FOR ALL USING (true);

-- Notifications 表策略
CREATE POLICY "Notifications are viewable by owner" ON notifications FOR SELECT USING (true);
CREATE POLICY "Notifications can be managed by anyone" ON notifications FOR ALL USING (true);

-- Mails 表策略
CREATE POLICY "Mails are viewable by owner" ON mails FOR SELECT USING (true);
CREATE POLICY "Mails can be managed by anyone" ON mails FOR ALL USING (true);

-- Study sessions 表策略
CREATE POLICY "Study sessions are viewable by everyone" ON study_sessions FOR SELECT USING (true);
CREATE POLICY "Study sessions can be managed by anyone" ON study_sessions FOR ALL USING (true);

-- Study rooms 表策略
CREATE POLICY "Public study rooms are viewable by everyone" ON study_rooms FOR SELECT USING (is_public = true);
CREATE POLICY "Study rooms can be managed by creator" ON study_rooms FOR ALL USING (true);

-- Study room members 表策略
CREATE POLICY "Study room members are viewable by everyone" ON study_room_members FOR SELECT USING (true);
CREATE POLICY "Study room members can be managed by anyone" ON study_room_members FOR ALL USING (true);

-- ============================================
-- ✅ 初始化完成！
-- ============================================
-- 
-- 📊 创建的表：
-- 1. users - 用户表
-- 2. friends - 好友表
-- 3. chat_messages - 聊天记录表
-- 4. unread_counts - 未读消息计数表
-- 5. notifications - 通知表
-- 6. mails - 邮件表
-- 7. study_sessions - 学习记录表
-- 8. study_rooms - 自习室表
-- 9. study_room_members - 自习室成员表
-- 10. todos - 待办事项表（Workbench 功能）
-- 11. schedules - 日程表（Workbench 功能）
--
-- 🔧 创建的视图：
-- - friend_latest_messages - 好友最新消息视图
--
-- ⚙️ 创建的函数：
-- - send_message() - 发送消息并更新未读计数
-- - mark_messages_as_read() - 标记消息已读
--
-- 🛡️ 已启用 RLS 行级安全策略
--
-- 📝 Mock 数据：
-- - 1 个用户（你自己）
-- - 6 个好友（Alice, Bob, Carol, David, Emma, TRIX 机器人）
-- - 52 条聊天记录
-- - 6 条未读计数记录
-- - 5 条通知
-- - 4 封邮件
-- - 3 条学习记录
-- - 3 个自习室
--
-- ============================================

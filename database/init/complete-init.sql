-- ============================================
-- 🎯 TRIX 3D Companion - 完整数据库初始化脚本
-- ============================================
-- 创建时间: 2026-02-10
-- 用途: 一键创建全新数据库,包含完整测试数据
-- 使用说明:
--   1. 在 Supabase Dashboard 的 SQL Editor 中执行本脚本
--   2. 脚本会自动清理旧数据并创建新表
--   3. 测试账号密码统一为: trix2026
-- ============================================

-- ============================================
-- 清理旧数据 (可选)
-- ============================================
DROP TABLE IF EXISTS study_room_members CASCADE;
DROP TABLE IF EXISTS study_rooms CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS mails CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS unread_counts CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
-- 存储所有用户的基本信息
-- 注意: 用户ID需要与 auth.users 表的 id 保持一致
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

COMMENT ON TABLE users IS '用户基本信息表';
COMMENT ON COLUMN users.id IS '用户UUID,与auth.users.id对应';
COMMENT ON COLUMN users.email IS '用户邮箱(唯一)';
COMMENT ON COLUMN users.username IS '用户名(唯一)';
COMMENT ON COLUMN users.display_name IS '显示名称';

-- ============================================
-- 2. 好友表 (friends)
-- ============================================
-- 存储用户之间的好友关系
-- 采用双向存储: A加B为好友,需要同时插入两条记录
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')) DEFAULT 'offline',
  bio TEXT,
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- 创建索引
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

COMMENT ON TABLE friends IS '好友关系表(双向存储)';
COMMENT ON COLUMN friends.user_id IS '用户ID';
COMMENT ON COLUMN friends.friend_id IS '好友ID';
COMMENT ON COLUMN friends.status IS '在线状态: online/offline/busy/away';
COMMENT ON COLUMN friends.is_studying IS '是否正在学习';

-- ============================================
-- 3. 聊天记录表 (chat_messages)
-- ============================================
-- 存储用户之间的聊天消息
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver_id ON chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

COMMENT ON TABLE chat_messages IS '聊天消息表';
COMMENT ON COLUMN chat_messages.conversation_id IS '会话ID(用于分组消息)';
COMMENT ON COLUMN chat_messages.sender_id IS '发送者ID';
COMMENT ON COLUMN chat_messages.receiver_id IS '接收者ID';

-- ============================================
-- 4. 未读消息计数表 (unread_counts)
-- ============================================
-- 用于快速查询未读消息数量
CREATE TABLE unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 创建索引
CREATE INDEX idx_unread_counts_user_id ON unread_counts(user_id);
CREATE INDEX idx_unread_counts_friend_id ON unread_counts(friend_id);

COMMENT ON TABLE unread_counts IS '未读消息计数表';

-- ============================================
-- 5. 通知表 (notifications)
-- ============================================
-- 存储系统通知和好友请求等
CREATE TABLE notifications (
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
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS '通知表';
COMMENT ON COLUMN notifications.type IS '通知类型';

-- ============================================
-- 6. 邮件表 (mails)
-- ============================================
-- 存储内部邮件消息
CREATE TABLE mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
CREATE INDEX idx_mails_created_at ON mails(created_at DESC);

COMMENT ON TABLE mails IS '内部邮件表';

-- ============================================
-- 7. 学习记录表 (study_sessions)
-- ============================================
-- 记录用户的学习时长
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at DESC);

COMMENT ON TABLE study_sessions IS '学习记录表';
COMMENT ON COLUMN study_sessions.duration IS '学习时长(分钟)';

-- ============================================
-- 8. 自习室表 (study_rooms)
-- ============================================
-- 虚拟自习室功能
CREATE TABLE study_rooms (
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

COMMENT ON TABLE study_rooms IS '虚拟自习室表';

-- ============================================
-- 9. 自习室成员表 (study_room_members)
-- ============================================
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 创建索引
CREATE INDEX idx_study_room_members_room_id ON study_room_members(room_id);
CREATE INDEX idx_study_room_members_user_id ON study_room_members(user_id);
CREATE INDEX idx_study_room_members_is_active ON study_room_members(is_active);

COMMENT ON TABLE study_room_members IS '自习室成员表';

-- ============================================
-- 插入测试用户数据
-- ============================================
-- 注意: 这些用户需要先在 Supabase Auth 中创建
-- 测试账号密码统一为: trix2026
-- 你需要在 Supabase Dashboard 的 Authentication 中手动创建这些用户
-- 或使用下面的 SQL 函数创建

-- 用户 1: 小明 (你自己)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('11111111-1111-1111-1111-111111111111', 'xiaoming@trix.app', 'xiaoming', '小明', '', '热爱编程的学生 💻')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- 用户 2: Alice (设计师)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('22222222-2222-2222-2222-222222222222', 'alice@trix.app', 'alice', 'Alice', '', 'UI/UX 设计师 ✨ 热爱创意和美学')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- 用户 3: Bob (算法高手)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('33333333-3333-3333-3333-333333333333', 'bob@trix.app', 'bob', 'Bob', '', '算法竞赛爱好者 🏆 代码改变世界')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- 用户 4: Carol (AI研究生)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('44444444-4444-4444-4444-444444444444', 'carol@trix.app', 'carol', 'Carol', '', '机器学习研究生 🤖 探索AI的未来')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- 用户 5: David (健身达人)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('55555555-5555-5555-5555-555555555555', 'david@trix.app', 'david', 'David', '', '健身达人 💪 热爱运动和编程')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- 用户 6: Emma (文学爱好者)
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('66666666-6666-6666-6666-666666666666', 'emma@trix.app', 'emma', 'Emma', '', '文学爱好者 📚 在书中寻找答案')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name;

-- ============================================
-- 插入好友关系 (双向)
-- ============================================
-- 小明 ↔ Alice
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Alice', 'online', 'UI/UX 设计师 ✨', 240, true),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '小明', 'online', '热爱编程的学生 💻', 0, false)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 小明 ↔ Bob
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Bob', 'online', '算法竞赛爱好者 🏆', 180, true),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '小明', 'online', '热爱编程的学生 💻', 0, false)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 小明 ↔ Carol
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Carol', 'busy', '机器学习研究生 🤖', 320, false),
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '小明', 'online', '热爱编程的学生 💻', 0, false)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 小明 ↔ David
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'David', 'online', '健身达人 💪', 150, true),
('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '小明', 'online', '热爱编程的学生 💻', 0, false)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 小明 ↔ Emma
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'Emma', 'offline', '文学爱好者 📚', 0, false),
('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '小明', 'online', '热爱编程的学生 💻', 0, false)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- Alice ↔ Bob (其他用户之间也有好友关系)
INSERT INTO friends (user_id, friend_id, name, status, bio, study_time, is_studying) VALUES
('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Bob', 'online', '算法竞赛爱好者 🏆', 180, true),
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Alice', 'online', 'UI/UX 设计师 ✨', 240, true)
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- ============================================
-- 插入聊天记录
-- ============================================
-- 小明 与 Alice 的对话
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
 '嗨 Alice！昨天的设计评审怎么样？', NOW() - INTERVAL '8 hours'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '很顺利！客户很喜欢我们的方案 🎉', NOW() - INTERVAL '7 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '不过他们想要修改一些配色方案', NOW() - INTERVAL '7 hours 54 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
 '哇太棒了！需要我帮忙调整吗？', NOW() - INTERVAL '7 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '暂时不用，我自己可以搞定 😊', NOW() - INTERVAL '7 hours 45 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '对了，周末要不要一起去看设计展？', NOW() - INTERVAL '3 hours 20 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
 '好啊！几点？在哪里？', NOW() - INTERVAL '3 hours 15 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '周六下午2点，在市中心艺术馆', NOW() - INTERVAL '3 hours 10 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
 '完美！到时候见 👋', NOW() - INTERVAL '2 hours'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '刚才完成了视频渲染，效果超赞！✨', NOW() - INTERVAL '5 minutes'),
('11111111-1111-1111-1111-111111111111_22222222-2222-2222-2222-222222222222', 
 '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
 '嘿，视频渲染完成了，要不要看看？', NOW() - INTERVAL '2 minutes');

-- 小明 与 Bob 的对话
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '早上好！今天准备复习算法', NOW() - INTERVAL '10 hours'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 
 '巧了，我也是！要不要一起？', NOW() - INTERVAL '9 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '好啊！我正在看动态规划', NOW() - INTERVAL '9 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 
 'DP确实有点难，哪道题卡住了？', NOW() - INTERVAL '9 hours 45 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '背包问题的变种，状态转移方程写不出来 😅', NOW() - INTERVAL '9 hours 40 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 
 '我给你画个图解释一下，等会儿发给你', NOW() - INTERVAL '6 hours 40 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '太感谢了！你真是救星 🙏', NOW() - INTERVAL '6 hours 35 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '最近在学数据结构，有点难啊', NOW() - INTERVAL '3 hours'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 
 '哪个部分不懂？我可以帮你', NOW() - INTERVAL '2 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '图的遍历算法，BFS 和 DFS 有点混', NOW() - INTERVAL '2 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 
 '简单！BFS 用队列，DFS 用栈或递归', NOW() - INTERVAL '2 hours 45 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '哦明白了！你解释得真清楚 👍', NOW() - INTERVAL '2 hours 40 minutes'),
('11111111-1111-1111-1111-111111111111_33333333-3333-3333-3333-333333333333', 
 '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
 '周末一起去图书馆吗？', NOW() - INTERVAL '10 minutes');

-- 小明 与 Carol 的对话
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
 '嗨！你看到教授发的新作业了吗？', NOW() - INTERVAL '12 hours'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 
 '看到了，是关于机器学习的项目对吧？', NOW() - INTERVAL '11 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
 '对！要做一个图像分类模型', NOW() - INTERVAL '11 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 
 '听起来很有挑战性，我们组队吧？', NOW() - INTERVAL '11 hours 40 minutes'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
 '太好了！我正想找你合作 🤝', NOW() - INTERVAL '11 hours 35 minutes'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
 '项目进度如何？我这边已经完成数据分析了', NOW() - INTERVAL '4 hours'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 
 '我还在做算法实现，可能还需要两天', NOW() - INTERVAL '3 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_44444444-4444-4444-4444-444444444444', 
 '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
 '没关系，我们还有时间。需要帮忙吗？', NOW() - INTERVAL '15 minutes');

-- 小明 与 David 的对话
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
 '兄弟，明天一起打篮球吗？🏀', NOW() - INTERVAL '20 hours'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 
 '可以啊！几点开始？', NOW() - INTERVAL '19 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
 '下午4点，操场见！', NOW() - INTERVAL '19 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 
 '好的，到时候见 👍', NOW() - INTERVAL '19 hours 45 minutes'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
 '对了，记得带球鞋', NOW() - INTERVAL '10 hours'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 
 '收到！我有新买的 Nike', NOW() - INTERVAL '9 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
 '今天自习室见！💪', NOW() - INTERVAL '5 hours'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 
 '好的，下午 2 点见', NOW() - INTERVAL '4 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
 '我已经到了，在三楼靠窗位置', NOW() - INTERVAL '1 hour'),
('11111111-1111-1111-1111-111111111111_55555555-5555-5555-5555-555555555555', 
 '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 
 '马上到！5分钟', NOW() - INTERVAL '55 minutes');

-- 小明 与 Emma 的对话
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '你好呀！最近过得怎么样？', NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 
 '挺好的！忙着准备期末考试', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '我也是！压力好大啊 😓', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 
 '要不要一起复习？互相帮助', NOW() - INTERVAL '1 day 16 hours'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '好主意！明天图书馆见？', NOW() - INTERVAL '1 day 15 hours 55 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 
 '完美！我带笔记', NOW() - INTERVAL '1 day 15 hours 50 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '明天考试，好紧张 😰', NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 
 '放轻松，你准备得很充分了！', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '谢谢鼓励！一起加油 💪', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
('11111111-1111-1111-1111-111111111111_66666666-6666-6666-6666-666666666666', 
 '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
 '考完试我们去吃火锅庆祝吧！🍲', NOW() - INTERVAL '20 minutes');

-- ============================================
-- 插入未读计数
-- ============================================
INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time) VALUES
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 2, '嘿，视频渲染完成了，要不要看看？', NOW() - INTERVAL '2 minutes'),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 1, '周末一起去图书馆吗？', NOW() - INTERVAL '10 minutes'),
('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 1, '没关系，我们还有时间。需要帮忙吗？', NOW() - INTERVAL '15 minutes'),
('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 0, '马上到！5分钟', NOW() - INTERVAL '55 minutes'),
('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 1, '考完试我们去吃火锅庆祝吧！🍲', NOW() - INTERVAL '20 minutes')
ON CONFLICT (user_id, friend_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  last_message = EXCLUDED.last_message,
  last_message_time = EXCLUDED.last_message_time;

-- ============================================
-- 插入通知数据
-- ============================================
INSERT INTO notifications (user_id, type, title, content, is_read, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'message', '新消息', 'Alice 给你发送了一条消息', false, NOW() - INTERVAL '2 minutes'),
('11111111-1111-1111-1111-111111111111', 'study', '学习提醒', 'David 邀请你加入自习室', false, NOW() - INTERVAL '1 hour'),
('11111111-1111-1111-1111-111111111111', 'achievement', '成就解锁', '连续学习 7 天！继续保持 🎉', false, NOW() - INTERVAL '2 hours'),
('11111111-1111-1111-1111-111111111111', 'system', '系统通知', '你的学习报告已生成，点击查看', true, NOW() - INTERVAL '5 hours'),
('11111111-1111-1111-1111-111111111111', 'friend_request', '好友请求', 'Frank 想要添加你为好友', true, NOW() - INTERVAL '1 day');

-- ============================================
-- 插入邮件数据
-- ============================================
INSERT INTO mails (user_id, from_user_id, from_name, subject, preview, content, is_read, created_at) VALUES
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Alice', '周末设计展邀请', 
 '嘿！周六有个很棒的设计展览，要不要一起去看看？', 
 '详细内容: 这次展览汇集了国内外顶尖设计师的作品，非常值得一看！时间是周六下午2点，地点在市中心艺术馆。期待你的回复！', 
 false, NOW() - INTERVAL '30 minutes'),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Bob', '算法学习资料分享', 
 '我整理了一些 DP 的学习资料，分享给你～', 
 '详细内容: 包括经典的背包问题、最长公共子序列、编辑距离等，还有详细的图解和代码实现。希望对你有帮助！', 
 false, NOW() - INTERVAL '3 hours'),
('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Carol', '项目协作邀请', 
 '嘿！我们的项目需要你的帮助，能一起讨论一下设计方案吗？', 
 '详细内容: 项目进展顺利，但在算法优化上遇到了一些挑战。希望能和你一起探讨，相信你的专业知识会有很大帮助！', 
 true, NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111111', NULL, 'TRIX Team', '欢迎使用 TRIX！', 
 '感谢你加入 TRIX 学习社区！这里有一些快速入门指南...', 
 '详细内容: TRIX 是一个专注于学习的社交平台。你可以添加好友、加入自习室、记录学习时长，还能与 AI 助手对话。开始你的学习之旅吧！', 
 true, NOW() - INTERVAL '2 days');

-- ============================================
-- 插入学习记录
-- ============================================
INSERT INTO study_sessions (user_id, subject, duration, started_at, ended_at, notes) VALUES
('11111111-1111-1111-1111-111111111111', '算法与数据结构', 120, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', '复习了动态规划，完成了5道题'),
('11111111-1111-1111-1111-111111111111', '机器学习', 90, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '90 minutes', '完成了图像分类项目的数据预处理'),
('11111111-1111-1111-1111-111111111111', 'Web 开发', 150, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '150 minutes', '学习 React Hooks，做了几个小demo'),
('22222222-2222-2222-2222-222222222222', 'UI/UX 设计', 180, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '2 hours', '完成客户项目的配色方案调整'),
('33333333-3333-3333-3333-333333333333', '算法竞赛', 240, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '4 hours', '刷了10道 LeetCode hard 题目');

-- ============================================
-- 插入自习室数据
-- ============================================
INSERT INTO study_rooms (name, description, capacity, current_members, is_public, created_by) VALUES
('算法刷题小组', '一起刷 LeetCode，互相鼓励！每天至少完成3道题 💪', 10, 3, true, '11111111-1111-1111-1111-111111111111'),
('前端学习交流', '分享前端技术，共同进步。欢迎React、Vue开发者', 15, 5, true, '22222222-2222-2222-2222-222222222222'),
('考研冲刺营', '考研最后冲刺，一起加油！专注学习，远离手机', 20, 8, true, '44444444-4444-4444-4444-444444444444'),
('深夜学习室', '夜猫子专属，晚上10点后开放 🌙', 8, 2, true, '33333333-3333-3333-3333-333333333333');

-- ============================================
-- 插入自习室成员
-- ============================================
INSERT INTO study_room_members (room_id, user_id, is_active) VALUES
((SELECT id FROM study_rooms WHERE name = '算法刷题小组'), '11111111-1111-1111-1111-111111111111', true),
((SELECT id FROM study_rooms WHERE name = '算法刷题小组'), '33333333-3333-3333-3333-333333333333', true),
((SELECT id FROM study_rooms WHERE name = '算法刷题小组'), '55555555-5555-5555-5555-555555555555', true),
((SELECT id FROM study_rooms WHERE name = '前端学习交流'), '11111111-1111-1111-1111-111111111111', true),
((SELECT id FROM study_rooms WHERE name = '前端学习交流'), '22222222-2222-2222-2222-222222222222', true);

-- ============================================
-- 创建视图: 好友最新消息 (用于聊天列表)
-- ============================================
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT 
  f.user_id,
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) AS unread_count,
  uc.last_message,
  uc.last_message_time,
  COALESCE(uc.last_message_time, f.created_at) AS sort_time
FROM friends f
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id
ORDER BY sort_time DESC;

COMMENT ON VIEW friend_latest_messages IS '好友列表视图，包含最新消息和未读数';

-- ============================================
-- 启用 Row Level Security (RLS)
-- ============================================
-- 生产环境建议启用 RLS，开发环境可以暂时关闭

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略 (开发模式: 允许所有操作)
-- 生产环境请根据实际需求修改

-- users 表策略
DROP POLICY IF EXISTS "Allow all users operations" ON users;
CREATE POLICY "Allow all users operations" ON users FOR ALL USING (true) WITH CHECK (true);

-- friends 表策略
DROP POLICY IF EXISTS "Allow all friends operations" ON friends;
CREATE POLICY "Allow all friends operations" ON friends FOR ALL USING (true) WITH CHECK (true);

-- chat_messages 表策略
DROP POLICY IF EXISTS "Allow all chat operations" ON chat_messages;
CREATE POLICY "Allow all chat operations" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- unread_counts 表策略
DROP POLICY IF EXISTS "Allow all unread operations" ON unread_counts;
CREATE POLICY "Allow all unread operations" ON unread_counts FOR ALL USING (true) WITH CHECK (true);

-- notifications 表策略
DROP POLICY IF EXISTS "Allow all notifications operations" ON notifications;
CREATE POLICY "Allow all notifications operations" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- mails 表策略
DROP POLICY IF EXISTS "Allow all mails operations" ON mails;
CREATE POLICY "Allow all mails operations" ON mails FOR ALL USING (true) WITH CHECK (true);

-- study_sessions 表策略
DROP POLICY IF EXISTS "Allow all study sessions operations" ON study_sessions;
CREATE POLICY "Allow all study sessions operations" ON study_sessions FOR ALL USING (true) WITH CHECK (true);

-- study_rooms 表策略
DROP POLICY IF EXISTS "Allow all study rooms operations" ON study_rooms;
CREATE POLICY "Allow all study rooms operations" ON study_rooms FOR ALL USING (true) WITH CHECK (true);

-- study_room_members 表策略
DROP POLICY IF EXISTS "Allow all study room members operations" ON study_room_members;
CREATE POLICY "Allow all study room members operations" ON study_room_members FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 创建触发器: 自动更新 updated_at 字段
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friends_updated_at ON friends;
CREATE TRIGGER update_friends_updated_at BEFORE UPDATE ON friends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_unread_counts_updated_at ON unread_counts;
CREATE TRIGGER update_unread_counts_updated_at BEFORE UPDATE ON unread_counts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 数据库初始化完成！
-- ============================================
-- 
-- 📊 已创建的表:
--   ✅ users (用户表)
--   ✅ friends (好友关系表)
--   ✅ chat_messages (聊天消息表)
--   ✅ unread_counts (未读计数表)
--   ✅ notifications (通知表)
--   ✅ mails (邮件表)
--   ✅ study_sessions (学习记录表)
--   ✅ study_rooms (自习室表)
--   ✅ study_room_members (自习室成员表)
--
-- 👥 测试用户账号 (需要在 Supabase Auth 中创建):
--   📧 xiaoming@trix.app  (小明 - 你自己)
--   📧 alice@trix.app     (Alice - 设计师)
--   📧 bob@trix.app       (Bob - 算法高手)
--   📧 carol@trix.app     (Carol - AI研究生)
--   📧 david@trix.app     (David - 健身达人)
--   📧 emma@trix.app      (Emma - 文学爱好者)
--   🔑 统一密码: trix2026
--
-- 💬 Mock数据:
--   ✅ 6个用户之间的好友关系
--   ✅ 丰富的聊天记录 (50+ 条消息)
--   ✅ 未读消息计数
--   ✅ 系统通知
--   ✅ 内部邮件
--   ✅ 学习记录
--   ✅ 虚拟自习室
--
-- 🔧 下一步:
--   1. 在 Supabase Dashboard > Authentication 中创建上述6个测试用户
--   2. 使用 xiaoming@trix.app / trix2026 登录应用
--   3. 即可看到完整的好友列表和聊天记录
--
-- ============================================

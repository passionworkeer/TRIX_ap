-- ============================================
-- 🔄 多用户支持 - 数据库更新脚本
-- ============================================
-- 用途: 添加第二个用户账户，实现用户间真实消息通信
-- ============================================

-- ============================================
-- 1. 添加第二个用户账户
-- ============================================

-- 插入第二个用户（你的朋友/测试账户）
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('00000000-0000-0000-0000-000000000002', 'friend@trix.app', 'friend_user', '测试好友', '', '另一个测试用户 🧪')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 建立双向好友关系
-- ============================================

-- 用户1 的好友列表中添加用户2
INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'user_00000000-0000-0000-0000-000000000002', '测试好友', '', 'online', '真实用户账户 👤', 60, false, NOW() - INTERVAL '6 days')
ON CONFLICT (friend_id) DO NOTHING;

-- 用户2 的好友列表中添加用户1
INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at) VALUES
('00000000-0000-0000-0000-000000000002', 'user_00000000-0000-0000-0000-000000000001', '我', '', 'online', '主账户 👑', 180, true, NOW() - INTERVAL '6 days')
ON CONFLICT (friend_id) DO NOTHING;

-- ============================================
-- 3. 添加用户间的测试聊天记录
-- ============================================

-- 用户1 和 用户2 之间的聊天记录
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('user_00000000-0000-0000-0000-000000000002', 'user', '嘿！测试一下新功能', NOW() - INTERVAL '2 hours'),
('user_00000000-0000-0000-0000-000000000002', 'friend', '收到！消息发送成功 ✅', NOW() - INTERVAL '1 hours 55 minutes'),
('user_00000000-0000-0000-0000-000000000002', 'user', '太好了！实时通信功能正常', NOW() - INTERVAL '1 hours 50 minutes'),
('user_00000000-0000-0000-0000-000000000002', 'friend', '是的，现在可以真实聊天了 🎉', NOW() - INTERVAL '1 hours 45 minutes');

-- ============================================
-- 4. 更新未读计数表
-- ============================================

-- 用户1 对用户2 的未读计数
INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time) VALUES
('00000000-0000-0000-0000-000000000001', 'user_00000000-0000-0000-0000-000000000002', 0, '是的，现在可以真实聊天了 🎉', NOW() - INTERVAL '1 hours 45 minutes')
ON CONFLICT (user_id, friend_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  last_message = EXCLUDED.last_message,
  last_message_time = EXCLUDED.last_message_time;

-- 用户2 对用户1 的未读计数
INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time) VALUES
('00000000-0000-0000-0000-000000000002', 'user_00000000-0000-0000-0000-000000000001', 0, '太好了！实时通信功能正常', NOW() - INTERVAL '1 hours 50 minutes')
ON CONFLICT (user_id, friend_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  last_message = EXCLUDED.last_message,
  last_message_time = EXCLUDED.last_message_time;

-- ============================================
-- 5. 为每个用户创建独立的 Clawbot 连接
-- ============================================

-- 用户1 的 Clawbot（已存在，保持不变）
-- friend_id: 'clawbot'

-- 用户2 的 Clawbot
INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at) VALUES
('00000000-0000-0000-0000-000000000002', 'clawbot', 'TRIX 机器人', '', 'online', '🤖 AI 智能助手 - 随时为你服务', 0, false, NOW())
ON CONFLICT (friend_id) DO NOTHING;

-- 用户2 的 Clawbot 初始消息
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('clawbot', 'bot', '你好！我是你的 TRIX 机器人。发送任何消息，我会通过你的电脑处理。', NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. 创建消息路由函数（用于用户间消息传递）
-- ============================================

CREATE OR REPLACE FUNCTION send_user_message(
  p_sender_user_id UUID,
  p_recipient_friend_id TEXT,
  p_text TEXT
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_recipient_user_id UUID;
BEGIN
  -- 生成消息 ID
  v_message_id := gen_random_uuid();
  
  -- 插入消息（发送者视角）
  INSERT INTO chat_messages (id, friend_id, sender, text, created_at)
  VALUES (v_message_id, p_recipient_friend_id, 'user', p_text, NOW());
  
  -- 提取接收者的实际 user_id（如果 friend_id 是 user_xxx 格式）
  IF p_recipient_friend_id LIKE 'user_%' THEN
    v_recipient_user_id := SUBSTRING(p_recipient_friend_id FROM 6)::UUID;
    
    -- 在接收者的聊天记录中插入消息（接收者视角）
    INSERT INTO chat_messages (friend_id, sender, text, created_at)
    VALUES ('user_' || p_sender_user_id::TEXT, 'friend', p_text, NOW());
    
    -- 更新接收者的未读计数
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES (v_recipient_user_id, 'user_' || p_sender_user_id::TEXT, 1, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      unread_count = unread_counts.unread_count + 1,
      last_message = EXCLUDED.last_message,
      last_message_time = EXCLUDED.last_message_time;
  END IF;
  
  -- 更新发送者的未读计数（最后消息时间）
  INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
  VALUES (p_sender_user_id, p_recipient_friend_id, 0, p_text, NOW())
  ON CONFLICT (user_id, friend_id) DO UPDATE SET
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 创建用户会话表（用于 Clawbot 个性化连接）
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB, -- 存储设备信息（电脑 IP、浏览器等）
  clawbot_endpoint TEXT, -- 用户个人电脑上的 Clawbot Gateway 地址
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);

-- 插入测试会话
INSERT INTO user_sessions (user_id, session_token, device_info, clawbot_endpoint, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'session_user1_pc', '{"ip": "192.168.101.4", "device": "PC"}', 'ws://192.168.101.4:18789', true),
('00000000-0000-0000-0000-000000000002', 'session_user2_pc', '{"ip": "192.168.101.5", "device": "PC"}', 'ws://192.168.101.5:18789', true)
ON CONFLICT (session_token) DO NOTHING;

-- ============================================
-- 8. 验证数据
-- ============================================

-- 查看所有用户
SELECT id, username, display_name, email FROM users ORDER BY created_at;

-- 查看用户1的好友列表
SELECT friend_id, name, status, bio FROM friends 
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC;

-- 查看用户2的好友列表
SELECT friend_id, name, status, bio FROM friends 
WHERE user_id = '00000000-0000-0000-0000-000000000002'
ORDER BY created_at DESC;

-- 查看用户间的聊天记录
SELECT friend_id, sender, text, created_at 
FROM chat_messages 
WHERE friend_id LIKE 'user_%'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 完成！
-- ============================================
-- 
-- 现在你有：
-- 1. ✅ 两个用户账户 (user1, user2)
-- 2. ✅ 双向好友关系
-- 3. ✅ 用户间消息路由功能
-- 4. ✅ 每个用户独立的 Clawbot 连接
-- 5. ✅ 会话管理（支持个性化 Gateway 端点）
--

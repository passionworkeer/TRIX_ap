-- ============================================
-- 🎯 TRIX 3D Companion - 补充测试数据
-- ============================================
-- 创建时间: 2026-02-10
-- 用途: 添加更多好友和聊天记录以测试真实场景
-- 使用方法: 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 添加更多好友
-- ============================================
INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying, created_at) VALUES
-- 新好友 1: Frank - 后端开发工程师
('00000000-0000-0000-0000-000000000001', 'frank', 'Frank', '', 'online', '🔧 后端开发 - Node.js & Python', 280, true, NOW() - INTERVAL '6 days'),

-- 新好友 2: Grace - 数据分析师
('00000000-0000-0000-0000-000000000001', 'grace', 'Grace', '', 'busy', '📊 数据分析 - SQL & Python', 350, false, NOW() - INTERVAL '7 days'),

-- 新好友 3: Henry - 游戏开发者
('00000000-0000-0000-0000-000000000001', 'henry', 'Henry', '', 'online', '🎮 Unity 游戏开发者', 190, true, NOW() - INTERVAL '8 days'),

-- 新好友 4: Iris - 产品经理
('00000000-0000-0000-0000-000000000001', 'iris', 'Iris', '', 'away', '💼 产品经理 - 用户体验优先', 120, false, NOW() - INTERVAL '9 days'),

-- 新好友 5: Jack - 移动端开发
('00000000-0000-0000-0000-000000000001', 'jack', 'Jack', '', 'online', '📱 Flutter & React Native', 260, true, NOW() - INTERVAL '10 days')
ON CONFLICT (friend_id) DO NOTHING;

-- ============================================
-- 添加 Frank 的聊天记录
-- ============================================
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('frank', 'friend', '嗨！后端 API 开发遇到问题了', NOW() - INTERVAL '4 hours'),
('frank', 'user', '什么问题？说说看', NOW() - INTERVAL '3 hours 55 minutes'),
('frank', 'friend', '数据库查询性能太慢,需要优化索引', NOW() - INTERVAL '3 hours 50 minutes'),
('frank', 'user', '用 EXPLAIN 分析过查询计划了吗？', NOW() - INTERVAL '3 hours 45 minutes'),
('frank', 'friend', '还没有,我现在试试', NOW() - INTERVAL '3 hours 40 minutes'),
('frank', 'friend', '找到问题了!缺少联合索引 👍', NOW() - INTERVAL '2 hours'),
('frank', 'user', '太好了！性能提升了多少？', NOW() - INTERVAL '1 hour 55 minutes'),
('frank', 'friend', '从 2 秒降到 0.1 秒,提升了 20 倍！', NOW() - INTERVAL '1 hour 50 minutes'),
('frank', 'user', '厉害！周末一起吃饭庆祝？', NOW() - INTERVAL '30 minutes'),
('frank', 'friend', '好啊！我请客 🍜', NOW() - INTERVAL '25 minutes');

-- ============================================
-- 添加 Grace 的聊天记录
-- ============================================
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('grace', 'friend', '你好！正在做数据分析项目', NOW() - INTERVAL '6 hours'),
('grace', 'user', '什么项目？听起来很有趣', NOW() - INTERVAL '5 hours 55 minutes'),
('grace', 'friend', '用户行为分析,发现了很多有趣的模式', NOW() - INTERVAL '5 hours 50 minutes'),
('grace', 'user', '能分享一下发现吗？', NOW() - INTERVAL '5 hours 45 minutes'),
('grace', 'friend', '用户最活跃的时间是晚上 8-10 点', NOW() - INTERVAL '5 hours 40 minutes'),
('grace', 'friend', '而且周末的留存率比工作日高 30%', NOW() - INTERVAL '5 hours 35 minutes'),
('grace', 'user', '这个洞察很有价值！可以优化推送策略', NOW() - INTERVAL '3 hours'),
('grace', 'friend', '对!我已经写好了分析报告', NOW() - INTERVAL '2 hours 55 minutes'),
('grace', 'friend', '下周一给老板汇报 🎯', NOW() - INTERVAL '45 minutes');

-- ============================================
-- 添加 Henry 的聊天记录
-- ============================================
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('henry', 'friend', '兄弟,我的游戏 Demo 做出来了！', NOW() - INTERVAL '5 hours'),
('henry', 'user', '真的吗？什么类型的游戏？', NOW() - INTERVAL '4 hours 55 minutes'),
('henry', 'friend', '一个 2D 平台跳跃游戏,用 Unity 做的', NOW() - INTERVAL '4 hours 50 minutes'),
('henry', 'user', '太酷了！能玩一下吗？', NOW() - INTERVAL '4 hours 45 minutes'),
('henry', 'friend', '当然!我给你发个测试版链接', NOW() - INTERVAL '4 hours 40 minutes'),
('henry', 'user', '收到！晚上试玩给你反馈', NOW() - INTERVAL '2 hours'),
('henry', 'friend', '太好了,期待你的意见 🎮', NOW() - INTERVAL '1 hour 55 minutes'),
('henry', 'friend', '对了,关卡设计有什么建议吗？', NOW() - INTERVAL '50 minutes'),
('henry', 'user', '我觉得难度曲线可以更平滑一点', NOW() - INTERVAL '45 minutes'),
('henry', 'friend', '好建议!我马上调整 ✨', NOW() - INTERVAL '40 minutes');

-- ============================================
-- 添加 Iris 的聊天记录
-- ============================================
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('iris', 'friend', '嗨！需要你帮忙做用户调研', NOW() - INTERVAL '8 hours'),
('iris', 'user', '没问题!调研什么内容？', NOW() - INTERVAL '7 hours 55 minutes'),
('iris', 'friend', '新功能的用户体验,需要收集反馈', NOW() - INTERVAL '7 hours 50 minutes'),
('iris', 'user', '好的,什么时候开始？', NOW() - INTERVAL '7 hours 45 minutes'),
('iris', 'friend', '明天下午 2 点,线上会议', NOW() - INTERVAL '7 hours 40 minutes'),
('iris', 'user', '收到!我准备一下问卷', NOW() - INTERVAL '4 hours'),
('iris', 'friend', '太好了,我们一起讨论问题设计', NOW() - INTERVAL '3 hours 55 minutes'),
('iris', 'friend', '用户反馈收集完了,数据很不错 📊', NOW() - INTERVAL '1 hour 20 minutes'),
('iris', 'user', '太好了!什么时候分析结果？', NOW() - INTERVAL '1 hour 15 minutes'),
('iris', 'friend', '今晚整理,明天分享给团队', NOW() - INTERVAL '1 hour 10 minutes');

-- ============================================
-- 添加 Jack 的聊天记录
-- ============================================
INSERT INTO chat_messages (friend_id, sender, text, created_at) VALUES
('jack', 'friend', '嘿!Flutter 新版本发布了', NOW() - INTERVAL '7 hours'),
('jack', 'user', '看到了!有什么新特性？', NOW() - INTERVAL '6 hours 55 minutes'),
('jack', 'friend', '性能提升很大,尤其是渲染速度', NOW() - INTERVAL '6 hours 50 minutes'),
('jack', 'user', '太棒了!准备升级项目吗？', NOW() - INTERVAL '6 hours 45 minutes'),
('jack', 'friend', '当然!周末就开始迁移', NOW() - INTERVAL '6 hours 40 minutes'),
('jack', 'friend', '需要帮忙测试吗？', NOW() - INTERVAL '3 hours 30 minutes'),
('jack', 'user', '可以啊,什么时候？', NOW() - INTERVAL '3 hours 25 minutes'),
('jack', 'friend', '下周一,我把测试环境准备好', NOW() - INTERVAL '3 hours 20 minutes'),
('jack', 'friend', 'App 已经上线了!🎉', NOW() - INTERVAL '35 minutes'),
('jack', 'user', '恭喜!发个链接我下载试试', NOW() - INTERVAL '30 minutes'),
('jack', 'friend', '已发到你邮箱了,快去看看！', NOW() - INTERVAL '28 minutes');

-- ============================================
-- 更新未读计数
-- ============================================
INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time) VALUES
('00000000-0000-0000-0000-000000000001', 'frank', 1, '好啊！我请客 🍜', NOW() - INTERVAL '25 minutes'),
('00000000-0000-0000-0000-000000000001', 'grace', 1, '下周一给老板汇报 🎯', NOW() - INTERVAL '45 minutes'),
('00000000-0000-0000-0000-000000000001', 'henry', 1, '好建议!我马上调整 ✨', NOW() - INTERVAL '40 minutes'),
('00000000-0000-0000-0000-000000000001', 'iris', 1, '今晚整理,明天分享给团队', NOW() - INTERVAL '1 hour 10 minutes'),
('00000000-0000-0000-0000-0000000000001', 'jack', 2, '已发到你邮箱了,快去看看！', NOW() - INTERVAL '28 minutes')
ON CONFLICT (user_id, friend_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  last_message = EXCLUDED.last_message,
  last_message_time = EXCLUDED.last_message_time;

-- ============================================
-- 添加更多通知
-- ============================================
INSERT INTO notifications (user_id, type, title, content, avatar_url, is_read, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'message', '新消息', 'Frank 给你发送了一条消息', '', false, NOW() - INTERVAL '25 minutes'),
('00000000-0000-0000-0000-000000000001', 'message', '新消息', 'Jack 给你发送了 2 条消息', '', false, NOW() - INTERVAL '28 minutes'),
('00000000-0000-0000-0000-000000000001', 'study', '学习提醒', 'Henry 邀请你一起学习 Unity', '', false, NOW() - INTERVAL '1 hour'),
('00000000-0000-0000-0000-000000000001', 'achievement', '成就解锁', '本周学习时长突破 10 小时！🎊', '', false, NOW() - INTERVAL '3 hours'),
('00000000-0000-0000-0000-000000000001', 'system', '系统通知', 'Grace 分享了数据分析报告', '', false, NOW() - INTERVAL '4 hours');

-- ============================================
-- 添加更多邮件
-- ============================================
INSERT INTO mails (user_id, from_name, from_avatar, subject, preview, content, is_read, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Frank', '', '周末聚餐安排', '周末一起吃饭庆祝数据库优化成功！我请客～', '详细内容...', false, NOW() - INTERVAL '25 minutes'),
('00000000-0000-0000-0000-000000000001', 'Jack', '', 'App 下载链接', '新版 App 已上线,快来下载体验吧！', '详细内容...', false, NOW() - INTERVAL '28 minutes'),
('00000000-0000-0000-0000-000000000001', 'Henry', '', '游戏测试邀请', 'Demo 版本已准备好,期待你的反馈意见！', '详细内容...', true, NOW() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000001', 'Iris', '', '用户调研会议', '明天下午 2 点线上会议,讨论用户调研问卷设计', '详细内容...', true, NOW() - INTERVAL '4 hours'),
('00000000-0000-0000-0000-000000000001', 'Grace', '', '数据分析报告分享', '本周用户行为分析报告已完成,分享给你参考', '详细内容...', false, NOW() - INTERVAL '45 minutes');

-- ============================================
-- ✅ 补充数据添加完成！
-- ============================================
-- 
-- 📊 新增内容：
-- - 5 个新好友 (Frank, Grace, Henry, Iris, Jack)
-- - 50 条新聊天记录
-- - 5 条新未读计数
-- - 5 条新通知
-- - 5 封新邮件
--
-- 📝 现在数据库中共有：
-- - 11 个好友
-- - 102 条聊天记录
-- - 11 条未读计数
-- - 10 条通知
-- - 9 封邮件
--
-- ============================================

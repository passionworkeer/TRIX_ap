-- ============================================
-- 🎯 TRIX 测试账号创建脚本
-- ============================================
-- 创建时间: 2026-02-10
-- 用途: 创建测试账号用于多设备测试
-- ============================================

-- ============================================
-- 重要说明:
-- ============================================
-- Supabase 的用户需要通过 auth.users 表创建
-- 但是 auth.users 表不允许直接 INSERT
-- 
-- 有两种方法创建测试账号:
--
-- 方法 1: 使用 Supabase Dashboard (推荐)
-- 1. 进入 Supabase Dashboard
-- 2. 点击 Authentication > Users
-- 3. 点击 "Add user" 按钮
-- 4. 手动添加以下用户
--
-- 方法 2: 使用应用的注册功能
-- 1. 在应用中点击"立即注册"
-- 2. 填写下面的信息进行注册
-- ============================================

-- ============================================
-- 测试账号信息 (手动创建)
-- ============================================

-- 账号 1: Alice (UI/UX 设计师)
-- Email: alice@trix.app
-- Password: 123456
-- 用户名: alice

-- 账号 2: Bob (算法竞赛爱好者)
-- Email: bob@trix.app
-- Password: 123456
-- 用户名: bob

-- 账号 3: Carol (机器学习研究生)
-- Email: carol@trix.app
-- Password: 123456
-- 用户名: carol

-- 账号 4: David (健身达人)
-- Email: david@trix.app
-- Password: 123456
-- 用户名: david

-- 账号 5: Emma (文学爱好者)
-- Email: emma@trix.app
-- Password: 123456
-- 用户名: emma

-- ============================================
-- 如果你有 Supabase Service Role Key,可以使用以下脚本
-- ============================================
-- 注意: 这需要在 Supabase SQL Editor 中使用 Service Role
-- 而且需要先设置 auth.uid() 函数

-- 方法 3: 使用 Supabase Admin API (通过代码)
-- 需要在后端或者 Supabase Edge Functions 中执行:
--
-- import { createClient } from '@supabase/supabase-js'
-- 
-- const supabase = createClient(
--   process.env.SUPABASE_URL,
--   process.env.SUPABASE_SERVICE_ROLE_KEY, // 注意: 这是 Service Role Key
--   { auth: { autoRefreshToken: false, persistSession: false } }
-- )
-- 
-- const { data, error } = await supabase.auth.admin.createUser({
--   email: 'alice@trix.app',
--   password: '123456',
--   email_confirm: true,
--   user_metadata: { username: 'alice' }
-- })

-- ============================================
-- 创建用户对应的 profiles 数据
-- ============================================
-- 注意: 这里的 UUID 需要替换为实际创建的用户 ID
-- 创建用户后,从 auth.users 表中获取真实的 user_id

-- 如果使用触发器自动创建 profile,则不需要手动插入
-- 但如果没有触发器,需要手动创建:

/*
-- 示例 (替换 UUID):
INSERT INTO profiles (id, username, full_name, avatar_url, bio) VALUES
('替换为Alice的UUID', 'alice', 'Alice', '', 'UI/UX 设计师 ✨ 热爱创意和美学'),
('替换为Bob的UUID', 'bob', 'Bob', '', '算法竞赛爱好者 🏆 代码改变世界'),
('替换为Carol的UUID', 'carol', 'Carol', '', '机器学习研究生 🤖 探索AI的未来'),
('替换为David的UUID', 'david', 'David', '', '健身达人 💪 热爱运动和编程'),
('替换为Emma的UUID', 'emma', 'Emma', '', '文学爱好者 📚 在书中寻找答案')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  bio = EXCLUDED.bio;
*/

-- ============================================
-- 推荐的创建流程 (最简单)
-- ============================================
-- 
-- 1. 在浏览器中打开你的应用: http://localhost:5173/
-- 2. 点击"立即注册"
-- 3. 依次注册以下账号:
--    - alice@trix.app / 123456 / alice
--    - bob@trix.app / 123456 / bob
--    - carol@trix.app / 123456 / carol
--    - david@trix.app / 123456 / david
--    - emma@trix.app / 123456 / emma
-- 
-- 这样会自动创建:
-- ✅ auth.users 表中的用户记录
-- ✅ profiles 表中的用户资料
-- ✅ 所有必要的关联数据
-- 
-- ============================================

-- ============================================
-- 创建好友关系 (在用户创建后执行)
-- ============================================
-- 注意: 需要先获取所有用户的真实 UUID

/*
-- 示例: 让 Alice 和 Bob 互为好友
-- 第一步: 获取用户 ID
SELECT id, email FROM auth.users WHERE email IN ('alice@trix.app', 'bob@trix.app');

-- 第二步: 使用获取到的 ID 创建好友关系
-- 假设 Alice 的 ID 是 'alice-uuid-here'
-- 假设 Bob 的 ID 是 'bob-uuid-here'

INSERT INTO friends (user_id, friend_id, name, avatar_url, status, bio, study_time, is_studying) VALUES
('alice-uuid-here', 'bob', 'Bob', '', 'online', '算法竞赛爱好者 🏆 代码改变世界', 180, true),
('bob-uuid-here', 'alice', 'Alice', '', 'online', 'UI/UX 设计师 ✨ 热爱创意和美学', 240, true)
ON CONFLICT (friend_id) DO NOTHING;
*/

-- ============================================
-- 验证账号创建成功
-- ============================================
-- 运行以下查询检查用户是否创建成功:

-- 查看所有测试用户
SELECT id, email, created_at, confirmed_at 
FROM auth.users 
WHERE email LIKE '%@trix.app' 
ORDER BY created_at DESC;

-- 查看对应的 profiles
SELECT p.id, p.username, p.full_name, p.bio, p.created_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email LIKE '%@trix.app'
ORDER BY p.created_at DESC;

-- ============================================
-- ✅ 创建完成后的测试
-- ============================================
-- 
-- 1. 设备 1: 使用 alice@trix.app / 123456 登录
-- 2. 设备 2: 使用 bob@trix.app / 123456 登录
-- 3. 测试实时通讯功能
-- 
-- ============================================

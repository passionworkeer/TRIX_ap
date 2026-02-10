-- ============================================
-- 同步 Auth 用户到 Users 表
-- ============================================
-- 用途: 将 auth.users 中的用户同步到 public.users 表
-- 使用场景: 当通过 Supabase Dashboard 创建用户后，需要同步到 users 表
-- ============================================

-- 方法 1: 手动插入所有测试用户
-- 如果你已经在 Supabase Auth 中创建了用户，但 users 表为空

-- 首先，查看 auth.users 中的所有用户
SELECT id, email, created_at 
FROM auth.users 
WHERE email LIKE '%@trix.app'
ORDER BY email;

-- 然后，手动插入到 users 表
-- 注意: 替换下面的 UUID 为你实际的用户 ID

INSERT INTO users (id, email, username, display_name, bio) VALUES
  ('你的xiaoming用户UUID', 'xiaoming@trix.app', 'xiaoming', '小明', '热爱编程的学生 💻'),
  ('你的alice用户UUID', 'alice@trix.app', 'alice', 'Alice', 'UI/UX 设计师 ✨'),
  ('你的bob用户UUID', 'bob@trix.app', 'bob', 'Bob', '算法竞赛爱好者 🏆'),
  ('你的carol用户UUID', 'carol@trix.app', 'carol', 'Carol', '机器学习研究生 🤖'),
  ('你的david用户UUID', 'david@trix.app', 'david', 'David', '健身达人 💪'),
  ('你的emma用户UUID', 'emma@trix.app', 'emma', 'Emma', '文学爱好者 📚')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio;

-- ============================================
-- 方法 2: 自动同步所有 @trix.app 用户
-- ============================================

INSERT INTO users (id, email, username, display_name, bio)
SELECT 
  au.id,
  au.email,
  SPLIT_PART(au.email, '@', 1) as username,  -- 从邮箱提取用户名
  SPLIT_PART(au.email, '@', 1) as display_name,
  '' as bio
FROM auth.users au
WHERE au.email LIKE '%@trix.app'
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
  );

-- ============================================
-- 验证同步结果
-- ============================================

-- 查看 users 表中的所有用户
SELECT id, email, username, display_name, created_at 
FROM users 
ORDER BY email;

-- 对比 auth.users 和 users 表
SELECT 
  au.email as auth_email,
  u.email as users_email,
  CASE 
    WHEN u.id IS NULL THEN '❌ 缺失'
    ELSE '✅ 已同步'
  END as status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email LIKE '%@trix.app'
ORDER BY au.email;

-- ============================================
-- 清理和重置（谨慎使用！）
-- ============================================

-- 如果需要重新开始，删除 users 表中的所有数据
-- ⚠️ 警告: 这会删除所有用户数据和相关的好友关系！
-- DELETE FROM users WHERE email LIKE '%@trix.app';

-- ============================================
-- 创建触发器：自动同步新注册用户
-- ============================================
-- 当在 auth.users 中创建新用户时，自动在 users 表中创建对应记录

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name, bio)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'bio', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 测试触发器
-- ============================================
-- 现在创建新用户时，会自动在 users 表中创建记录
-- 你可以在 Supabase Dashboard 中创建新用户来测试

-- ============================================
-- 常见问题排查
-- ============================================

-- Q1: 为什么推荐好友显示自己？
-- A: 检查当前登录用户的 ID 是否在 users 表中

SELECT 
  au.id as auth_id,
  au.email as auth_email,
  u.id as users_id,
  u.email as users_email
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = '当前登录的邮箱';

-- Q2: 为什么添加好友失败提示"获取用户信息失败"？
-- A: 检查 users 表中是否缺少该用户

SELECT id, email, username FROM users WHERE email = 'xiaoming@trix.app';

-- 如果返回空，说明需要同步数据

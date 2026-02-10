-- ============================================
-- 🔐 快速创建 Auth 用户脚本
-- ============================================
-- 此脚本用于在 Supabase Auth 中批量创建测试用户
-- 注意: 需要管理员权限才能直接操作 auth.users 表
-- ============================================

-- 方式 1: 使用 Supabase Admin API (推荐)
-- 请在你的后端或 Supabase Edge Function 中使用以下代码:

/*
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 需要 service_role key
)

const testUsers = [
  { email: 'xiaoming@trix.app', password: 'trix2026', id: '11111111-1111-1111-1111-111111111111' },
  { email: 'alice@trix.app', password: 'trix2026', id: '22222222-2222-2222-2222-222222222222' },
  { email: 'bob@trix.app', password: 'trix2026', id: '33333333-3333-3333-3333-333333333333' },
  { email: 'carol@trix.app', password: 'trix2026', id: '44444444-4444-4444-4444-444444444444' },
  { email: 'david@trix.app', password: 'trix2026', id: '55555555-5555-5555-5555-555555555555' },
  { email: 'emma@trix.app', password: 'trix2026', id: '66666666-6666-6666-6666-666666666666' }
]

async function createTestUsers() {
  for (const user of testUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.email.split('@')[0] }
    })
    
    if (error) {
      console.error(`创建用户 ${user.email} 失败:`, error)
    } else {
      console.log(`✅ 创建用户 ${user.email} 成功, ID: ${data.user.id}`)
      
      // 更新用户 ID 为自定义 UUID
      const { error: updateError } = await supabase.rpc('update_user_id', {
        old_id: data.user.id,
        new_id: user.id
      })
      
      if (updateError) {
        console.error(`更新用户 ${user.email} 的 ID 失败:`, updateError)
      } else {
        console.log(`✅ 更新用户 ${user.email} 的 ID 成功`)
      }
    }
  }
}

createTestUsers()
*/

-- ============================================
-- 方式 2: 手动在 Supabase Dashboard 创建
-- ============================================
-- 1. 访问 Supabase Dashboard → Authentication → Users
-- 2. 点击 "Add user" → "Create new user"
-- 3. 按照以下信息创建每个用户:

-- 用户 1: 小明
-- Email: xiaoming@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 11111111-1111-1111-1111-111111111111

-- 用户 2: Alice
-- Email: alice@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 22222222-2222-2222-2222-222222222222

-- 用户 3: Bob
-- Email: bob@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 33333333-3333-3333-3333-333333333333

-- 用户 4: Carol
-- Email: carol@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 44444444-4444-4444-4444-444444444444

-- 用户 5: David
-- Email: david@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 55555555-5555-5555-5555-555555555555

-- 用户 6: Emma
-- Email: emma@trix.app
-- Password: trix2026
-- Auto Confirm: ✅ 勾选
-- Advanced Settings → User UID: 66666666-6666-6666-6666-666666666666

-- ============================================
-- 验证用户创建成功
-- ============================================
-- 在 SQL Editor 中执行以下查询:

SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  u.username,
  u.display_name
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email LIKE '%@trix.app'
ORDER BY au.email;

-- 预期结果: 应该看到 6 个用户，且 auth.users 的 ID 与 public.users 的 ID 一致

-- ============================================
-- 如果 ID 不一致，可以使用以下脚本修正
-- ============================================
-- ⚠️ 警告: 此操作会修改 auth.users 表，请谨慎执行

-- 创建用于更新用户 ID 的辅助函数
CREATE OR REPLACE FUNCTION update_auth_user_id(
  old_user_id UUID,
  new_user_id UUID
) RETURNS void AS $$
BEGIN
  -- 更新 auth.users 表
  UPDATE auth.users 
  SET id = new_user_id 
  WHERE id = old_user_id;
  
  -- 更新 public.users 表
  UPDATE public.users 
  SET id = new_user_id 
  WHERE id = old_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 使用示例 (如果需要修正 ID):
-- SELECT update_auth_user_id('实际的UUID', '11111111-1111-1111-1111-111111111111');

-- ============================================
-- 清理函数
-- ============================================
-- DROP FUNCTION IF EXISTS update_auth_user_id;

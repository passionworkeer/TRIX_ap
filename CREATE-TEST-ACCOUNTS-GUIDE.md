# 📝 快速创建测试账号指南

## 🎯 问题说明

由于 Supabase 的认证系统限制,不能直接通过 SQL 创建用户账号。

## ✅ 解决方案 - 使用应用注册功能

### 方法 1: 在应用中注册 (最简单,推荐)

1. **打开应用**: 访问 http://localhost:5173/

2. **注册账号 1 - Alice**:
   - 点击"立即注册"
   - 用户名: `alice`
   - 邮箱: `alice@trix.app`
   - 密码: `123456`
   - 点击注册

3. **退出登录**: 注册成功后,在个人中心点击"退出登录"

4. **注册账号 2 - Bob**:
   - 点击"立即注册"
   - 用户名: `bob`
   - 邮箱: `bob@trix.app`
   - 密码: `123456`
   - 点击注册

5. **完成**: 现在你有两个测试账号可以用了!

---

### 方法 2: 使用 Supabase Dashboard

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单 **Authentication** > **Users**
4. 点击右上角 **"Add user"** 按钮
5. 填写信息:
   - Email: `alice@trix.app`
   - Password: `123456`
   - 勾选 "Auto Confirm User" (自动确认用户)
6. 点击 **"Create user"**
7. 重复步骤 5-6 创建 `bob@trix.app`

**重要**: 使用此方法创建用户后,需要手动创建 profiles 记录!

---

### 方法 3: 使用 Supabase Service Role (高级)

如果你有 Service Role Key,可以使用以下代码:

\`\`\`typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SERVICE_ROLE_KEY', // ⚠️ 不要暴露在客户端!
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 创建用户
const { data, error } = await supabase.auth.admin.createUser({
  email: 'alice@trix.app',
  password: '123456',
  email_confirm: true,
  user_metadata: {
    username: 'alice'
  }
})

if (!error) {
  console.log('用户创建成功:', data.user.id)
  
  // 创建 profile
  await supabase.from('profiles').insert({
    id: data.user.id,
    username: 'alice',
    full_name: 'Alice',
    bio: 'UI/UX 设计师 ✨'
  })
}
\`\`\`

---

## 🧪 测试账号列表

创建以下账号用于测试:

| 用户名 | 邮箱 | 密码 | 角色 |
|--------|------|------|------|
| alice | alice@trix.app | 123456 | UI/UX 设计师 |
| bob | bob@trix.app | 123456 | 算法爱好者 |
| carol | carol@trix.app | 123456 | 机器学习研究生 |
| david | david@trix.app | 123456 | 健身达人 |
| emma | emma@trix.app | 123456 | 文学爱好者 |

---

## ✅ 验证账号创建成功

在 Supabase SQL Editor 中运行:

\`\`\`sql
-- 查看所有测试用户
SELECT id, email, created_at, confirmed_at 
FROM auth.users 
WHERE email LIKE '%@trix.app' 
ORDER BY created_at DESC;

-- 查看对应的 profiles
SELECT p.id, p.username, p.full_name, p.bio
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email LIKE '%@trix.app'
ORDER BY p.created_at DESC;
\`\`\`

---

## 🚀 开始测试

创建账号后:

1. **设备 1**: 登录 `alice@trix.app` / `123456`
2. **设备 2**: 登录 `bob@trix.app` / `123456`
3. 开始测试实时聊天功能!

---

## 🐛 常见问题

### Q: 注册后显示"请检查邮箱确认"?

**A**: 在 Supabase Dashboard 中:
1. 进入 Authentication > Users
2. 找到对应用户
3. 点击用户,然后点击 "Confirm user" 按钮

或者在创建用户时勾选 "Auto Confirm User"

### Q: 登录失败显示"Invalid credentials"?

**A**: 检查:
1. 邮箱和密码是否正确
2. 用户是否已经被确认 (confirmed_at 不为空)
3. Supabase 项目配置是否正确

---

**最后更新**: 2026-02-10

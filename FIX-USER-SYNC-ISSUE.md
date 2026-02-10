# 🔧 修复"获取用户信息失败"和"推荐好友显示自己"问题

## 问题原因

1. **获取用户信息失败**: `users` 表中没有当前登录用户的记录
2. **推荐好友显示自己**: 用户 ID 不匹配或数据不一致

## 🚀 快速解决方案

### 步骤 1: 同步 Auth 用户到 Users 表

在 Supabase SQL Editor 中执行以下 SQL：

```sql
-- 自动同步所有 @trix.app 用户
INSERT INTO users (id, email, username, display_name, bio)
SELECT 
  au.id,
  au.email,
  SPLIT_PART(au.email, '@', 1) as username,
  SPLIT_PART(au.email, '@', 1) as display_name,
  '' as bio
FROM auth.users au
WHERE au.email LIKE '%@trix.app'
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
  );
```

### 步骤 2: 验证同步结果

```sql
-- 查看所有用户
SELECT id, email, username, display_name FROM users ORDER BY email;

-- 检查是否有遗漏
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
```

### 步骤 3: 设置自动触发器（可选）

这样以后创建新用户时会自动同步：

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name, bio)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1),
    SPLIT_PART(NEW.email, '@', 1),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## ✅ 验证修复

1. **刷新页面**，重新登录
2. **打开浏览器控制台**（F12）
3. **进入聊天页面**，查看控制台输出：
   ```
   当前用户ID: xxx-xxx-xxx
   当前用户邮箱: xiaoming@trix.app
   获取到的所有用户: [...]
   推荐的用户: [Alice, Bob, Carol, ...]
   ```
4. **推荐好友不应该包含自己**
5. **点击添加好友应该成功**

## 🔍 调试信息

我已经在代码中添加了详细的 console.log，可以帮助你诊断问题：

- `当前用户ID`: 显示登录用户的 UUID
- `获取到的所有用户`: 显示从数据库查询的用户列表
- `已添加的好友`: 显示已经添加的好友
- `推荐的用户`: 显示最终推荐的用户列表

如果推荐列表中还有自己，检查：
1. 控制台中的 `当前用户ID` 
2. `获取到的所有用户` 中是否有相同 ID 的用户
3. 数据库中是否有重复记录

## 📝 代码改进

### 1. addFriend 函数自动创建用户

如果用户不存在于 `users` 表，会自动创建：

```typescript
// 如果当前用户不在 users 表中，自动创建
if (!currentUser) {
  const username = currentUserEmail?.split('@')[0] || 'user';
  await supabase.from('users').insert({
    id: currentUserId,
    email: currentUserEmail,
    username: username,
    display_name: username,
    bio: ''
  });
}
```

### 2. 推荐好友多重过滤

```typescript
const notFriends = (allUsers || []).filter(user => 
  !friendIds.has(user.id) && 
  user.id !== currentUserId &&        // 通过 ID 排除
  user.email !== currentUserEmail     // 通过邮箱排除
);
```

## ⚠️ 如果问题仍然存在

### 检查数据一致性

```sql
-- 查找当前登录用户
SELECT * FROM auth.users WHERE email = 'xiaoming@trix.app';
-- 记下返回的 ID

-- 检查 users 表
SELECT * FROM users WHERE email = 'xiaoming@trix.app';
-- 比对 ID 是否一致

-- 如果 ID 不一致，删除重建
DELETE FROM users WHERE email = 'xiaoming@trix.app';
-- 然后重新执行步骤1的同步 SQL
```

### 清空缓存

1. 清空浏览器缓存
2. 退出登录
3. 重新登录
4. 再次测试

## 🎉 完成

执行完步骤 1 后，问题应该解决了。如果还有问题，查看浏览器控制台的调试信息。

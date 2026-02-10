# 🎯 TRIX 数据库重构 - 快速使用指南

## 📦 已为你准备的文件

1. **complete-init.sql** - 完整数据库初始化脚本
   - 创建所有 9 张数据表
   - 插入 6 个测试用户的数据
   - 添加好友关系、聊天记录、通知等 Mock 数据

2. **CREATE-USERS-GUIDE.md** - 详细的用户创建指南
   - 完整的步骤说明
   - 常见问题解答
   - 数据验证方法

3. **create-test-users.js** - 自动创建用户脚本
   - Node.js 脚本，一键创建所有测试用户
   - 需要 Service Role Key

## 🚀 最简单的使用方式 (3 步完成)

### 第一步: 执行数据库脚本

1. 打开 [Supabase Dashboard](https://app.supabase.com)
2. 进入你的项目
3. 点击左侧 **SQL Editor**
4. 点击 **New query**
5. 复制粘贴 `complete-init.sql` 的全部内容
6. 点击 **Run** 按钮

✅ **完成**: 数据库表和测试数据已创建

---

### 第二步: 创建测试用户账号

**在 Supabase Dashboard 中手动创建 (推荐，最简单)**:

1. 点击 **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 按照以下信息创建 **6 个用户**:

```
用户 1 (主账号):
  Email: xiaoming@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"

用户 2:
  Email: alice@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"

用户 3:
  Email: bob@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"

用户 4:
  Email: carol@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"

用户 5:
  Email: david@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"

用户 6:
  Email: emma@trix.app
  Password: trix2026
  ✅ 勾选 "Auto Confirm User"
```

✅ **完成**: 6 个测试账号已创建

---

### 第三步: 更新代码中的用户 ID

1. 打开 `src/config/supabase.ts`
2. 找到 `CURRENT_USER_ID` 常量
3. 修改为:

```typescript
export const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
```

4. 保存文件

✅ **完成**: 配置已更新

---

## 🎉 开始使用

现在你可以:

1. 启动应用: `npm run dev`
2. 使用 `xiaoming@trix.app` / `trix2026` 登录
3. 查看好友列表 (应该有 5 个好友)
4. 查看聊天记录 (每个好友都有消息)
5. 查看通知和邮件

---

## 📊 测试账号信息

| 账号 | 邮箱 | 密码 | 角色 |
|------|------|------|------|
| 小明 | xiaoming@trix.app | trix2026 | 主账号(你) |
| Alice | alice@trix.app | trix2026 | 设计师好友 |
| Bob | bob@trix.app | trix2026 | 算法高手 |
| Carol | carol@trix.app | trix2026 | AI研究生 |
| David | david@trix.app | trix2026 | 健身达人 |
| Emma | emma@trix.app | trix2026 | 文学爱好者 |

---

## 🔍 验证数据是否正确

在 Supabase SQL Editor 中执行:

```sql
-- 检查用户数量 (应该是 6)
SELECT COUNT(*) FROM users;

-- 检查小明的好友 (应该有 5 个)
SELECT * FROM friends 
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 检查聊天记录 (应该有 50+ 条)
SELECT COUNT(*) FROM chat_messages;

-- 查看好友列表
SELECT * FROM friend_latest_messages 
WHERE user_id = '11111111-1111-1111-1111-111111111111'
ORDER BY sort_time DESC;
```

---

## ⚠️ 常见问题

### Q: 登录后看不到好友?

**A**: 检查以下几点:
1. 是否已执行 `complete-init.sql`
2. 是否创建了所有 6 个测试用户
3. `CURRENT_USER_ID` 是否设置为 `11111111-1111-1111-1111-111111111111`

### Q: 用户 ID 不一致怎么办?

**A**: 
- Supabase 会自动生成 UUID
- 数据库脚本中已经使用固定 UUID
- 只要在 Auth 中创建用户后，用户 ID 会自动匹配

实际上，你不需要手动设置自定义 UUID！数据库脚本使用的是 `ON CONFLICT DO UPDATE`，会自动处理。

### Q: 想添加更多测试数据?

**A**: 
- 修改 `complete-init.sql` 中的 INSERT 语句
- 或在 SQL Editor 中直接插入新数据
- 参考现有格式即可

---

## 📝 高级选项

### 使用 Node.js 脚本自动创建用户

如果你想用脚本批量创建:

1. 在 `.env` 文件中添加:
   ```
   SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
   ```

2. 运行脚本:
   ```bash
   npm install @supabase/supabase-js dotenv
   node src/database/create-test-users.js
   ```

**不推荐**，因为手动创建更简单直接。

---

## ✅ 完成！

如果你完成了上面 3 个步骤，现在应该可以:

- ✅ 使用 6 个不同账号登录
- ✅ 查看丰富的好友列表
- ✅ 查看真实的聊天记录
- ✅ 看到未读消息提示
- ✅ 收到通知和邮件
- ✅ 记录学习时长

有问题请查看 `CREATE-USERS-GUIDE.md` 的详细说明。

祝使用愉快！🎉

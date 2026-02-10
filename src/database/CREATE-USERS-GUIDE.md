# 🎯 TRIX 数据库重构完整指南

## 📋 概述

本指南将帮助你完全重建 TRIX 数据库，包括创建所有表结构、测试用户和 Mock 数据。

## 🚀 快速开始

### 第一步: 执行数据库初始化脚本

1. 打开 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**
5. 复制 `complete-init.sql` 的全部内容粘贴进去
6. 点击 **Run** 执行

**执行时间**: 约 5-10 秒

**结果**: 
- ✅ 9 张数据表创建完成
- ✅ 好友关系已建立
- ✅ 50+ 条聊天记录
- ✅ 通知、邮件、学习记录等 Mock 数据

---

### 第二步: 创建测试用户账号

由于 Supabase Auth 需要单独创建用户，你有两种方式：

#### 方式 A: 使用 Supabase Dashboard (推荐，最简单)

1. 在 Supabase Dashboard 点击 **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 创建以下 6 个用户：

| 邮箱 | 密码 | 用户名 | 说明 |
|------|------|--------|------|
| `xiaoming@trix.app` | `trix2026` | 小明 | 主账号(你自己) |
| `alice@trix.app` | `trix2026` | Alice | 设计师好友 |
| `bob@trix.app` | `trix2026` | Bob | 算法高手 |
| `carol@trix.app` | `trix2026` | Carol | AI研究生 |
| `david@trix.app` | `trix2026` | David | 健身达人 |
| `emma@trix.app` | `trix2026` | Emma | 文学爱好者 |

**重要**: 
- ✅ 确保勾选 **Auto Confirm User** (自动确认用户)
- ✅ 每个用户的 UUID 必须与数据库中的一致：
  - xiaoming: `11111111-1111-1111-1111-111111111111`
  - alice: `22222222-2222-2222-2222-222222222222`
  - bob: `33333333-3333-3333-3333-333333333333`
  - carol: `44444444-4444-4444-4444-444444444444`
  - david: `55555555-5555-5555-5555-555555555555`
  - emma: `66666666-6666-6666-6666-666666666666`

**如何设置自定义 UUID**:
- 在创建用户时，点击 **Advanced settings**
- 在 **User UID** 字段中输入上面对应的 UUID
- 然后保存

#### 方式 B: 使用注册页面 (需要修改代码)

如果你想通过应用的注册页面创建用户，需要：

1. 临时禁用邮箱验证 (Supabase Dashboard → Authentication → Settings)
2. 将 **Enable email confirmations** 设为 OFF
3. 在应用中注册上述 6 个账号
4. 然后手动修改数据库中的用户 ID

**不推荐此方式**，因为 UUID 会随机生成，需要大量手动修改。

---

### 第三步: 验证数据

在 SQL Editor 中执行以下查询，检查数据是否正确：

```sql
-- 1. 检查用户数量 (应该是 6)
SELECT COUNT(*) FROM users;

-- 2. 检查好友关系 (应该有多条)
SELECT * FROM friends WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 3. 检查聊天记录
SELECT COUNT(*) FROM chat_messages;

-- 4. 检查未读消息
SELECT * FROM unread_counts WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 5. 查看好友列表视图
SELECT * FROM friend_latest_messages 
WHERE user_id = '11111111-1111-1111-1111-111111111111'
ORDER BY sort_time DESC;
```

预期结果:
- ✅ 6 个用户
- ✅ 小明有 5 个好友
- ✅ 50+ 条聊天消息
- ✅ 5 条未读计数记录

---

### 第四步: 登录测试

1. 启动你的应用: `npm run dev`
2. 使用 `xiaoming@trix.app` / `trix2026` 登录
3. 你应该能看到:
   - ✅ 5 个好友 (Alice, Bob, Carol, David, Emma)
   - ✅ 每个好友都有聊天记录
   - ✅ 有未读消息的红点提示
   - ✅ 通知和邮件

---

## 📊 数据库架构说明

### 核心表结构

1. **users** - 用户基本信息
   - `id`: UUID (与 auth.users.id 对应)
   - `email`: 邮箱 (唯一)
   - `username`: 用户名 (唯一)
   - `display_name`: 显示名称
   - `bio`: 个人简介

2. **friends** - 好友关系 (双向存储)
   - `user_id`: 用户 ID
   - `friend_id`: 好友 ID
   - `status`: 在线状态 (online/offline/busy/away)
   - `is_studying`: 是否正在学习

3. **chat_messages** - 聊天消息
   - `conversation_id`: 会话 ID (用于分组)
   - `sender_id`: 发送者 ID
   - `receiver_id`: 接收者 ID
   - `text`: 消息内容

4. **unread_counts** - 未读消息计数
   - `user_id`: 用户 ID
   - `friend_id`: 好友 ID
   - `unread_count`: 未读数量
   - `last_message`: 最后一条消息

5. **notifications** - 通知
6. **mails** - 内部邮件
7. **study_sessions** - 学习记录
8. **study_rooms** - 虚拟自习室
9. **study_room_members** - 自习室成员

### 视图

- **friend_latest_messages** - 好友列表视图 (包含最新消息和未读数)

---

## 🔧 常见问题

### Q1: 执行 SQL 脚本时报错？

**A**: 确保你在 Supabase 的 SQL Editor 中执行，不是本地 PostgreSQL。

### Q2: 创建用户时无法设置自定义 UUID？

**A**: 
1. 使用 Supabase Dashboard 创建用户
2. 点击 **Advanced settings**
3. 在 **User UID** 字段输入 UUID
4. 如果仍无法设置，可以先创建用户，然后在 SQL Editor 中执行：

```sql
-- 更新用户 ID (需要先删除外键约束)
UPDATE auth.users SET id = '11111111-1111-1111-1111-111111111111' 
WHERE email = 'xiaoming@trix.app';
```

### Q3: 登录后看不到好友列表？

**A**: 检查以下几点:
1. 用户 ID 是否正确 (`11111111-1111-1111-1111-111111111111`)
2. friends 表中是否有对应的好友关系
3. 执行上面的验证 SQL 查询

### Q4: 聊天记录显示不出来？

**A**: 
1. 检查 `chat_messages` 表是否有数据
2. 检查 `conversation_id` 是否正确
3. 确认前端代码中的用户 ID 常量

### Q5: 我想添加更多测试数据怎么办？

**A**: 你可以：
1. 修改 `complete-init.sql` 添加更多 INSERT 语句
2. 或者在 SQL Editor 中直接插入新数据
3. 参考现有的 INSERT 语句格式

---

## 🎨 自定义

### 修改用户信息

在 `complete-init.sql` 中找到用户插入部分：

```sql
INSERT INTO users (id, email, username, display_name, avatar_url, bio) VALUES
('11111111-1111-1111-1111-111111111111', 'xiaoming@trix.app', 'xiaoming', '小明', '', '热爱编程的学生 💻')
```

修改 `display_name` 和 `bio` 即可。

### 添加更多聊天记录

复制现有的聊天记录 INSERT 语句，修改内容和时间：

```sql
INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, text, created_at) VALUES
('会话ID', '发送者ID', '接收者ID', '消息内容', NOW() - INTERVAL '1 hour');
```

### 添加头像

1. 上传图片到 Supabase Storage
2. 获取公开 URL
3. 更新 users 表的 `avatar_url` 字段

---

## 📝 代码迁移

### 更新 AuthContext.tsx

如果你使用固定用户 ID，需要更新：

```typescript
// 旧代码
export const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// 新代码
export const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
```

### 更新 databaseService.ts

聊天消息的结构已改变，需要更新相关函数：

**旧结构**:
```typescript
{
  friend_id: 'alice',  // 字符串
  sender: 'user' | 'friend' | 'bot'
}
```

**新结构**:
```typescript
{
  conversation_id: 'uuid_uuid',  // 会话ID
  sender_id: UUID,               // 发送者UUID
  receiver_id: UUID              // 接收者UUID
}
```

---

## 🚨 注意事项

1. **UUID 必须一致**: 确保 auth.users 的 ID 与 users 表的 ID 完全一致
2. **密码统一**: 所有测试账号密码都是 `trix2026`，便于测试
3. **RLS 策略**: 当前为开发模式(全开放)，生产环境需要收紧
4. **数据备份**: 执行脚本前，如果有重要数据请先备份

---

## ✅ 完成检查清单

- [ ] 在 SQL Editor 中执行 `complete-init.sql`
- [ ] 创建 6 个测试用户账号
- [ ] 设置正确的自定义 UUID
- [ ] 执行验证 SQL 查询
- [ ] 使用 xiaoming@trix.app 登录测试
- [ ] 检查好友列表显示
- [ ] 检查聊天记录显示
- [ ] 检查未读消息提示
- [ ] 更新代码中的用户 ID 常量

---

## 🎉 完成！

如果以上步骤都完成了，你的 TRIX 应用应该已经可以正常使用了！

你现在可以：
- ✅ 使用 6 个不同的账号登录
- ✅ 查看丰富的聊天记录
- ✅ 收发消息（需要实现实时功能）
- ✅ 查看通知和邮件
- ✅ 记录学习时长
- ✅ 加入虚拟自习室

如有问题，请检查上面的常见问题章节。

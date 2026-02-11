# 🎯 立即开始测试（数据库已就绪）

既然你已经用 `complete-init.sql` 创建了数据库，表结构应该是正确的！

## ✅ 第 1 步：验证数据库（30 秒）

在 Supabase SQL Editor 执行：

```sql
-- 快速检查表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;
```

**期望结果：**
```
column_name      | data_type
-----------------+-----------
id               | uuid
conversation_id  | text      ✅
sender_id        | uuid      ✅
receiver_id      | uuid      ✅
text             | text
is_read          | boolean
created_at       | timestamp
```

如果看到 `conversation_id`, `sender_id`, `receiver_id`，说明 ✅ **表结构正确**！

## ✅ 第 2 步：启用 Realtime（1 分钟）

1. 打开 Supabase Dashboard
2. 前往 **Database** → **Replication**
3. 找到 `chat_messages` 表
4. 确保右侧开关是 **绿色/开启** 状态

## ✅ 第 3 步：临时禁用 RLS（快速测试）

```sql
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
```

> 💡 这样可以快速测试功能，之后再配置正确的 RLS 策略。

## ✅ 第 4 步：获取测试账号 UUID

```sql
SELECT id, email, username FROM users ORDER BY created_at DESC LIMIT 5;
```

复制两个账号的 **完整 UUID**：

```
账号 A (123@trix.app):
UUID: _____________________________________

账号 B (1234@trix.app):
UUID: _____________________________________
```

## ✅ 第 5 步：确保互为好友

```sql
-- 查看好友关系
SELECT 
  u1.email as user,
  u2.email as friend
FROM friends f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
WHERE u1.email IN ('123@trix.app', '1234@trix.app')
LIMIT 10;
```

如果没有好友关系，在应用中添加好友（或执行 SQL 插入）。

## 🧪 第 6 步：双窗口测试

### 准备

- **窗口 A**: 正常浏览器，登录 `123@trix.app`
- **窗口 B**: 隐身窗口 (Ctrl+Shift+N)，登录 `1234@trix.app`

### 操作

1. **两个窗口都按 F12** 打开控制台
2. 进入 Chat 页面 → 点击对方头像进入聊天
3. **点击右上角 🧪** 开启测试模式
4. **确认两个窗口的"会话 ID"相同！** （非常重要）

### 发送测试

**窗口 A 发送：**
- 输入 "Hello from A"
- 点击发送
- 查看控制台应该有：

```
🚀 [发送消息] 开始
📦 [会话ID]: xxx_yyy
✅ [发送成功]
```

**窗口 B 应该看到：**
- 控制台：

```
📡 [Realtime] 订阅状态: SUBSCRIBED
📨 [Realtime] 收到新消息
✅ [Realtime] 添加新消息到列表
```

- UI：消息出现在左侧（白色气泡）

## ✅ 成功标志

- [ ] 窗口 A：消息发送成功（控制台显示 `✅ [发送成功]`）
- [ ] 窗口 A：消息显示在右侧（蓝色气泡）
- [ ] 窗口 B：实时收到消息（控制台显示 `✅ [Realtime] 添加新消息`）
- [ ] 窗口 B：消息显示在左侧（白色气泡）
- [ ] 反向发送成功（B → A）

## ❌ 常见问题

### 问题：发送失败，显示 `❌ [发送失败] code: '42501'`

**解决：** RLS 问题

```sql
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
```

### 问题：发送成功但对方收不到

**检查：**
1. Realtime 是否启用？（Dashboard → Replication）
2. 会话 ID 是否相同？（测试模式面板）
3. 控制台是否显示 `SUBSCRIBED`？

### 问题：会话 ID 不同

**原因：** `friendId` 传递错误

**解决：**
- 确保在 Chat 页面点击了正确的好友
- `friendId` 应该是 UUID，不是字符串 'alice', 'bob'

## 🎉 测试成功后

恭喜！聊天功能正常工作了。

下一步可以：
1. 配置正确的 RLS 策略（见 `CHAT-MVP-FIX-GUIDE.md`）
2. 添加消息状态指示器
3. 实现已读功能
4. 优化 UI 动画

---

**有任何问题，查看控制台日志并参考详细文档！** 🚀

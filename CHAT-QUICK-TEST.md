# 聊天功能快速测试指南

## 🎯 目标
测试双人聊天 MVP 功能：发送消息 + 实时接收

## ✅ 前置条件检查

### 1. 数据库表结构检查

在 Supabase SQL Editor 中执行：

```sql
-- 检查 chat_messages 表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;
```

**期望结果：**
```
column_name      | data_type
-----------------+------------------
id               | uuid
conversation_id  | text
sender_id        | uuid
receiver_id      | uuid
text             | text
is_read          | boolean
created_at       | timestamp with time zone
```

**如果字段不匹配：**
1. 执行 `src/database/complete-init.sql` 更新数据库
2. 或者修改代码适配旧表结构（见修复指南）

### 2. 启用 Realtime

在 Supabase Dashboard:
1. 前往 **Database** → **Replication**
2. 找到 `chat_messages` 表
3. 确保右侧的开关是 **绿色/开启** 状态

### 3. 检查 RLS 策略

```sql
-- 查看现有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'chat_messages';
```

**推荐策略：**

```sql
-- 方案 A: 开发测试用（临时关闭 RLS）
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 方案 B: 生产环境用（启用 RLS + 正确策略）
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their messages" ON chat_messages;
CREATE POLICY "Users can view their messages" ON chat_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

## 🧪 测试步骤

### 步骤 1: 准备测试账号

```sql
-- 查看现有测试账号
SELECT id, email, username, display_name 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;
```

复制两个账号的信息，例如：
- **账号 A**: `123@trix.app` (UUID: `xxx-xxx-xxx`)
- **账号 B**: `1234@trix.app` (UUID: `yyy-yyy-yyy`)

### 步骤 2: 确保两个账号已互为好友

```sql
-- 检查好友关系
SELECT 
  f.user_id,
  u1.email as user_email,
  f.friend_id,
  u2.email as friend_email
FROM friends f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
LIMIT 10;
```

**如果不是好友，添加好友关系：**

在应用中：
1. 用账号 A 登录
2. 进入 Chat 页面
3. 点击 "+" 添加好友
4. 输入账号 B 的邮箱或用户名

或使用 SQL：

```sql
-- 假设账号 A 的 UUID 是 'uuid-a', 账号 B 的 UUID 是 'uuid-b'
INSERT INTO friends (user_id, friend_id, name, status) VALUES
  ('uuid-a', 'uuid-b', 'User B', 'online'),
  ('uuid-b', 'uuid-a', 'User A', 'online')
ON CONFLICT (user_id, friend_id) DO NOTHING;
```

### 步骤 3: 双窗口测试

#### 3.1 准备两个浏览器窗口

- **窗口 A**: 正常浏览器窗口，登录账号 A
- **窗口 B**: 隐身模式窗口 (Ctrl+Shift+N)，登录账号 B

#### 3.2 打开开发者工具

在两个窗口中都按 `F12` 打开控制台

#### 3.3 进入聊天页面

两个窗口都：
1. 进入 Chat 页面
2. 点击对方的头像进入聊天详情

#### 3.4 开启测试模式

在聊天详情页面：
1. 点击右上角的 **🧪** 按钮
2. 查看黄色测试面板，确认：
   - ✅ 当前用户 ID
   - ✅ 好友 ID
   - ✅ 会话 ID

**重要：** 确保两个窗口的会话 ID **完全相同**！

### 步骤 4: 测试发送

在**窗口 A**：
1. 输入消息："Hello from A"
2. 点击发送
3. 查看控制台输出

**期望的控制台日志：**

```
🚀 [发送消息] 开始: {userId: "xxx...", friendId: "yyy...", sender: "user"}
📦 [会话ID]: xxx_yyy
📨 [消息数据]: {conversation_id: "xxx_yyy", sender_id: "xxx...", ...}
✅ [发送成功] 消息ID: zzz-zzz-zzz
```

**如果看到错误：**

```
❌ [发送失败] Supabase 错误: ...
```

- 检查错误类型：
  - `42501` 或包含 `policy` → RLS 权限问题
  - `42P01` → 表不存在
  - `42703` → 字段不匹配，需要更新数据库

### 步骤 5: 测试实时接收

在**窗口 B** 的控制台应该看到：

```
📡 [Realtime] 开始订阅: {userId: "yyy...", friendId: "xxx...", ...}
📡 [Realtime] 订阅状态: SUBSCRIBED
✅ [Realtime] 订阅成功
📨 [Realtime] 收到新消息: {id: "zzz...", text: "Hello from A", ...}
✅ [Realtime] 消息来自好友，添加到UI
✅ [Realtime] 添加新消息到列表
```

**UI 应该：**
- ✅ 窗口 A: 消息出现在右侧（蓝色气泡）
- ✅ 窗口 B: 消息出现在左侧（白色气泡）

### 步骤 6: 反向测试

在**窗口 B**：
1. 发送消息："Hello from B"
2. 检查窗口 A 是否实时收到

### 步骤 7: 验证数据库

```sql
-- 查看最新的聊天记录
SELECT 
  id,
  conversation_id,
  sender_id,
  receiver_id,
  text,
  is_read,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 5;
```

**期望结果：**
- ✅ 有两条消息
- ✅ `conversation_id` 相同
- ✅ `sender_id` 和 `receiver_id` 互换
- ✅ `text` 内容正确

## ❌ 常见问题排查

### 问题 1: 消息发送失败

**症状：** 控制台显示 `❌ [发送失败]`

**检查清单：**

1. **检查 Auth 状态**
   ```typescript
   // 在控制台执行
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session?.user?.id);
   ```

2. **检查 RLS 策略**
   ```sql
   -- 临时禁用 RLS 测试
   ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
   ```

3. **检查表结构**
   ```sql
   \d chat_messages;
   ```

### 问题 2: 消息发送成功但收不到实时推送

**症状：** 窗口 A 发送成功，但窗口 B 没反应

**检查清单：**

1. **检查 Realtime 订阅状态**
   ```
   控制台应该显示: 📡 [Realtime] 订阅状态: SUBSCRIBED
   ```

2. **检查 Realtime 是否启用**
   - 前往 Supabase Dashboard → Database → Replication
   - 确保 `chat_messages` 表已启用

3. **检查频道名称冲突**
   ```
   控制台日志中的会话 ID 应该相同
   ```

4. **检查过滤条件**
   ```typescript
   // 控制台应该显示正确的 conversation_id
   filter: `conversation_id=eq.xxx_yyy`
   ```

### 问题 3: 消息重复显示

**症状：** 发送一条消息，UI 显示两次

**原因：** 
- Realtime 订阅没有正确过滤自己的消息
- 检查控制台是否有 `⚠️ [Realtime] 消息来自自己，跳过`

**解决：**
- 代码已修复，确保使用最新版本

### 问题 4: 会话 ID 不匹配

**症状：** 两个窗口的会话 ID 不同

**原因：** 
- `friendId` 传递错误
- 用户 ID 获取错误

**解决：**
1. 开启测试模式，对比两个窗口的 UUID
2. 确保 `friendId` 是对方的 UUID（不是字符串 'alice', 'bob' 等）

### 问题 5: 数据库中没有数据

**症状：** 发送成功，但查询数据库为空

**原因：** RLS 策略阻止了查询

**解决：**
```sql
-- 使用服务角色查询（绕过 RLS）
-- 或者在 SQL Editor 中直接查询
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5;
```

## 📊 测试检查表

完成以下所有项目即为测试通过：

- [ ] 数据库表结构正确（`conversation_id`, `sender_id`, `receiver_id`）
- [ ] Realtime 已启用
- [ ] RLS 策略配置正确（或已禁用用于测试）
- [ ] 两个测试账号已互为好友
- [ ] 窗口 A 发送消息，控制台显示 `✅ [发送成功]`
- [ ] 窗口 B 实时收到消息，控制台显示 `✅ [Realtime] 添加新消息到列表`
- [ ] 窗口 B 的 UI 正确显示消息（左侧白色气泡）
- [ ] 窗口 A 的 UI 正确显示消息（右侧蓝色气泡）
- [ ] 反向发送也成功（B → A）
- [ ] 数据库中有正确的消息记录
- [ ] 会话 ID 在两个窗口中相同
- [ ] 没有消息重复显示

## 🎉 测试成功后的下一步

1. ✅ 添加消息发送状态指示器（发送中、成功、失败）
2. ✅ 实现消息重试机制
3. ✅ 添加网络状态检测
4. ✅ 优化 UI 动画和交互
5. ✅ 实现消息已读状态
6. ✅ 添加打字指示器（typing indicator）
7. ✅ 支持发送图片/文件

## 📞 需要帮助？

如果测试失败，请提供：

1. **浏览器控制台的完整日志**（包括所有 🚀 📦 📨 ✅ ❌ 标记的日志）
2. **Supabase 错误信息**（如果有）
3. **数据库查询结果**
4. **测试模式面板的截图**（显示 UUID 和会话 ID）

将以上信息整理后，可以更快定位问题！

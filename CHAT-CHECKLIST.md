# ✅ 聊天功能修复 - 操作清单

## 📦 已修改的文件

- ✅ `src/services/databaseService.ts` - 改进的发送消息函数（详细日志）
- ✅ `src/screens/ChatDetail.tsx` - 修复 Realtime 订阅 + 测试模式 UI
- ✅ `CHAT-MVP-FIX-GUIDE.md` - 完整修复指南
- ✅ `CHAT-QUICK-TEST.md` - 快速测试指南
- ✅ `CHAT-FIX-SUMMARY.md` - 修复总结
- ✅ `src/database/diagnose-chat.sql` - 数据库诊断脚本

## 🚀 现在就开始测试

### 步骤 1: 检查数据库（5 分钟）

在 Supabase SQL Editor 中执行：

```sql
-- 复制并执行 src/database/diagnose-chat.sql 中的全部内容
```

查看输出结果：

- ✅ 如果显示 "数据库配置正确"，跳到步骤 2
- ❌ 如果显示 "表结构不匹配"，执行 `src/database/complete-init.sql`

### 步骤 2: 启用 Realtime（1 分钟）

1. 打开 Supabase Dashboard
2. 前往 **Database** → **Replication**
3. 找到 `chat_messages` 表
4. 确保右侧开关是**绿色**

### 步骤 3: 配置 RLS（选择一个方案）

**快速测试（推荐）：**

```sql
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
```

**生产环境：**

```sql
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their messages" ON chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

### 步骤 4: 获取测试账号 UUID（2 分钟）

```sql
SELECT id, email, username FROM users LIMIT 5;
```

复制两个账号的完整 UUID：

```
账号 A: 123@trix.app
UUID: ________________________________________

账号 B: 1234@trix.app  
UUID: ________________________________________
```

### 步骤 5: 双窗口测试（5 分钟）

#### 5.1 打开两个窗口

- **窗口 A**: 正常浏览器，登录账号 A
- **窗口 B**: 隐身模式 (Ctrl+Shift+N)，登录账号 B

#### 5.2 两个窗口都：

1. 按 F12 打开控制台
2. 进入 Chat 页面
3. 点击对方的头像进入聊天详情

#### 5.3 开启测试模式

1. 点击右上角的 **🧪** 按钮
2. 查看黄色面板
3. **重要：确认两个窗口的"会话 ID"完全相同！**

#### 5.4 发送测试消息

在窗口 A：

1. 输入："Hello from A"
2. 点击发送
3. 查看控制台，应该看到：

```
🚀 [发送消息] 开始
📦 [会话ID]: xxx_yyy
✅ [发送成功]
```

在窗口 B：

1. 查看控制台，应该看到：

```
📡 [Realtime] 订阅状态: SUBSCRIBED
📨 [Realtime] 收到新消息
✅ [Realtime] 添加新消息到列表
```

2. UI 应该显示消息（左侧白色气泡）

#### 5.5 反向测试

窗口 B 发送 → 窗口 A 应该收到

## ✅ 测试成功标志

- [x] 窗口 A 发送成功（控制台显示 `✅ [发送成功]`）
- [x] 窗口 B 实时收到（控制台显示 `✅ [Realtime] 添加新消息`）
- [x] 窗口 B 的 UI 显示消息（左侧白色）
- [x] 窗口 A 的 UI 显示消息（右侧蓝色）
- [x] 反向发送成功（B → A）
- [x] 数据库中有记录（执行 `SELECT * FROM chat_messages` 可见）

## ❌ 如果测试失败

### 错误 A: 控制台显示 `❌ [发送失败] ... code: '42703'`

**原因：** 字段不匹配

**解决：** 执行 `src/database/complete-init.sql`

### 错误 B: 控制台显示 `❌ [发送失败] ... code: '42501'`

**原因：** RLS 权限拒绝

**解决：**

```sql
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
```

### 错误 C: 消息发送成功但收不到

**原因：** Realtime 未启用或过滤错误

**检查：**

1. Supabase Dashboard → Replication → `chat_messages` 已启用？
2. 两个窗口的"会话 ID"是否相同？
3. 控制台是否显示 `📡 [Realtime] 订阅状态: SUBSCRIBED`？

### 错误 D: 会话 ID 不匹配

**症状：** 测试模式面板中，两个窗口的会话 ID 不同

**检查：**

1. `friendId` 是否是对方的完整 UUID？
2. 不应该是字符串 'alice', 'bob' 等
3. 在 Chat 页面，确保点击了正确的好友

## 📋 完整检查表（测试前）

- [ ] 数据库表有 `conversation_id`, `sender_id`, `receiver_id` 字段
- [ ] Realtime 在 Dashboard 中已启用
- [ ] RLS 已配置或已禁用
- [ ] 有两个测试账号且互为好友
- [ ] 代码已更新（已修改的文件）

## 📋 完整检查表（测试后）

- [ ] 发送成功（控制台 `✅ [发送成功]`）
- [ ] 接收成功（控制台 `✅ [Realtime] 添加新消息`）
- [ ] UI 正确（左白右蓝）
- [ ] 数据库有记录
- [ ] 没有重复消息
- [ ] 双向通信正常

## 📚 相关文档

- **完整修复指南**: `CHAT-MVP-FIX-GUIDE.md`
- **快速测试指南**: `CHAT-QUICK-TEST.md`
- **修复总结**: `CHAT-FIX-SUMMARY.md`
- **数据库诊断**: `src/database/diagnose-chat.sql`

## 🎯 下一步（测试成功后）

1. [ ] 添加消息发送状态指示器
2. [ ] 实现消息重试机制
3. [ ] 添加已读状态
4. [ ] 实现打字指示器
5. [ ] 支持图片/文件发送
6. [ ] 优化 UI 动画

---

**祝测试顺利！🚀**

如有问题，请查看控制台日志并参考修复指南。

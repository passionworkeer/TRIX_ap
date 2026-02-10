# 代码更新说明 - 动态用户ID

## ✅ 已完成的更新

### 1. 删除固定用户ID
- ❌ 删除了 `supabase.ts` 中的固定 `CURRENT_USER_ID`
- ✅ 添加了 `getCurrentUserId()` 辅助函数

### 2. 更新 databaseService.ts
所有数据库操作函数现在都会**自动获取当前登录用户的ID**：

#### 已更新的函数：
- ✅ `getFriends()` - 只获取当前用户的好友
- ✅ `updateFriendStatus()` - 更新当前用户视角的好友状态
- ✅ `updateFriendStudyStatus()` - 更新好友学习状态
- ✅ `getChatHistory()` - 适配新的数据库结构（使用 conversation_id）
- ✅ `sendMessage()` - 发送消息并更新未读计数
- ✅ `markMessagesAsRead()` - 标记已读
- ✅ `clearChatHistory()` - 清空聊天记录
- ✅ `getUnreadCounts()` - 获取未读计数
- ✅ `getTotalUnreadCount()` - 获取总未读数
- ✅ `getNotifications()` - 获取通知
- ✅ `getUnreadNotificationCount()` - 未读通知数
- ✅ `getMails()` - 获取邮件
- ✅ `getUnreadMailCount()` - 未读邮件数
- ✅ `getStudySessions()` - 获取学习记录
- ✅ `createStudySession()` - 创建学习记录
- ✅ `getTodayStudyTime()` - 今日学习时长
- ✅ `subscribeToChatMessages()` - 实时订阅消息
- ✅ `subscribeToUnreadCounts()` - 订阅未读计数
- ✅ `subscribeToNotifications()` - 订阅通知

### 3. 数据库结构适配

#### 聊天消息表变化：
**旧结构**:
```typescript
{
  friend_id: string,  // 字符串ID
  sender: 'user' | 'friend' | 'bot'
}
```

**新结构**:
```typescript
{
  conversation_id: string,  // 会话ID (user_uuid_friend_uuid)
  sender_id: UUID,          // 发送者UUID
  receiver_id: UUID         // 接收者UUID
}
```

#### 好友表变化：
- `friend_id` 现在是 UUID 外键（指向 users 表）
- 好友关系采用双向存储

### 4. 新增类型定义
- ✅ `ChatMessageDB` - 数据库实际存储的消息格式
- ✅ 更新 `FriendLatestMessage` 添加 `user_id` 字段

---

## 🎯 使用方式

### 用户登录后自动获取数据

现在所有函数都会自动使用当前登录用户的ID，无需手动传递：

```typescript
// ❌ 旧方式 - 需要固定用户ID
const friends = await getFriends(); // 获取所有用户的好友 (错误!)

// ✅ 新方式 - 自动获取当前用户的好友
const friends = await getFriends(); // 只获取当前登录用户的好友
```

### 登录流程

1. 用户登录: `signIn('xiaoming@trix.app', 'trix2026')`
2. Supabase Auth 创建 session，包含 `user.id`
3. 所有数据库操作自动使用 `session.user.id`
4. 切换账号时，自动切换到新用户的数据

---

## 🔧 测试步骤

### 1. 使用不同账号登录测试

```typescript
// 登录小明
await signIn('xiaoming@trix.app', 'trix2026');
const friendsXiaoming = await getFriends(); // 获取小明的好友列表

// 登出
await signOut();

// 登录Alice
await signIn('alice@trix.app', 'trix2026');
const friendsAlice = await getFriends(); // 获取Alice的好友列表
```

### 2. 验证数据隔离

每个用户应该只能看到自己的：
- ✅ 好友列表
- ✅ 聊天记录
- ✅ 未读消息
- ✅ 通知
- ✅ 邮件
- ✅ 学习记录

---

## ⚠️ 注意事项

### 1. 必须先登录
所有数据库操作都需要用户先登录，否则会抛出错误：
```
Error: 用户未登录，请先登录
```

### 2. 会话保持
Supabase 已配置自动保持会话：
```typescript
auth: {
  persistSession: true,
  autoRefreshToken: true,
}
```

### 3. 错误处理
所有函数都包含 try-catch，即使获取用户ID失败也不会崩溃：
```typescript
try {
  const userId = await getCurrentUserId();
  // ... 数据库操作
} catch (error) {
  console.error('操作失败:', error);
  return []; // 返回空数据
}
```

---

## 📊 数据库视图更新

确保你的数据库有正确的视图定义：

```sql
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT 
  f.user_id,          -- 添加此字段
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) AS unread_count,
  uc.last_message,
  uc.last_message_time,
  COALESCE(uc.last_message_time, f.created_at) AS sort_time
FROM friends f
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id
ORDER BY sort_time DESC;
```

这个视图已经包含在 `complete-init.sql` 中了。

---

## ✅ 迁移检查清单

- [x] 删除固定 `CURRENT_USER_ID`
- [x] 添加 `getCurrentUserId()` 函数
- [x] 更新所有数据库查询使用动态用户ID
- [x] 适配新的聊天消息表结构
- [x] 更新 TypeScript 类型定义
- [x] 添加错误处理
- [x] 测试多用户登录

---

## 🎉 完成！

现在你的应用已经支持真正的多用户系统了！

每个用户登录后：
- ✅ 只能看到自己的好友
- ✅ 只能看到自己的聊天记录
- ✅ 只能看到自己的通知和邮件
- ✅ 数据完全隔离，安全可靠

试试用不同的测试账号登录，体验多用户功能吧！

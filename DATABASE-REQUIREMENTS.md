# 前端数据需求清单

## 📊 完整数据库访问清单

### 1. **profiles** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` (所有字段) | `id = userId` | 获取用户详细信息 | `AuthContext.tsx:29` |
| SELECT | `id` | `email.eq.${account}` OR `username.eq.${account}` | 添加好友时查找用户 | `databaseService.ts:15` |
| SELECT | `id` | `email.eq.${account}` OR `username.eq.${account}` | 发送好友请求时查找用户 | `databaseService.ts:84` |
| UPDATE | 任意字段 (动态) | `id = userId` | 更新用户资料 | `AuthContext.tsx:110` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `username` (text, UNIQUE)
- `email` (text, UNIQUE)
- `full_name` (text, nullable)
- `avatar_url` (text, nullable)
- `bio` (text, nullable)
- `points` (integer, nullable)
- `avatar_config` (jsonb, nullable)
- `website` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

### 2. **friends** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `id` | `user_id = currentUserId` AND `friend_id = targetUserId` | 检查是否已是好友 | `databaseService.ts:33` |
| SELECT | `friend_id` | `user_id = currentUserId` | 获取已添加的好友ID列表（推荐用户功能） | `Chat.tsx:98` |
| INSERT | `user_id`, `friend_id`, `status` | - | 添加双向好友关系 | `databaseService.ts:44` |
| UPDATE | `status`, `updated_at` | `user_id = userId` AND `friend_id = friendId` | 更新好友在线状态 | `databaseService.ts:205` |
| UPDATE | `is_studying`, `study_time`, `updated_at` | `user_id = userId` AND `friend_id = friendId` | 更新好友学习状态 | `databaseService.ts:237` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid, REFERENCES profiles(id))
- `friend_id` (uuid, REFERENCES profiles(id))
- `status` (text) - 值: 'accepted', 'pending', 'blocked'
- `is_studying` (boolean, DEFAULT false)
- `study_time` (integer, DEFAULT 0)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**约束：**
- UNIQUE(user_id, friend_id)
- CHECK(user_id != friend_id)

---

### 3. **friend_latest_messages** 视图

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` (所有字段) | `user_id = userId` | 获取好友列表（含最新消息） | `databaseService.ts:179` |
| ORDER BY | - | `last_message_time DESC NULLS LAST` | 按最后消息时间排序 | `databaseService.ts:181` |

**必需字段（视图返回）：**
- `user_id` (uuid)
- `friend_id` (uuid)
- `name` (text) - 好友显示名称
- `avatar_url` (text, nullable)
- `status` (text) - 'online', 'offline', 'busy', 'away'
- `bio` (text, nullable)
- `study_time` (integer)
- `is_studying` (boolean)
- `unread_count` (integer)
- `last_message` (text, nullable)
- `last_message_time` (timestamp, nullable)

**视图定义建议：**
```sql
CREATE VIEW friend_latest_messages AS
SELECT 
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  p.bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id;
```

---

### 4. **chat_messages** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` | `conversation_id = convId` | 获取聊天历史 | `databaseService.ts:263` |
| ORDER BY | - | `created_at ASC` | 按时间升序排列 | `databaseService.ts:266` |
| INSERT | `conversation_id`, `sender_id`, `receiver_id`, `text`, `is_read` | - | 发送消息 | `databaseService.ts:330` |
| DELETE | - | `conversation_id = convId` | 清空聊天记录 | `databaseService.ts:428` |
| **Realtime** | - | `conversation_id = convId` | 实时接收新消息 | `ChatDetail.tsx:135` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `conversation_id` (text, NOT NULL) - 格式: `${小UUID}_${大UUID}`
- `sender_id` (uuid, REFERENCES profiles(id))
- `receiver_id` (uuid, REFERENCES profiles(id))
- `text` (text, NOT NULL)
- `is_read` (boolean, DEFAULT false)
- `created_at` (timestamp, DEFAULT NOW())

**索引建议：**
```sql
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

**Realtime 配置：**
- ✅ 必须在 Supabase Dashboard 启用 Replication
- ✅ 监听 INSERT 事件

---

### 5. **unread_counts** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` | `user_id = userId` | 获取所有未读计数 | `databaseService.ts:450` |
| SELECT | `unread_count` | `user_id = userId` | 获取总未读数 | `databaseService.ts:472` |
| UPSERT | `user_id`, `friend_id`, `unread_count`, `last_message`, `last_message_time` | `user_id, friend_id` (ON CONFLICT) | 更新未读计数 | `databaseService.ts:381` |
| **Realtime** | - | `user_id = userId` | 实时更新未读计数 | `databaseService.ts:830` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid, REFERENCES profiles(id))
- `friend_id` (uuid, REFERENCES profiles(id))
- `unread_count` (integer, DEFAULT 0)
- `last_message` (text, nullable)
- `last_message_time` (timestamp, nullable)
- `updated_at` (timestamp, DEFAULT NOW())

**约束：**
- UNIQUE(user_id, friend_id)

---

### 6. **notifications** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` | `user_id = userId` | 获取所有通知 | `databaseService.ts:498` |
| ORDER BY | - | `created_at DESC` | 按时间倒序 | `databaseService.ts:501` |
| SELECT | `*` (count only) | `user_id = userId` AND `is_read = false` | 获取未读通知数 | `databaseService.ts:545` |
| INSERT | `user_id`, `type`, `title`, `content`, `avatar_url`, `is_read`, `created_at` | - | 发送好友请求通知 | `databaseService.ts:120` |
| UPDATE | `is_read` | `id = notificationId` | 标记通知已读 | `databaseService.ts:518` |
| DELETE | - | `id = notificationId` | 删除通知 | `databaseService.ts:530` |
| **Realtime** | - | `user_id = userId` | 实时接收新通知 | `databaseService.ts:851` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid, REFERENCES profiles(id))
- `type` (text) - 值: 'message', 'system', 'friend_request', 'study', 'achievement'
- `title` (text, NOT NULL)
- `content` (text, NOT NULL)
- `avatar_url` (text, nullable)
- `is_read` (boolean, DEFAULT false)
- `created_at` (timestamp, DEFAULT NOW())

---

### 7. **mails** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` | `user_id = userId` | 获取所有邮件 | `databaseService.ts:572` |
| ORDER BY | - | `created_at DESC` | 按时间倒序 | `databaseService.ts:575` |
| SELECT | `*` (count only) | `user_id = userId` AND `is_read = false` | 获取未读邮件数 | `databaseService.ts:617` |
| UPDATE | `is_read` | `id = mailId` | 标记邮件已读 | `databaseService.ts:592` |
| DELETE | - | `id = mailId` | 删除邮件 | `databaseService.ts:604` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid, REFERENCES profiles(id))
- `from_name` (text, NOT NULL)
- `from_avatar` (text, nullable)
- `subject` (text, NOT NULL)
- `preview` (text, NOT NULL)
- `content` (text, nullable)
- `is_read` (boolean, DEFAULT false)
- `created_at` (timestamp, DEFAULT NOW())

---

### 8. **study_sessions** 表

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `*` | `user_id = userId` | 获取学习记录 | `databaseService.ts:650` |
| ORDER BY | - | `started_at DESC` | 按开始时间倒序 | `databaseService.ts:654` |
| SELECT | `duration` | `user_id = userId` AND `started_at >= today` | 获取今日学习时长 | `databaseService.ts:709` |
| INSERT | `user_id`, `subject`, `duration`, `started_at`, `ended_at`, `notes` | - | 创建学习记录 | `databaseService.ts:685` |

**必需字段：**
- `id` (uuid, PRIMARY KEY)
- `user_id` (uuid, REFERENCES profiles(id))
- `subject` (text, nullable)
- `duration` (integer, NOT NULL) - 单位：分钟
- `started_at` (timestamp, NOT NULL)
- `ended_at` (timestamp, nullable)
- `notes` (text, nullable)
- `created_at` (timestamp, DEFAULT NOW())

---

### 9. **users** 表 (⚠️ 仅用于推荐用户)

| 操作类型 | 字段需求 | 过滤条件 | 使用场景 | 文件位置 |
|---------|---------|---------|---------|---------|
| SELECT | `id`, `username`, `display_name`, `email`, `bio` | `id != currentUserId` | 获取推荐用户 | `Chat.tsx:84` |

**⚠️ 注意：** 
- 这个表可能是自定义的用户表，不是 `auth.users`
- 如果 `users` 表不可访问（406错误），应该改为使用 `profiles` 表
- **建议统一使用 `profiles` 表**

---

## 🔧 存储过程 (RPC)

### **mark_messages_as_read**

| 参数 | 类型 | 说明 |
|------|------|------|
| `p_user_id` | uuid | 当前用户ID |
| `p_friend_id` | uuid | 好友ID |

**功能：** 标记与某个好友的所有消息为已读

**调用位置：** `databaseService.ts:409`

**建议实现：**
```sql
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id uuid,
  p_friend_id uuid
)
RETURNS void AS $$
DECLARE
  v_conversation_id text;
BEGIN
  -- 构建会话ID
  v_conversation_id := CASE 
    WHEN p_user_id < p_friend_id THEN p_user_id || '_' || p_friend_id
    ELSE p_friend_id || '_' || p_user_id
  END;
  
  -- 标记消息为已读
  UPDATE chat_messages
  SET is_read = true
  WHERE conversation_id = v_conversation_id
    AND receiver_id = p_user_id
    AND is_read = false;
    
  -- 重置未读计数
  UPDATE unread_counts
  SET unread_count = 0
  WHERE user_id = p_user_id 
    AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 📡 Realtime 订阅需求

### 1. chat_messages 表
- **事件：** INSERT
- **过滤：** `conversation_id = ${conversationId}`
- **用途：** 实时接收新消息
- **位置：** `ChatDetail.tsx:135`, `databaseService.ts:792`

### 2. unread_counts 表
- **事件：** * (所有)
- **过滤：** `user_id = ${userId}`
- **用途：** 实时更新未读计数
- **位置：** `databaseService.ts:830`

### 3. notifications 表
- **事件：** * (所有)
- **过滤：** `user_id = ${userId}`
- **用途：** 实时接收新通知
- **位置：** `databaseService.ts:851`

---

## 🔐 RLS 策略建议

### profiles 表
```sql
-- 所有人可以查看所有 profiles（用于查找用户）
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- 只能更新自己的 profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### friends 表
```sql
-- 用户只能查看自己的好友关系
CREATE POLICY "Users can view own friends" ON friends
  FOR SELECT USING (auth.uid() = user_id);

-- 用户可以添加好友
CREATE POLICY "Users can add friends" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的好友状态
CREATE POLICY "Users can update own friends" ON friends
  FOR UPDATE USING (auth.uid() = user_id);
```

### chat_messages 表
```sql
-- 用户可以查看自己参与的对话
CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 用户可以发送消息
CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 用户可以删除自己参与的对话
CREATE POLICY "Users can delete own conversations" ON chat_messages
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

### 其他表 (notifications, mails, study_sessions, unread_counts)
```sql
-- 通用模式：只能访问自己的数据
CREATE POLICY "Users can view own data" ON {table_name}
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON {table_name}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON {table_name}
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON {table_name}
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 📝 总结统计

| 表/视图 | SELECT | INSERT | UPDATE | DELETE | Realtime | RPC |
|---------|--------|--------|--------|--------|----------|-----|
| profiles | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| friends | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| friend_latest_messages | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| chat_messages | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| unread_counts | ✅ | ❌ | ✅ (UPSERT) | ❌ | ✅ | ✅ |
| notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| mails | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| study_sessions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| users (推荐改为 profiles) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**总计：**
- 9 个表/视图
- 1 个存储过程 (mark_messages_as_read)
- 3 个 Realtime 订阅

---

## 🚨 待修复问题

1. **Chat.tsx:84** - 将 `users` 表改为 `profiles` 表
2. **确保所有 Realtime 表已在 Supabase Dashboard 启用 Replication**
3. **创建 `friend_latest_messages` 视图**
4. **实现 `mark_messages_as_read` 存储过程**
5. **配置所有表的 RLS 策略**

---

**文档生成时间：** 2026年2月11日  
**版本：** v1.0

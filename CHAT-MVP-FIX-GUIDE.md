# 聊天功能 MVP 诊断和修复指南

## 🔍 问题诊断

### 已发现的核心问题

**数据库表结构不匹配！**

您的代码期望的表结构（新版本）：
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

但可能实际使用的表结构（旧版本）：
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  friend_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'friend', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🛠️ 修复方案

### 方案 A：更新数据库到新版本（推荐）

**步骤 1：备份现有数据**
```sql
-- 在 Supabase SQL Editor 中执行
SELECT * FROM chat_messages;
-- 复制结果保存到本地
```

**步骤 2：执行完整初始化脚本**
```sql
-- 在 Supabase SQL Editor 中执行
-- 文件: src/database/complete-init.sql
-- 这会删除旧表并创建新表
```

**步骤 3：启用 Realtime**
在 Supabase Dashboard:
1. 前往 Database → Replication
2. 找到 `chat_messages` 表
3. 点击右侧开关启用 Realtime

**步骤 4：检查 RLS 策略**
```sql
-- 查看现有策略
SELECT * FROM pg_policies WHERE tablename = 'chat_messages';

-- 如果没有策略，添加以下策略：
-- 允许用户查看自己参与的对话
CREATE POLICY "Users can view their own messages" ON chat_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 允许用户发送消息
CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 启用 RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
```

### 方案 B：修改代码适配旧版本（临时方案）

如果暂时不想更新数据库，可以修改代码以适配旧表结构。

查看下面的代码修复部分。

## 📝 代码诊断清单

### ✅ 1. 检查 Auth（已通过）

在 `databaseService.ts` 中的 `getCurrentUserId()` 函数已正确实现：
```typescript
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }
  return session.user.id;
}
```

### ⚠️ 2. 检查发送逻辑（需要优化）

当前的 `sendMessage` 函数：
```typescript
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    
    // 构建会话ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    // 确定发送者和接收者
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
        text: text,
        is_read: false
      })
      .select('id')
      .single();

    if (error) {
      console.error('发送消息失败:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('发送消息失败:', error);
    return null;
  }
}
```

**问题：** 错误处理不够详细，用户看不到具体错误原因。

### ⚠️ 3. 检查 Realtime 订阅（需要修复）

在 `ChatDetail.tsx` 中的订阅代码：
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`chat:${friendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `friend_id=eq.${friendId}`  // ⚠️ 问题：新版表没有 friend_id 字段！
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage;
        if (newMessage.sender !== 'user') {
          const uiMessage = convertDbMessageToUI(newMessage);
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === uiMessage.id);
            if (exists) return prev;
            return [...prev, uiMessage];
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [friendId]);
```

**问题：**
1. 过滤条件使用了不存在的 `friend_id` 字段
2. 应该改为过滤 `conversation_id`

### ❌ 4. RLS 权限检查（缺失）

当前代码没有打印 RLS 错误，需要添加详细的错误日志。

## 🔧 代码修复

### 修复 1：改进 sendMessage 错误处理

```typescript
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    
    console.log('🚀 发送消息:', {
      userId,
      friendId,
      sender,
      text: text.substring(0, 20) + '...'
    });
    
    // 构建会话ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    console.log('📦 会话ID:', conversationId);
    
    // 确定发送者和接收者
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;
    
    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text,
      is_read: false
    };
    
    console.log('📨 消息数据:', messageData);
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ 发送消息失败 - Supabase 错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // 检查是否是 RLS 权限问题
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('🔒 RLS 策略拒绝访问！请检查数据库权限设置。');
      }
      
      return null;
    }

    console.log('✅ 消息发送成功:', data?.id);
    
    // 更新未读计数
    await updateUnreadCount(receiverId, senderId, text);

    return data?.id || null;
  } catch (error: any) {
    console.error('❌ 发送消息失败 - 捕获异常:', {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}
```

### 修复 2：更新 Realtime 订阅

```typescript
useEffect(() => {
  const userId = await getCurrentUserId(); // 需要获取当前用户ID
  
  // 构建会话ID
  const conversationId = userId < friendId 
    ? `${userId}_${friendId}` 
    : `${friendId}_${userId}`;
  
  console.log('📡 订阅 Realtime:', {
    userId,
    friendId,
    conversationId
  });
  
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}` // ✅ 修复：使用 conversation_id
      },
      (payload) => {
        console.log('📨 收到新消息:', payload.new);
        
        const newMessage = payload.new as any;
        
        // 只有当消息不是当前用户发送的,才添加到消息列表
        if (newMessage.sender_id !== userId) {
          const uiMessage: UIMessage = {
            id: newMessage.id,
            sender: 'friend',
            text: newMessage.text,
            timestamp: formatTimestamp(newMessage.created_at)
          };
          
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === uiMessage.id);
            if (exists) {
              console.log('⚠️ 消息已存在，跳过');
              return prev;
            }
            console.log('✅ 添加新消息到UI');
            return [...prev, uiMessage];
          });
        } else {
          console.log('⚠️ 是自己的消息，跳过');
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 订阅状态:', status);
    });

  return () => {
    console.log('🔌 取消订阅');
    supabase.removeChannel(channel);
  };
}, [friendId]);
```

### 修复 3：添加手动输入对方 ID 的测试界面

在 `ChatDetail.tsx` 中添加测试功能：

```typescript
// 在组件中添加状态
const [testMode, setTestMode] = useState(false);
const [testReceiverId, setTestReceiverId] = useState(friendId);

// 在返回的 JSX 中添加测试面板（仅开发环境）
{process.env.NODE_ENV === 'development' && testMode && (
  <div className="fixed top-0 left-0 right-0 bg-yellow-100 p-2 z-50 border-b-2 border-yellow-400">
    <div className="text-xs font-mono">
      <div>测试模式 - 接收者ID:</div>
      <input
        type="text"
        value={testReceiverId}
        onChange={(e) => setTestReceiverId(e.target.value)}
        className="w-full mt-1 px-2 py-1 border rounded"
        placeholder="输入对方的 UUID"
      />
      <button
        onClick={() => {
          // 使用测试ID发送消息
          console.log('使用测试ID:', testReceiverId);
        }}
        className="mt-1 px-3 py-1 bg-blue-500 text-white rounded text-xs"
      >
        应用测试ID
      </button>
    </div>
  </div>
)}

// 添加切换测试模式的按钮（在header中）
<button
  onClick={() => setTestMode(!testMode)}
  className="text-xs text-gray-500 hover:text-gray-700"
>
  {testMode ? '关闭测试' : '测试模式'}
</button>
```

## 🧪 测试步骤

### 1. 获取测试账号的 UUID

```sql
-- 在 Supabase SQL Editor 中执行
SELECT id, email, username FROM users;
```

复制两个测试账号的 UUID。

### 2. 测试发送消息

1. 用账号 A 登录
2. 打开浏览器控制台 (F12)
3. 进入聊天页面
4. 发送一条消息
5. 查看控制台输出，检查：
   - ✅ `getCurrentUserId()` 是否返回正确的 UUID
   - ✅ `conversation_id` 是否正确构建
   - ✅ `sender_id` 和 `receiver_id` 是否正确
   - ❌ 是否有 RLS 错误（42501）
   - ❌ 是否有其他 Supabase 错误

### 3. 测试接收消息

1. 打开两个浏览器窗口（或一个正常窗口+一个隐身窗口）
2. 窗口 A：用账号 A 登录
3. 窗口 B：用账号 B 登录
4. 窗口 A：发送消息给 B
5. 窗口 B：检查是否实时收到消息
6. 查看两个窗口的控制台输出

### 4. 检查数据库

```sql
-- 查看所有消息
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
LIMIT 10;

-- 检查 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'chat_messages';
```

## 📋 常见问题排查

### 问题 1：消息发送失败，控制台显示 "policy" 错误

**原因：** RLS 策略配置不正确

**解决：**
```sql
-- 临时禁用 RLS（仅用于测试！）
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 或者添加正确的策略
DROP POLICY IF EXISTS "Chat messages can be created by anyone" ON chat_messages;
CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
  
DROP POLICY IF EXISTS "Chat messages are viewable by everyone" ON chat_messages;
CREATE POLICY "Users can view their messages" ON chat_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

### 问题 2：消息发送成功但收不到实时推送

**原因：**
1. Realtime 未启用
2. 订阅过滤条件错误
3. 频道名称重复导致冲突

**解决：**
1. 检查 Supabase Dashboard → Database → Replication
2. 确保 `chat_messages` 表的 Realtime 开关已打开
3. 检查控制台中的订阅状态日志

### 问题 3：数据库中没有数据

**原因：** 表结构不匹配导致插入失败

**解决：**
```sql
-- 检查表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages';

-- 如果字段不匹配，执行完整初始化脚本
-- src/database/complete-init.sql
```

### 问题 4：无法获取当前用户 ID

**原因：** Auth session 未正确建立

**解决：**
```typescript
// 在 ChatDetail.tsx 中添加调试
useEffect(() => {
  const checkAuth = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔐 Auth 状态:', {
      session: session,
      user: session?.user,
      error: error
    });
  };
  checkAuth();
}, []);
```

## 🎯 下一步

完成修复后，建议：

1. ✅ 创建一个简单的测试页面，显示当前用户 ID 和好友 ID
2. ✅ 添加消息发送状态指示器（发送中、成功、失败）
3. ✅ 实现消息重试机制
4. ✅ 添加网络状态检测
5. ✅ 实现消息本地缓存（离线支持）

## 📞 需要帮助？

如果按照以上步骤仍然无法解决，请提供：
1. 浏览器控制台的完整错误日志
2. Supabase SQL Editor 中执行的查询结果
3. 当前使用的数据库脚本版本（init.sql 或 complete-init.sql）

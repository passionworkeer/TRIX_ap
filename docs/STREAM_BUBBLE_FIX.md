# 流式回复重复气泡 Bug 修复

## 🐛 问题描述

**现象:** AI 的流式回复在前端显示时出现了**重复气泡**（Duplicated Bubbles）。AI 每输出几个字，界面上就会新增一个聊天气泡，而不是在同一个气泡里打字。

**根本原因:** 
- 原逻辑依赖 `messages[length-1]` 来判断是否更新最后一条消息
- React 快速流式更新时产生 **Race Condition**
- 代码误判"上一条不是 Assistant 消息"，导致不断创建新气泡

## ✅ 修复方案

使用 **ID 绑定机制** 替代索引判断：

### 1. WebSocketContext 改动

**新增状态:**
```typescript
const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
```

**发送消息时预生成 streamId:**
```typescript
const sendMessage = useCallback((text: string) => {
  // 生成新的 streamId
  const newStreamId = `stream-${Date.now()}-${generateId()}`;
  setCurrentStreamId(newStreamId);
  
  // 清空之前的回复
  responseBufferRef.current = '';
  setFullResponse('');
  
  // 发送消息...
}, []);
```

**接收消息时关联 streamId:**
```typescript
// 如果收到 assistant 流式增量，且还没有 streamId，则生成
if (payload.stream === 'assistant' && payload.data?.delta) {
  if (!currentStreamId) {
    const newStreamId = backendRunId || `stream-${Date.now()}-${generateId()}`;
    setCurrentStreamId(newStreamId);
  }
}
```

**导出 streamId:**
```typescript
const value: WebSocketContextValue = {
  status,
  fullResponse,
  currentStreamId, // ✅ 新增导出
  sendMessage,
  isConnected,
  connect,
  disconnect
};
```

### 2. ChatDetail 改动

**修改 Message 接口:**
```typescript
interface Message {
  id: number | string; // 支持 string (用于 streamId)
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}
```

**使用 ID 绑定更新逻辑:**
```typescript
useEffect(() => {
  if (!fullResponse || !isBot || !currentStreamId) return;

  setMessages(prev => {
    // 🔥 使用 findIndex 查找该 streamId 的消息
    const existingIndex = prev.findIndex(msg => msg.id === currentStreamId);
    
    if (existingIndex !== -1) {
      // ✅ 找到了 → 更新该消息
      const updated = [...prev];
      updated[existingIndex] = {
        ...updated[existingIndex],
        text: fullResponse, // 更新文本
      };
      return updated;
    } else {
      // ✅ 没找到 → 创建新消息
      return [
        ...prev,
        {
          id: currentStreamId, // 使用 streamId 作为 id
          sender: 'bot',
          text: fullResponse,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        }
      ];
    }
  });
}, [fullResponse, currentStreamId, isBot]);
```

## 🎯 工作原理

### 发送消息流程
1. 用户点击发送
2. `sendMessage()` 被调用
3. **立即生成新的 `streamId`** (例如: `stream-1738646400000-abc123`)
4. 清空 `fullResponse` 和 `responseBufferRef`
5. 发送 WebSocket 消息

### 接收回复流程
1. Gateway 开始返回流式数据 (delta)
2. 第一条增量到达时：
   - 检测到 `currentStreamId` 已存在（由 sendMessage 预生成）
   - 累积文本到 `fullResponse`
   - 触发 ChatDetail 的 `useEffect`
3. ChatDetail 处理：
   - 使用 `currentStreamId` 在 `messages` 数组中查找
   - **第一次**: 找不到 → 创建新气泡，id = `currentStreamId`
   - **第二次及以后**: 找到了 → **更新同一个气泡**的文本
4. 打字机效果：**单个气泡**内文本逐渐增长 ✅

### 防止重复的关键
- ✅ **唯一 ID**: 每次回复都有唯一的 `streamId`
- ✅ **精确匹配**: 使用 `findIndex(msg => msg.id === currentStreamId)` 精确查找
- ✅ **稳定性**: 不依赖数组索引或消息内容判断
- ✅ **无 Race Condition**: ID 在发送时就已确定

## 📊 修复前后对比

### 修复前 ❌
```
用户: 你好
Bot: 你                    <- 气泡 1
Bot: 你好                  <- 气泡 2 (重复!)
Bot: 你好，                <- 气泡 3 (重复!)
Bot: 你好，我              <- 气泡 4 (重复!)
Bot: 你好，我是 AI        <- 气泡 5 (重复!)
```

### 修复后 ✅
```
用户: 你好
Bot: 你好，我是 AI         <- 单个气泡，内容逐渐增长
```

## 🔍 测试方法

1. 启动 Clawdbot Gateway:
   ```bash
   openclaw-cn gateway
   ```

2. 启动前端:
   ```bash
   npm run dev
   ```

3. 打开浏览器控制台，查看日志:
   ```
   🆕 发送消息，预生成流 ID: stream-1738646400000-abc123
   📤 发送消息: 你好
   📝 收到增量: 你
   📝 收到增量: 好
   📝 收到增量: ，
   📝 收到增量: 我
   📝 收到增量: 是
   📝 收到增量: AI
   ✅ 回复完成，总长度: 11
   ```

4. 检查聊天界面:
   - ✅ 只有**一个** bot 气泡
   - ✅ 文本逐字显现（打字机效果）
   - ✅ 没有重复气泡

## 🔧 文件变更

### 修改文件:
- `src/contexts/WebSocketContext.tsx`
  - 新增 `currentStreamId` 状态
  - `sendMessage()` 预生成 streamId
  - 接收消息时关联 streamId
  - 导出 `currentStreamId`

- `screens/ChatDetail.tsx`
  - `Message.id` 改为 `number | string`
  - 使用 `currentStreamId` 作为消息 ID
  - 用 `findIndex` 精确查找并更新消息

## ✅ 验证清单

- [x] 流式回复只显示一个气泡
- [x] 文本逐字增长（打字机效果）
- [x] 没有重复气泡
- [x] 多轮对话正常
- [x] 切换页面后连接保持
- [x] Console 日志正常

## 🎉 修复完成

现在流式回复会正确显示为**单个气泡**，文本逐渐增长，完美的打字机效果！✨

# 消息确认链路问题

## 问题
发送消息时错误回滚路径失效，出现"卡发送中/状态不一致"

## 根因
Context 的 `sendMessage` API 契约不一致，返回 `void` 但调用方用 `await` 语义期望可捕获失败

## 标准解决方案

```typescript
// ❌ 错误的返回类型
sendMessage: (message: string) => void

// ✅ 正确的返回类型
sendMessage: (message: string) => Promise<void>
```

## 完整修复

```typescript
// src/contexts/ClawbotChannelContext.tsx
const sendMessage = useCallback(async (content: string) => {
  try {
    // 1. 设置发送中状态
    setSending(true)

    // 2. 发送消息
    await socket.emitWithAck('message', { content })

    // 3. 添加到消息列表
    setMessages(prev => [...prev, {
      id: generateId(),
      content,
      sender: 'user',
      timestamp: new Date()
    }])

    return { success: true }
  } catch (error) {
    // 4. 错误处理
    console.error('Send message failed:', error)
    return { success: false, error }
  } finally {
    // 5. 清理状态
    setSending(false)
  }
}, [socket])
```

## 验证步骤

1. 发送消息成功 → 状态正常
2. 发送消息失败 → 显示错误，状态重置
3. 网络中断 → 重连后可重新发送

## 相关文件
- `src/contexts/ClawbotChannelContext.tsx`
- `src/screens/ChatDetail.tsx`

## Commit 示例
```
fix(messaging): return Promise from sendMessage for error handling

Problem: Errors in sendMessage not catchable by caller
Solution: Change return type from void to Promise<void>

Fixes: #124
```

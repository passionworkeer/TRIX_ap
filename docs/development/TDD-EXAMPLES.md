# TDD 开发示例

本文档展示如何在 TRIX 项目中遵循 TDD（测试驱动开发）流程。

## 标准流程

### 1. 红：先写失败的测试

```typescript
// src/services/__tests__/chatService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendMessage } from '../chatService'

describe('sendMessage', () => {
  it('should not send message if user is not authenticated', async () => {
    // Arrange
    const mockGetSession = vi.fn().mockResolvedValue(null)

    // Act
    const result = await sendMessage('friend-id', 'Hello', mockGetSession)

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authenticated')
  })
})
```

### 2. 绿：实现功能让测试通过

```typescript
// src/services/chatService.ts
export const sendMessage = async (friendId: string, text: string, getSession: () => Promise<Session | null>) => {
  // 1. 先检查认证状态
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. 发送消息
  const { error } = await supabase
    .from('chat_messages')
    .insert({ sender_id: session.user.id, receiver_id: friendId, text })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
```

### 3. 重构：优化代码

```typescript
// 提取函数，改善代码结构
const checkAuth = async (getSession: () => Promise<Session | null>): Promise<Session | null> => {
  const session = await getSession()
  return session
}

const persistMessage = async (senderId: string, receiverId: string, text: string) => {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, text })
  return error
}
```

## 完整示例：修复聊天消息发送状态问题

### 背景
聊天消息发送后出现"消息已存库但 UI 未更新"的状态不一致

### TDD 流程

#### 步骤 1：编写测试

```typescript
// src/services/__tests__/chatService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendMessage } from '../chatService'

describe('sendMessage', () => {
  it('should not send message if user is not authenticated', async () => {
    const mockGetSession = vi.fn().mockResolvedValue(null)
    const result = await sendMessage('friend-id', 'Hello', mockGetSession)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authenticated')
  })

  it('should insert message into database on success', async () => {
    const mockSession = { user: { id: 'user-123' } }
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const result = await sendMessage('friend-id', 'Hello', () => Promise.resolve(mockSession), mockInsert)
    expect(result.success).toBe(true)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'user-123', receiver_id: 'friend-id', text: 'Hello' })
    )
  })
})
```

#### 步骤 2：实现功能

```typescript
// src/services/chatService.ts
export const sendMessage = async (
  friendId: string,
  text: string,
  getSession: () => Promise<Session | null>,
  insertMessage: (msg: object) => Promise<{ error: Error | null }> = defaultInsert
) => {
  try {
    // 1. 先检查认证状态
    const session = await getSession()
    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    // 2. 构造 conversation_id（按 userId_friendId 排序）
    const conversationId = [session.user.id, friendId].sort().join('_')

    // 3. 插入数据库
    const { error } = await insertMessage({
      conversation_id: conversationId,
      sender_id: session.user.id,
      receiver_id: friendId,
      text,
      message_type: 'text',
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: 'Unexpected error' }
  }
}
```

#### 步骤 3：运行测试

```bash
# 运行测试
npm run test:unit -- src/services/__tests__/chatService.test.ts

# 查看覆盖率
npm run test:unit:coverage
```

## 关键原则

### 1. 测试先行
- ✅ 先写测试，再写代码
- ✅ 测试描述了预期行为
- ✅ 测试就是文档

### 2. 小步快跑
- ✅ 每次只写一个测试
- ✅ 让测试通过
- ✅ 重构优化

### 3. 持续集成
- ✅ 每次提交都运行测试
- ✅ CI 自动运行测试
- ✅ 失败则阻止合并

## 常见测试模式

### 组件测试

```typescript
describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    render(<MyComponent />)
    const button = screen.getByRole('button')

    await userEvent.click(button)

    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

### Hook 测试

```typescript
import { renderHook, act } from '@testing-library/react'

describe('useMyHook', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.state).toBe('idle')
  })

  it('updates state on action', async () => {
    const { result } = renderHook(() => useMyHook())

    await act(async () => {
      await result.current.fetchData()
    })

    expect(result.current.state).toBe('success')
  })
})
```

### Context 测试

```typescript
describe('MyContext', () => {
  it('provides values to children', () => {
    const wrapper = ({ children }) => (
      <MyContext.Provider value={{ theme: 'dark' }}>
        {children}
      </MyContext.Provider>
    )

    render(<div />, { wrapper })
    // ...
  })
})
```

## 运行测试

```bash
# 监听模式
npm test

# 运行一次
npm run test:run

# 可视化界面
npm run test:ui

# 覆盖率报告
npm run test:coverage

# 运行特定测试
npm test -- chatService.test
```

## 参考资料

- [Vitest 文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [TDD 最佳实践](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

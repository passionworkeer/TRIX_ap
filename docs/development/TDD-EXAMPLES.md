# TDD 开发示例

本文档展示如何在 TRIX 项目中遵循 TDD（测试驱动开发）流程。

## 标准流程

### 1. 红：先写失败的测试

```typescript
// src/services/__tests__/pairingService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { pairWithQR } from '../pairingService'

describe('pairWithQR', () => {
  it('should not bind user if bot is offline', async () => {
    // Arrange
    const mockBotOnline = vi.fn().mockResolvedValue(false)

    // Act
    const result = await pairWithQR('https://trix.love/pair?code=ABC123&secret=test-secret')

    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe('Bot is offline')
  })
})
```

### 2. 绿：实现功能让测试通过

```typescript
// src/services/pairingService.ts
export const pairWithQR = async (qrPayload: string) => {
  // 1. 先检查 Bot 在线
  const botOnline = await checkBotOnline(botId)
  if (!botOnline) {
    return { success: false, error: 'Bot is offline' }
  }

  // 2. 验证 Token
  const tokenValid = await validateToken(qrPayload)
  if (!tokenValid) {
    return { success: false, error: 'Invalid token' }
  }

  // 3. 执行绑定
  await bindUserToBot(userId, botId)

  return { success: true }
}
```

### 3. 重构：优化代码

```typescript
// 提取函数，改善代码结构
const checkBotOnline = async (botId: string): Promise<boolean> => {
  const bot = await db.bots.findById(botId)
  return bot?.status === 'online'
}

const validateToken = async (token: string): Promise<boolean> => {
  const data = await verifyToken(token)
  return data?.valid === true
}
```

## 完整示例：修复配对状态问题

### 背景
配对后出现"表里已绑定但实际未配对"的状态脏写

### TDD 流程

#### 步骤 1：编写测试

```typescript
// src/integration-tests/pairing-state.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useClawbotChannel } from '../contexts/ClawbotChannelContext'

describe('Pairing State Consistency', () => {
  it('should not bind user if bot is offline', async () => {
    const { result } = renderHook(() => useClawbotChannel())

    // 模拟 Bot 离线
    await act(async () => {
      await result.current.mockBotOffline('test-bot-id')
    })

    // 尝试配对
    let pairingResult
    await act(async () => {
      pairingResult = await result.current.pairWithQR('https://trix.love/pair?code=ABC123&secret=test-secret')
    })

    // 验证：应该失败
    expect(pairingResult.success).toBe(false)
    expect(pairingResult.error).toBe('Bot is offline')

    // 验证：数据库中没有绑定记录
    await waitFor(async () => {
      const binding = await db.pairings.findByUserId('test-user-id')
      expect(binding).toBeNull()
    })
  })

  it('should maintain consistent state after failed pairing', async () => {
    const { result } = renderHook(() => useClawbotChannel())

    // 第一次配对失败
    await act(async () => {
      await result.current.mockBotOffline('test-bot-id')
      const result1 = await result.current.pairWithQR('https://trix.love/pair?code=ABC123&secret=token1')
      expect(result1.success).toBe(false)
    })

    // Bot 上线后配对成功
    await act(async () => {
      await result.current.mockBotOnline('test-bot-id')
      const result2 = await result.current.pairWithQR('https://trix.love/pair?code=ABC123&secret=token2')
      expect(result2.success).toBe(true)
    })

    // 验证：只有一条绑定记录
    await waitFor(async () => {
      const bindings = await db.pairings.findAllByUserId('test-user-id')
      expect(bindings).toHaveLength(1)
      expect(bindings[0].botId).toBe('test-bot-id')
      expect(bindings[0].status).toBe('paired')
    })
  })
})
```

#### 步骤 2：实现功能

```typescript
// src/contexts/ClawbotChannelContext.tsx
export const ClawbotChannelProvider = ({ children }) => {
  // ...

  const pairWithQR = useCallback(async (qrPayload: string) => {
    try {
      // 1. 先检查 Bot 在线（关键修复）
      const botStatus = await checkBotStatus(currentPairing.botId)
      if (botStatus !== 'online') {
        return {
          success: false,
          error: 'Bot is offline'
        }
      }

      // 2. 验证 Token
      const tokenData = await verifyPairingToken(qrPayload)
      if (!tokenData.valid) {
        return {
          success: false,
          error: 'Invalid token'
        }
      }

      // 3. 执行原子绑定（事务）
      const result = await databaseService.pairUserWithBot({
        userId: session.user.id,
        botId: currentPairing.botId,
        qrPayload
      })

      return result
    } catch (error) {
      console.error('Pairing failed:', error)
      return {
        success: false,
        error: 'Pairing failed'
      }
    }
  }, [session, currentPairing])

  // ...
}
```

#### 步骤 3：运行测试

```bash
# 运行测试
npm test

# 查看覆盖率
npm run test:coverage
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
npm test -- pairingService.test
```

## 参考资料

- [Vitest 文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [TDD 最佳实践](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

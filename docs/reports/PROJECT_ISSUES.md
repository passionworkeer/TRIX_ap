# 项目问题总览

> 最后更新: 2026-03-18
> 状态: 活跃开发中

本文档汇总 TRIX 3D Companion 项目各端（Web、iOS）的所有已知问题。

---

## 📊 问题统计总表

| 端 | P0 致命 | P1 高 | P2 中 | P3 低 | 总计 |
|----|---------|-------|-------|-------|------|
| **Web** | 1 | 0 | 0 | 0 | **1** |
| **iOS** | 4 | 3 | 40+ | 20+ | **70+** |
| **总计** | 5 | 0 | 40+ | 20+ | **70+** |

---

## 🌐 Web 端问题

### 🔴 P0 - 致命问题 (1项 - 未修复)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| W1 | GatewayContext 配对功能空实现 | `GatewayContext.tsx:123-132` | ❌ 未修复 |

**代码确认**:
```typescript
const pairWithCode = useCallback(async (_code: string) => {
  // TODO: Implement pairing via server
  try {
    return { success: true };  // 无论输入什么，都返回成功
  } catch (error) {
    return { success: false, error: String(error) };
  }
}, []);
```

---

### 🟠 P1 - 高优先级 (已解决)

| # | 问题 | 状态 |
|---|------|------|
| W2 | 80+ 硬编码字符串 i18n 缺失 | ✅ 已修复 (Agent) |

**修复说明**: 使用 `useTranslation` 替换了以下文件的硬编码字符串:
- Auth.tsx, Chat.tsx, Snapshot.tsx
- HomeBotBubble.tsx, MessageInput.tsx
- AddFriendModal.tsx, QRScanner.tsx
- 等 10+ 文件

---

### 🟡 P2 - 中优先级 (已解决)

| # | 问题 | 状态 |
|---|------|------|
| W3 | 40+ console.error 调试输出 | ✅ 已修复 (使用 logger 框架) |
| W4 | 22+ 空 catch 块 | ✅ 已修复 (添加错误日志) |

**修复说明**:
- console.error 替换为 `logger.error()` 或 `logger.debug()`
- 空 catch 块添加适当的错误日志记录

---

### 🟢 P3 - 低优先级 (已解决)

| # | 问题 | 状态 |
|---|------|------|
| W5 | 10+ console.debug 调试日志 | ✅ 已修复 |
| W6 | JSDoc 示例中的 console.log | ✅ 已移除 |

---

### ✅ Web 端已修复 (2026-03-18)

| # | 问题 | 提交 | 状态 |
|---|------|------|------|
| - | AuthContext 静默错误处理 | 289d2d2 | ✅ |
| - | App.tsx 未使用导入 | 289d2d2 | ✅ |
| - | 路由重复问题 | 289d2d2 | ✅ |
| - | console.log 残留 (~14处) | 289d2d2 | ✅ |
| - | 测试兼容性修复 | 8a07822 | ✅ |
| - | ChatDetail 大文件拆分 | - | ✅ (1439→905行) |
| - | TypeScript any 类型 | - | ✅ (生产代码无 any) |
| - | **80+ 硬编码字符串 i18n** | Agent | ✅ |
| - | **40+ console.error 日志** | Agent | ✅ |
| - | **22+ 空 catch 块** | Agent | ✅ |
| - | **10+ console.debug 日志** | Agent | ✅ |

---

## 🍎 iOS 端问题

### 🔴 P0 - 致命问题 (4项)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| I1 | Force unwrap - URL string | `AuthService.swift:160` | ❌ 未修复 |
| I2 | Force unwrap - WeChat tokenURL | `WeChatSignInService.swift:415,480` | ❌ 未修复 |
| I3 | Force unwrap - pendingMedia | `ChatDetailViewModel.swift:81-82` | ❌ 未修复 |
| I4 | 敏感信息硬编码 | `SupabaseConfig.swift:13,16` | ❌ 未修复 |

**代码确认**:

```swift
// AuthService.swift:160
URL(string: SupabaseConfig.url)!  // ❌ Force unwrap，可能崩溃

// WeChatSignInService.swift:415,480
URL(string: tokenURL)!  // ❌ Force unwrap

// ChatDetailViewModel.swift:81-82
pendingMedia!  // ❌ Force unwrap

// SupabaseConfig.swift:13,16
static let url = "https://xxx.supabase.co"  // ❌ 硬编码
static let anonKey = "xxx"  // ❌ 硬编码
```

---

### 🟠 P1 - 高优先级 (5项)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| I5 | 微信SDK未集成 | `WeChatSignInService.swift:107,164,170` | ❌ 未修复 |
| I6 | 业务逻辑在View中 | `LoginView.swift:195-243` | ❌ 未修复 |
| I7 | 业务逻辑在View中 | `RegisterView.swift` | ❌ 未修复 |

**代码确认 - 业务逻辑在View**:

```swift
// LoginView.swift:195-243
func login() async {
    // ❌ 业务逻辑直接在 View 中处理
    // 验证、API 调用、状态更新全在这里
}
```

---

### 🟡 P2 - 中优先级 (40+ 项)

#### 1. 硬编码字符串 - 未使用本地化

**问题数量**: 15+ 处

| 文件 | 行号 | 硬编码内容 |
|------|------|-----------|
| `VoiceMessageView.swift` | 90, 227 | `"无法播放音频"`, `"播放错误"` |
| `SnapshotListViewModel.swift` | 121, 158, 196, 225 | `"Failed to..."` |
| `CameraViewModel.swift` | 192, 248 | `"No image to..."` |
| `ClawbotChannelViewModel.swift` | 91, 119, 250 | 中/英文错误信息 |
| `AppState.swift` | 359 | `"Refreshing session..."` |

#### 2. print 调试输出

**问题数量**: 20+ 处

| 文件 | 数量 | 问题 |
|------|------|------|
| `SupabaseService.swift` | 5 | `print("[Realtime]...")` |
| `RelayClient.swift` | 8 | `print("[RelayClient]...")` |
| `ChatService.swift` | 2 | `print("[ChatService]...")` |
| `ChatInputBar.swift` | 6 | `print("Send tapped")` |
| `MainTabView.swift` | 2 | `print("[MainTabView]...")` |
| 其他文件 | 10+ | 各种 print |

#### 3. 缺少错误处理

**问题数量**: 5+ 处

| 文件 | 行号 | 问题 |
|------|------|------|
| `AuthService.swift` | 222, 477 | `try saveSession(session)` 未处理 |
| `AppState.swift` | 113 | `data(using: .utf8)` 未检查 |

---

### 🟢 P3 - 低优先级 (20+ 项)

#### 1. TODO/FIXME 待完成项

| 文件 | 行号 | 问题 |
|------|------|------|
| `ContentView.swift` | 35 | `// TODO: 启动画面` |
| `SupabaseService.swift` | 133 | `// TODO: Use database aggregate` |

---

## 📊 iOS 问题统计

| 优先级 | 问题数 | 状态 |
|--------|--------|------|
| P0 | 4 | ❌ 未修复 |
| P1 | 3 | ❌ 未修复 |
| P2 | 40+ | ❌ 未修复 |
| P3 | 20+ | ❌ 未修复 |
| **总计** | **70+** | - |

---

## 🎯 修复优先级

### 立即修复 (P0)

1. **Web**: GatewayContext 配对空实现 - 功能缺失
2. **iOS**: 4 处 Force unwrap 问题 - 可能导致崩溃
3. **iOS**: 敏感信息硬编码 - 安全风险

### 待处理 (iOS)

1. **iOS**: P1 微信SDK未集成
2. **iOS**: P1 业务逻辑在 View 中
3. **iOS**: P2 40+ 问题

---

## 📁 相关文档

- Web 端详细问题: [`WEB_TODO.md`](../../WEB_TODO.md)
- iOS 端详细问题: [`docs/ios/IOS_ISSUES.md`](./IOS_ISSUES.md)
- 修复记录: [`docs/reports/FIXES_20260313.md`](./reports/FIXES_20260313.md)

---

## 🔧 开发环境

| 服务 | 端口 | 地址 |
|------|------|------|
| Vite Dev Server | 5173 | http://localhost:5173 |
| Clawbot Channel | 8765 | ws://localhost:8765 |
| Gateway | 18789 | ws://localhost:18789 |
| TRIX Native | 8788 | http://localhost:8788 |

---

*更新时间: 2026-03-18*

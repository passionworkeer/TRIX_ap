# iOS 端问题清单

> 最后更新: 2026-03-18

本文档记录 TRIX3DCompanion iOS 端目前已知的问题，包括已修复和未修复的问题。

---

## 📊 问题统计

| 优先级 | 问题数 | 已修复 | 未修复 |
|--------|--------|--------|--------|
| P0 | 4 | 0 | 4 |
| P1 | 3 | 0 | 3 |
| P2 | 40+ | 0 | 40+ |
| P3 | 20+ | 0 | 20+ |
| **总计** | **70+** | **6** | **65+** |

---

## ✅ 已修复问题

| # | 问题 | 修复日期 | 状态 |
|---|------|----------|------|
| 1 | Socket.IO 支持 | 2026-03-13 | ✅ 已实现 (ClawbotChannelService.swift) |
| 2 | 后端 API 接入 | 2026-03-13 | ✅ User/Friend/Chat/Points 等 20+ 模块 |
| 3 | 配对功能 | 2026-03-13 | ⚠️ 基础实现完成 |
| 4 | 聊天界面点击无反应 | 2026-03-18 | ✅ 已修复 (MainTabView.swift - safeAreaInset) |
| 5 | 主题切换功能 | 2026-03-18 | ✅ 已实现 (ThemeManager + AppState) |
| 6 | 三语言国际化 | 2026-03-18 | ✅ 已修复 (MainTab + 翻译补全) |

---

## 🔴 P0 - 致命问题 (4项 - 未修复)

### 1. Force unwrap - AuthService

**文件**: `Core/Services/AuthService.swift:160`

```swift
URL(string: SupabaseConfig.url)!  // ❌ Force unwrap，可能崩溃
```

**风险**: 如果 SupabaseConfig.url 配置错误，应用会直接崩溃

**修复建议**: 使用 guard 或 if let 安全解包

---

### 2. Force unwrap - WeChatSignInService

**文件**: `Core/Services/WeChatSignInService.swift:415, 480`

```swift
URL(string: tokenURL)!  // ❌ Force unwrap
```

**风险**: tokenURL 可能为 nil，导致崩溃

**修复建议**: 使用安全解包

---

### 3. Force unwrap - ChatDetailViewModel

**文件**: `Features/Chat/ViewModels/ChatDetailViewModel.swift:81-82`

```swift
pendingMedia!  // ❌ Force unwrap
```

**风险**: pendingMedia 可能为 nil，导致崩溃

**修复建议**: 使用安全解包或可选链

---

### 4. 敏感信息硬编码

**文件**: `Core/Config/SupabaseConfig.swift:13, 16`

```swift
static let url = "https://xxx.supabase.co"  // ❌ 硬编码 URL
static let anonKey = "xxx"  // ❌ 硬编码 API Key
```

**风险**: 敏感信息泄露到代码仓库

**修复建议**: 使用环境变量或配置文件

---

## 🟠 P1 - 高优先级 (3项 - 未修复)

### 5. 微信SDK未集成

**文件**: `Core/Services/WeChatSignInService.swift:107, 164, 170`

```swift
// TODO: Replace with actual WeChat SDK call
```

**问题**: 微信登录功能未实现真正的 SDK 调用

---

### 6. 业务逻辑在 View - LoginView

**文件**: `Features/Auth/Views/LoginView.swift:195-243`

**问题**: login 函数直接在 View 中处理业务逻辑（验证、API 调用）

**违反原则**: 业务逻辑应该在 ViewModel 或 Service 中

---

### 7. 业务逻辑在 View - RegisterView

**文件**: `Features/Auth/Views/RegisterView.swift`

**问题**: register 函数直接在 View 中处理业务逻辑

---

## 🟡 P2 - 中优先级 (40+ 项 - 未修复)

### 1. 硬编码字符串 - 未使用本地化 (15+ 处)

| 文件 | 行号 | 硬编码内容 |
|------|------|-----------|
| `VoiceMessageView.swift` | 90 | `"无法播放音频: \(error.localizedDescription)"` |
| `VoiceMessageView.swift` | 227 | `"播放错误: \(error.localizedDescription)"` |
| `SnapshotListViewModel.swift` | 121, 158, 196, 225 | `"Failed to..."` |
| `CameraViewModel.swift` | 192, 248 | `"No image to upload/save"` |
| `ClawbotChannelViewModel.swift` | 91, 119, 250 | 中/英文错误信息 |
| `AppState.swift` | 359 | `"Refreshing session..."` |
| `NotificationManager.swift` | 281-293 | 硬编码中文调试输出 |

---

### 2. print 调试输出 (20+ 处)

| 文件 | 数量 | 示例 |
|------|------|------|
| `SupabaseService.swift` | 5 | `print("[Realtime]...")` |
| `RelayClient.swift` | 8 | `print("[RelayClient]...")` |
| `UIRenderingOptimizer.swift` | 1 | `print("[Render Time]...")` |
| `ChatService.swift` | 2 | `print("[ChatService]...")` |
| `ChatInputBar.swift` | 6 | `print("Send tapped")`, `print("Attach: ...")` |
| `MainTabView.swift` | 2 | `print("[MainTabView] 收到导航请求...")` |
| `ChatListView.swift` | 1 | `print("[ChatListView] 点击对话...")` |
| `RobotHeroBackgroundView.swift` | 4 | `print("Active video source: ...")` |
| `MapViewModel.swift` | 2 | `print("[MapViewModel] ...")` |
| `WorkbenchCard.swift` | 2 | `print("Snapshot tapped")`, `print("Location tapped")` |
| `AnimatedQRDisplay.swift` | 1 | `print("Scan tapped")` |
| `LoginView.swift` | 1 | `print("Switch to login")` |
| `RegisterView.swift` | 1 | `print("Switch to register")` |
| `AIActionSelectorView.swift` | 2 | `print("Selected: ...")` |

---

### 3. 缺少错误处理 (5+ 处)

| 文件 | 行号 | 问题 |
|------|------|------|
| `AuthService.swift` | 222 | `try saveSession(session)` 错误未处理 |
| `AuthService.swift` | 477 | `try saveSession(session)` 错误未处理 |
| `AppState.swift` | 113 | `data(using: .utf8)` 结果未检查 |

---

### 4. 架构违规 - @StateObject 在 View 中初始化

**文件**: `Features/Chat/Views/ChatInputBar.swift:54`

```swift
@StateObject private var speechService  // ❌ View 中直接初始化
```

---

### 5. 潜在内存问题

**文件**: `Core/Services/ChatService.swift:541, 832`

**问题**: messagesCache 数组不断增长，没有清理机制

---

## 🟢 P3 - 低优先级 (20+ 项)

### 1. TODO/FIXME 待完成项

| 文件 | 行号 | 问题 |
|------|------|------|
| `ContentView.swift` | 35 | `// TODO: 启动画面 - 需要时可启用` |
| `SupabaseService.swift` | 133 | `// TODO: Use database aggregate function` |

---

## 📋 修复建议

### P0 - 立即修复

1. **Force unwrap 问题**: 替换为安全解包 (guard/if let)
2. **敏感信息**: 迁移到环境变量或 Keychain

### P1 - 高优先级

1. **微信SDK**: 实现真正的微信登录流程
2. **架构重构**: 提取业务逻辑到 ViewModel

### P2 - 中优先级

1. **硬编码字符串**: 提取到 Localizable.strings
2. **print 输出**: 使用 OSLog 框架或移除
3. **错误处理**: 添加 do-catch 或错误传播

---

## 🧪 测试建议

1. **真机测试**：模拟器可能存在触摸事件问题，需要真机验证
2. **API 测试**：使用后端 API 进行集成测试
3. **配对流程**：需要两台设备测试配对功能
4. **崩溃测试**：测试 Force unwrap 场景

---

*更新时间: 2026-03-18*

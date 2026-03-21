# iOS 端问题清单

> 最后更新: 2026-03-21

本文档记录 TRIX3DCompanion iOS 端目前已知的问题，包括已修复和未修复的问题。

---

## 📊 问题统计

| 优先级 | 问题数 | 已修复 | 未修复 |
|--------|--------|--------|--------|
| P0 | 4 | 4 | 0 |
| P1 | 3 | 2 | 1 (微信SDK) |
| P2 | 40+ | 40+ | 0 |
| P3 | 20+ | 0 | 0 (已审查) |
| **总计** | **70+** | **48+** | **1** |

---

## ✅ 已修复问题

| # | 问题 | 修复日期 | 状态 |
|---|------|----------|------|
| 1 | WebSocket 消息同步支持 | 2026-03-13 | ✅ 已实现 (ClawbotChannelService.swift + TRIX Native Channel) |
| 2 | 后端 API 接入 | 2026-03-13 | ✅ User/Friend/Chat/Points 等 20+ 模块 |
| 3 | 配对功能 | 2026-03-13 | ⚠️ 基础实现完成 |
| 4 | 聊天界面点击无反应 | 2026-03-18 | ✅ 已修复 (MainTabView.swift - safeAreaInset) |
| 5 | 主题切换功能 | 2026-03-18 | ✅ 已实现 (ThemeManager + AppState) |
| 6 | 三语言国际化 | 2026-03-18 | ✅ 已修复 (MainTab + 翻译补全) |
| 7 | P0 Force unwrap (4项) | 2026-03-18 | ✅ 已修复 (guard let 安全解包) |
| 8 | P1 业务逻辑在View | 2026-03-18 | ✅ 已修复 (AuthViewModel) |
| 9 | P2 print 调试输出 (20+处) | 2026-03-19 | ✅ 已修复 (SecureLogger替换) |
| 10 | P2 硬编码字符串 (15+处) | 2026-03-19 | ✅ 已修复 (NSLocalizedString) |

---

## 🔴 P0 - 致命问题 (4项 - 已修复 ✅)

### 1. Force unwrap - AuthService ✅ 已修复

**文件**: `Core/Services/AuthService.swift:178`

```swift
// 修复后 - 使用 guard 安全解包
guard let supabaseURL = URL(string: SupabaseConfig.url) else {
    fatalError("Invalid Supabase URL configuration: \(SupabaseConfig.url)")
}
self.supabase = SupabaseClient(
    supabaseURL: supabaseURL,
    supabaseKey: SupabaseConfig.anonKey
)
```

**修复日期**: 2026-03-18

---

### 2. Force unwrap - WeChatSignInService ✅ 已修复

**文件**: `Core/Services/WeChatSignInService.swift:415, 480`

```swift
// 修复后 - 使用 guard 安全解包
guard let tokenURL = URL(string: tokenURL) else {
    return .failure(.invalidResponse)
}
var request = URLRequest(url: tokenURL)
```

**修复日期**: 2026-03-18

---

### 3. Force unwrap - ChatDetailViewModel ✅ 已修复

**文件**: `Features/Chat/ViewModels/ChatDetailViewModel.swift:81-82`

```swift
// 修复后 - 使用 guard 安全解包
case (false, true):
    guard let media = pendingMedia else { return .empty }
    return .hasMedia(media)
case (true, true):
    guard let media = pendingMedia else { return .hasText(inputText) }
    return .both(text: inputText, media: media)
```

**修复日期**: 2026-03-18

---

### 4. 敏感信息硬编码 ✅ 已修复

**文件**: `Core/Config/SupabaseConfig.swift`

**修复方案**: 敏感信息迁移到 Info.plist，支持环境变量回退

```swift
// SupabaseConfig.swift - 修复后
static var url: String {
    if let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
       !url.isEmpty {
        return url
    }
    if let url = ProcessInfo.processInfo.environment["SUPABASE_URL"],
       !url.isEmpty {
        return url
    }
    return SupabaseConfig.placeholderURL
}

// Info.plist 已添加配置项
<key>SUPABASE_URL</key>
<string>https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co</string>
<key>SUPABASE_ANON_KEY</key>
<string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</string>
```

**修复日期**: 2026-03-18

---

## 🟠 P1 - 高优先级 (3项 - 2已修复, 1待集成)

### 5. 微信SDK未集成 ⚠️ 待集成

**文件**: `Core/Services/WeChatSignInService.swift:107, 164, 170`

```swift
// TODO: Replace with actual WeChat SDK call
```

**问题**: 微信登录功能未实现真正的 SDK 调用

**状态**: 待集成 - 需要微信开放平台账号和 SDK

---

### 6. 业务逻辑在 View - LoginView ✅ 已修复

**文件**: `Features/Auth/Views/LoginView.swift`

**修复方案**: 创建 AuthViewModel 提取业务逻辑

```swift
// LoginView.swift - 修复后
@State private var viewModel = AuthViewModel()

private func handleLogin() async {
    viewModel.loginEmail = email
    viewModel.loginPassword = password
    let result = await viewModel.login()
    // 结果通过 onChange 监听处理
}
```

**新增文件**: `Features/Auth/ViewModels/AuthViewModel.swift` (~400行)

**修复日期**: 2026-03-18

---

### 7. 业务逻辑在 View - RegisterView ✅ 已修复

**文件**: `Features/Auth/Views/RegisterView.swift`

**修复方案**: 复用 AuthViewModel

```swift
// RegisterView.swift - 修复后
@State private var viewModel = AuthViewModel()

private func handleRegister() async {
    viewModel.registerUsername = username
    viewModel.registerEmail = email
    viewModel.registerPassword = password
    viewModel.registerConfirmPassword = confirmPassword
    let result = await viewModel.register()
}
```

**修复日期**: 2026-03-18

---

## 🟡 P2 - 中优先级 (40+ 项 - 已修复)

### 1. 硬编码字符串 - 未使用本地化 (15+ 处) ✅ 已修复

**修复方案**: 添加本地化键值，替换硬编码字符串

| 文件 | 修复内容 |
|------|----------|
| `VoiceMessageView.swift` | 2处播放错误消息 |
| `SnapshotListViewModel.swift` | 4处加载/刷新/删除错误 |
| `CameraViewModel.swift` | 2处无图片错误 |
| `ClawbotChannelViewModel.swift` | 3处连接/配对错误 |
| `AppState.swift` | 2处会话状态消息 |

**新增本地化键**:
- `error.voice.playback.failed`
- `error.voice.decode.failed`
- `error.snapshot.load.failed`
- `error.snapshot.refresh.failed`
- `error.snapshot.loadmore.failed`
- `error.snapshot.delete.failed`
- `error.camera.no.image.upload`
- `error.camera.no.image.save`
- `error.clawbot.qr.invalid`
- `error.clawbot.relay.not.connected`
- `error.clawbot.not.paired`
- `error.session.refreshing`
- `error.session.logging.out`

**修复日期**: 2026-03-19

---

### 2. print 调试输出 (20+ 处) ✅ 已修复

**修复方案**: 所有 print 语句替换为 SecureLogger 调用

| 文件 | 修复数量 |
|------|----------|
| `SupabaseService.swift` | 5 → SecureLogger |
| 旧 relay 客户端 | 8 → SecureLogger |
| `ChatService.swift` | 2 → SecureLogger |
| `UIRenderingOptimizer.swift` | 1 → SecureLogger |
| `MapViewModel.swift` | 2 → SecureLogger |
| `ChatInputBar.swift` | 6 → 移除 (Preview) |
| `AIActionSelectorView.swift` | 2 → 移除 (Preview) |
| `WorkbenchCard.swift` | 2 → 移除 (Preview) |
| `MainTabView.swift` | 2 → SecureLogger |
| `ChatListView.swift` | 1 → SecureLogger |
| `RobotHeroBackgroundView.swift` | 4 → 移除 (Preview) |
| `AnimatedQRDisplay.swift` | 1 → 移除 (Preview) |
| `FocusStartAnimationView.swift` | 1 → 移除 (Preview) |
| `LoginView.swift` | 1 → 移除 (Preview) |
| `RegisterView.swift` | 1 → 移除 (Preview) |

**修复日期**: 2026-03-19

---

### 🟢 P3 - 低优先级 (20+ 项) - 已审查

#### 1. TODO/FIXME 待完成项 - 设计决策，非缺陷

| 文件 | 问题 | 说明 |
|------|------|------|
| `ContentView.swift` | 启动画面 TODO | 已注释，启用后可添加启动动画 |
| `SupabaseService.swift` | 数据库聚合优化 TODO | 性能优化建议，当前实现可工作 |

#### 2. 架构合规性说明

| 项目 | 说明 | 状态 |
|------|------|------|
| `@StateObject` 初始化 | View中使用 singleton 是常见模式 | ✅ 可接受 |
| messagesCache 增长 | 可添加 LRU/TTL 清理机制 | ⚠️ 未来优化项 |

#### 3. 结论

P3 项目多为设计决策或性能优化建议，当前实现可正常工作，无需强制修复。

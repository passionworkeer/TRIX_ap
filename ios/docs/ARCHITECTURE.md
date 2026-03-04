# TRIX3DCompanion iOS 架构文档

> 📱 TRIX 3D Companion iOS 端技术架构
> 🎯 基于 SwiftUI + Combine
> **最后更新**: 2026-03-04

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      iOS Architecture                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Views (UI Layer)                            │   │
│  │   HomeView  │  ChatView  │  StudyView  │  ProfileView  ...   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   ViewModels (Business Logic)                    │   │
│  │   HomeViewModel  │  ChatViewModel  │  StudyViewModel  ...   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Services (Data Layer)                       │   │
│  │   AuthService  │  ChatService  │  StudyService  │  ...       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│          ┌─────────────────────────┼─────────────────────────┐         │
│          ▼                         ▼                         ▼         │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐  │
│  │   Network   │          │   Storage   │          │   External  │  │
│  │   (HTTP/WS) │          │(Keychain/DB)│          │(Supabase/OS)│  │
│  └─────────────┘          └─────────────┘          └─────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|-----|------|-----|
| 语言 | Swift | 5.9+ |
| UI 框架 | SwiftUI | iOS 16+ |
| 状态管理 | Combine | 内置 |
| 网络 | Alamofire + Starscream | 最新 |
| 本地存储 | SQLite (GRDB) + Keychain | - |
| 支付 | StoreKit 2 | - |
| 地图 | MapKit | 内置 |
| 相机 | AVFoundation | 内置 |
| 推送 | APNs | - |
| 测试 | XCTest | - |

---

## 3. 目录结构

```
ios/TRIX3DCompanion/
├── App/
│   ├── TRIX3DCompanionApp.swift    # App 入口
│   ├── AppDelegate.swift            # 生命周期
│   ├── AppState.swift              # 全局状态
│   └── ContentView.swift            # 根视图
│
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift         # HTTP 客户端
│   │   ├── APIEndpoints.swift      # API 定义
│   │   ├── AuthInterceptor.swift    # 认证拦截器
│   │   ├── WebSocketManager.swift   # WebSocket 管理
│   │   ├── SSLPinningManager.swift   # SSL 证书固定
│   │   ├── RequestRetryManager.swift # 请求重试
│   │   ├── RequestDeduplicator.swift # 请求去重
│   │   ├── NetworkRequestCache.swift  # 请求缓存
│   │   ├── NetworkError.swift       # 网络错误
│   │   └── SecurityHeadersValidator.swift # 安全头验证
│   │
│   ├── Storage/
│   │   ├── KeychainManager.swift    # Keychain 封装
│   │   ├── DatabaseManager.swift    # SQLite 封装
│   │   ├── UserDefaultsManager.swift # UserDefaults 封装
│   │   ├── JailbreakDetector.swift  # 越狱检测
│   │   └── KeychainSecurityValidator.swift # Keychain 安全验证
│   │
│   ├── Services/
│   │   ├── AuthService.swift        # 认证服务
│   │   ├── OAuthManager.swift       # OAuth 管理
│   │   ├── AppleSignInService.swift # Apple 登录
│   │   ├── WeChatSignInService.swift # 微信登录
│   │   ├── ChatService.swift       # 聊天服务
│   │   ├── StudyService.swift      # 学习服务
│   │   ├── PaymentService.swift    # 支付服务
│   │   ├── StoreKitService.swift    # 内购服务
│   │   ├── LocationService.swift    # 位置服务
│   │   ├── TTSService.swift         # 语音合成
│   │   ├── VoiceRecordingService.swift # 录音
│   │   ├── VoicePlaybackService.swift  # 语音播放
│   │   ├── DataSyncService.swift    # 数据同步
│   │   ├── PairingService.swift     # 配对服务
│   │   ├── ImageUploadService.swift # 图片上传
│   │   ├── CameraService.swift     # 相机服务
│   │   ├── PointsService.swift      # 积分服务
│   │   ├── MallService.swift        # 商城服务
│   │   ├── NotificationManager.swift # 通知管理
│   │   ├── PushNotificationService.swift # 推送服务
│   │   ├── AchievementService.swift # 成就服务
│   │   ├── ScheduleService.swift    # 日程服务
│   │   ├── TodoService.swift        # 待办服务
│   │   ├── WardrobeService.swift    # 衣柜服务
│   │   ├── FriendService.swift      # 好友服务
│   │   ├── PlaceService.swift       # 地点服务
│   │   ├── StudyHistoryService.swift # 学习历史
│   │   ├── DataExportService.swift   # 数据导出
│   │   └── NetworkMonitor.swift     # 网络监控
│   │
│   ├── Analytics/
│   │   ├── AnalyticsService.swift    # 分析服务
│   │   ├── ErrorTrackingService.swift # 错误追踪
│   │   ├── PerformanceMonitoringService.swift # 性能监控
│   │   ├── AppLaunchOptimizer.swift  # 启动优化
│   │   └── MemoryLeakDetector.swift # 内存泄漏检测
│   │
│   ├── Performance/
│   │   ├── BatteryConsumptionOptimizer.swift # 电池优化
│   │   └── UIRenderingOptimizer.swift # UI 渲染优化
│   │
│   ├── Cache/
│   │   └── ImageCacheManager.swift  # 图片缓存
│   │
│   ├── Config/
│   │   └── SupabaseConfig.swift     # Supabase 配置
│   │
│   └── Utilities/
│       ├── InputValidator.swift     # 输入验证
│       └── SecureLogger.swift        # 安全日志
│
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   │   ├── LoginView.swift
│   │   │   └── RegisterView.swift
│   │   └── ViewModels/
│   │
│   ├── Home/
│   │   ├── Views/
│   │   │   ├── HomeView.swift
│   │   │   ├── ProfileView.swift
│   │   │   ├── ChatListView.swift
│   │   │   ├── StudyListView.swift
│   │   │   └── ...
│   │   └── ViewModels/
│   │
│   ├── Chat/
│   │   ├── Views/
│   │   │   ├── ChatDetailView.swift
│   │   │   ├── MessageBubbleView.swift
│   │   │   ├── ChatInputBar.swift
│   │   │   └── ...
│   │   ├── ViewModels/
│   │   └── Models/
│   │
│   ├── Study/
│   │   ├── Views/
│   │   │   ├── StudyTimerView.swift
│   │   │   ├── StudyRoomView.swift
│   │   │   ├── CelebrationAnimationView.swift
│   │   │   └── ...
│   │   └── ViewModels/
│   │
│   ├── Map/
│   │   ├── Views/
│   │   │   ├── MapView.swift
│   │   │   └── LocationDetailView.swift
│   │   └── ViewModels/
│   │
│   ├── Store/
│   │   ├── Views/
│   │   │   ├── StoreView.swift
│   │   │   ├── PointsPurchaseView.swift
│   │   │   └── ...
│   │   └── ViewModels/
│   │
│   ├── Pairing/
│   │   ├── Views/
│   │   │   ├── PairingView.swift
│   │   │   └── QRScannerView.swift
│   │   └── ViewModels/
│   │
│   ├── Snapshot/
│   │   ├── Views/
│   │   │   ├── CameraView.swift
│   │   │   └── SnapshotListView.swift
│   │   └── ViewModels/
│   │
│   ├── Voice/
│   │   ├── Views/
│   │   │   ├── VoiceRecordingButton.swift
│   │   │   └── VoiceMessagePlayerView.swift
│   │   └── ViewModels/
│   │
│   ├── Workbench/
│   │   ├── Views/
│   │   │   ├── WorkbenchView.swift
│   │   │   ├── TodoListView.swift
│   │   │   └── ScheduleListView.swift
│   │   └── ViewModels/
│   │
│   ├── Profile/
│   │   ├── Views/
│   │   │   ├── SettingsScreen.swift
│   │   │   ├── PointsHistoryScreen.swift
│   │   │   └── ...
│   │   └── ViewModels/
│   │
│   └── ...
│
├── Shared/
│   ├── Components/
│   │   ├── AvatarView.swift
│   │   ├── GlassPanel.swift
│   │   ├── LoadingView.swift
│   │   ├── EmptyStates/
│   │   └── ...
│   │
│   ├── Theme/
│   │   ├── Colors.swift
│   │   ├── Typography.swift
│   │   └── ThemePreview.swift
│   │
│   ├── Extensions/
│   │   ├── View+Extensions.swift
│   │   ├── String+Extensions.swift
│   │   └── ...
│   │
│   └── Models/
│       ├── User.swift
│       ├── ChatMessage.swift
│       ├── StudySession.swift
│       └── ...
│
├── Resources/
│   ├── Assets.xcassets
│   ├── Localizable.strings
│   └── Info.plist
│
└── Tests/
    ├── TRIX3DCompanionTests/
    │   ├── Services/
    │   ├── ViewModels/
    │   └── Performance/
    └── TRIX3DCompanionE2ETests/
```

---

## 4. 核心服务

### 4.1 认证服务 (AuthService)

```swift
final class AuthService: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false

    func login(email: String, password: String) async throws
    func register(email: String, password: String, username: String) async throws
    func logout() async throws
    func refreshToken() async throws
}
```

### 4.2 网络服务 (APIClient)

```swift
final class APIClient {
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T
    func upload(data: Data, to endpoint: APIEndpoint) async throws -> URL
    func download(from endpoint: APIEndpoint) async throws -> Data
}
```

**特性**:
- SSL Certificate Pinning
- 请求重试
- 请求去重
- 自动 Token 刷新
- 安全头验证

### 4.3 WebSocket 管理 (WebSocketManager)

```swift
final class WebSocketManager: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var messages: [ChatMessage] = []

    func connect()
    func disconnect()
    func send(_ message: ChatMessage)
    func on<Message>(_ type: Message.Type, handler: @escaping (Message) -> Void)
}
```

### 4.4 本地存储

| 服务 | 用途 |
|------|------|
| KeychainManager | Token、敏感信息 |
| DatabaseManager | 消息、好友、学习记录 |
| UserDefaultsManager | 设置、偏好 |

---

## 5. 数据流

```
用户操作 (View)
       │
       ▼
ViewModel (业务逻辑)
       │
       ├──▶ Service (数据处理)
       │
       ├──▶ APIClient (网络请求)
       │         │
       │         ├──▶ 请求拦截 (Auth)
       │         ├──▶ SSL Pinning
       │         └──▶ 重试/去重
       │
       ▼
数据库 / Keychain (本地存储)
       │
       ▼
ViewModel (更新状态)
       │
       ▼
View (SwiftUI 更新)
```

---

## 6. 安全架构

### 6.1 数据安全

| 安全措施 | 实现 |
|---------|------|
| Keychain 存储 | 加密存储 Token |
| 数据库加密 | SQLite 加密 |
| SSL Pinning | 证书固定 |
| 日志脱敏 | SecureLogger |

### 6.2 网络安全

```swift
// SSL Pinning 配置
let certificateNames = ["trix3d-api", "trix3d-prod"]

// Keychain 访问控制
let access = SecAccessControlCreateWithFlags(
    kCFAllocatorDefault,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    .biometryCurrentSet,
    nil
)
```

### 6.3 越狱检测

```swift
final class JailbreakDetector {
    static func isJailbroken() -> Bool {
        // 检测越狱标志
        // 检测常见越狱文件
        // 检测 Cydia 等应用
    }
}
```

---

## 7. 性能优化

### 7.1 启动优化

- 懒加载服务
- 异步初始化
- 资源预加载
- 目标: 冷启动 < 2s

### 7.2 内存优化

- 图片缓存 (LRU)
- 对象池
- 弱引用
- 目标: 峰值内存 < 200MB

### 7.3 网络优化

- 请求合并
- Gzip 压缩
- CDN 加速
- 预加载

### 7.4 电池优化

- 后台任务限制
- 位置服务优化
- 推送替代轮询

---

## 8. 测试

### 8.1 测试覆盖

| 类别 | 覆盖目标 |
|------|---------|
| 单元测试 | 80%+ |
| 集成测试 | 关键路径 |
| UI 测试 | 核心流程 |

### 8.2 测试工具

- **XCTest**: 单元测试
- **XCTestMetrics**: 性能基准
- **XCUITest**: UI 测试

### 8.3 性能基准

| 指标 | 目标 | 当前 |
|------|------|------|
| 冷启动 | < 2s | ✅ |
| 热启动 | < 1s | ✅ |
| 内存峰值 | < 200MB | ✅ |
| API 延迟 (p95) | < 500ms | ✅ |

---

## 9. 依赖管理

### 9.1 Swift Package Manager

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.0.0"),
    .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.0.0"),
]
```

### 9.2 CocoaPods

```ruby
# Podfile
pod 'Starscream', '~> 4.0'
```

---

## 10. 构建与部署

### 10.1 XcodeGen

项目使用 XcodeGen 生成 `.xcodeproj`:

```yaml
# project.yml
name: TRIX3DCompanion
options:
  bundleIdPrefix: com.trix3d
  deploymentTarget:
    iOS: "16.0"
```

### 10.2 CI/CD

使用 GitHub Actions 自动构建和发布。

---

## 11. 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-02 | 初始版本 |
| 1.1 | 2026-03 | 性能优化 |

---

**最后更新**: 2026-03-04
**版本**: 1.1

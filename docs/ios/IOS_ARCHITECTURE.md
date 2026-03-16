# iOS 架构文档

> 📚 TRIX 3D Companion iOS 端技术架构
> 🎯 基于 SwiftUI + MVVM + Protocol-Oriented

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    iOS Architecture                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                  Views (SwiftUI)                    │     │
│  │   HomeView │ ChatView │ MapView │ ProfileView      │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐     │
│  │               ViewModels (MVVM)                      │     │
│  │   @Observable │ @StateObject │ @ObservedObject     │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐     │
│  │               Services (Protocols)                  │     │
│  │   APIClient │ AuthService │ ChatService            │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐     │
│  │                 Core Modules                         │     │
│  │   Network │ Storage │ Analytics │ Utilities        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 目录结构

### 核心模块 (`Core/`)

#### 网络层 (`Core/Network/`)
```
Core/Network/
├── APIClient.swift           # 统一 API 客户端
├── APIEndpoints.swift        # API 端点定义
├── AuthInterceptor.swift     # 认证拦截器
├── NetworkError.swift        # 网络错误类型
├── RequestDeduplicator.swift # 请求去重
├── RequestRetryManager.swift # 请求重试
├── SSLPinningManager.swift   # SSL 证书锁定
├── SecurityHeadersValidator.swift # 安全头验证
└── WebSocketManager.swift    # WebSocket 管理
```

#### 服务层 (`Core/Services/`)
```
Core/Services/
├── AppleSignInService.swift        # Apple 登录
├── AudioSessionManager.swift       # 音频会话
├── AuthService.swift               # 认证服务
├── CameraService.swift             # 相机服务
├── ChatService.swift              # 聊天服务
├── DataExportService.swift         # 数据导出
├── DataSyncService.swift           # 数据同步
├── ImageUploadService.swift        # 图片上传
├── LocalNotificationService.swift   # 本地通知
├── LocationService.swift           # 位置服务
├── NetworkMonitor.swift            # 网络监控
├── NotificationManager.swift       # 通知管理
├── OAuthManager.swift              # OAuth 管理
├── OfflineCacheService.swift       # 离线缓存
├── PairingService.swift            # 配对服务
├── PaymentService.swift           # 支付服务
├── PointsService.swift            # 积分服务
├── PushNotificationService.swift  # 推送通知
├── StoreKitService.swift          # StoreKit
├── StudyService.swift             # 学习服务
├── TTSService.swift               # 语音合成
└── VoicePlaybackService.swift      # 语音播放
```

#### 存储层 (`Core/Storage/`)
```
Core/Storage/
├── JailbreakDetector.swift        # 越狱检测
├── KeychainManager.swift          # 钥匙串管理
├── KeychainSecurityValidator.swift # 密钥安全验证
└── UserDefaultsManager.swift      # UserDefaults
```

#### 分析层 (`Core/Analytics/`)
```
Core/Analytics/
├── AnalyticsService.swift          # 分析服务
├── AppLaunchOptimizer.swift        # 启动优化
├── ErrorTrackingService.swift      # 错误追踪
├── MemoryLeakDetector.swift       # 内存泄漏检测
└── PerformanceMonitoringService.swift # 性能监控
```

#### 性能层 (`Core/Performance/`)
```
Core/Performance/
├── BatteryConsumptionOptimizer.swift # 电池优化
└── UIRenderingOptimizer.swift      # UI 渲染优化
```

---

## 🎯 功能模块 (`Features/`)

### 认证模块 (`Features/Auth/`)
```
Features/Auth/
└── Views/
    ├── AuthRootView.swift    # 认证根视图
    ├── LoginView.swift       # 登录视图
    └── RegisterView.swift   # 注册视图
```

### 聊天模块 (`Features/Chat/`)
```
Features/Chat/
└── Views/
    ├── ChatDetailView.swift          # 聊天详情
    ├── ImageMessageView.swift        # 图片消息
    ├── MessageCell.swift             # 消息单元格
    ├── VoiceMessageIntegrationExample.swift # 语音集成
    ├── VoiceMessageView.swift        # 语音消息
    └── VoiceRecordingButton.swift    # 录音按钮
```

### 首页模块 (`Features/Home/`)
```
Features/Home/
└── Views/
    ├── ChatListView.swift     # 聊天列表
    ├── HomeView.swift         # 首页视图
    ├── MainTabView.swift      # 主标签页
    ├── ProfileView.swift     # 个人资料
    └── StudyListView.swift   # 学习列表
```

### 地图模块 (`Features/Map/`)
```
Features/Map/
├── ViewModels/
│   └── MapViewModel.swift
└── Views/
    ├── LocationDetailView.swift
    └── MapView.swift
```

### 配对模块 (`Features/Pairing/`)
```
Features/Pairing/
└── Views/
    ├── PairingView.swift      # 配对视图
    └── QRScannerView.swift    # QR 扫描
```

### 个人资料模块 (`Features/Profile/`)
```
Features/Profile/
├── ViewModels/
│   ├── PointsHistoryViewModel.swift
│   ├── PrivacySettingsViewModel.swift
│   ├── ProfileViewModel.swift
│   └── SettingsViewModel.swift
└── Views/
    ├── AboutScreen.swift
    ├── Components/
    │   └── PointsTransactionRow.swift
    ├── PointsHistoryScreen.swift
    ├── PrivacySettingsScreen.swift
    ├── ProfileInfoCard.swift
    ├── ProfileScreen.swift
    ├── SettingsScreen.swift
    └── StatsSection.swift
```

### 相机模块 (`Features/Snapshot/`)
```
Features/Snapshot/
├── ViewModels/
│   ├── CameraViewModel.swift
│   └── SnapshotListViewModel.swift
└── Views/
    ├── CameraView.swift
    └── SnapshotListView.swift
```

### 商店模块 (`Features/Store/`)
```
Features/Store/
└── ViewModels/
    ├── PaymentViewModel.swift
    ├── ProductViewModel.swift
    └── StoreViewModel.swift
```

---

## 🛠️ 技术栈

### 框架
- **SwiftUI** - UI 框架
- **Combine** - 响应式编程
- **Protocol-Oriented** - 面向协议

### 依赖注入
```swift
// Protocol 定义
protocol AuthServiceProtocol {
    func signIn(email: String, password: String) async throws -> User
    func signOut() async throws
}

// 实现
class AuthService: AuthServiceProtocol {
    // Implementation
}

// 使用
@Environment(\.authService) var authService
```

### 状态管理
```swift
// @Observable (iOS 17+)
@Observable
class ProfileViewModel {
    var user: User?
    var isLoading = false

    func fetchUser() async { ... }
}

// @StateObject (iOS 14+)
class ProfileViewModel: ObservableObject {
    @Published var user: User?
    @Published var isLoading = false
}
```

---

## 🔐 安全特性

### 安全验证
```swift
// 越狱检测
JailbreakDetector.isJailbroken()

// SSL 证书锁定
SSLPinningManager.validateCertificate()

// 密钥链安全
KeychainSecurityValidator.validateSecurity()
```

### 数据加密
```swift
// 敏感数据存储
KeychainManager.shared.save(key: "token", value: token)
KeychainManager.shared.get(key: "token")

// UserDefaults 安全
UserDefaultsManager.secureSet(value, forKey: key)
```

---

## 📡 网络通信

### API 客户端
```swift
class APIClient {
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T

    func upload(data: Data, to url: URL) async throws -> String

    func download(from url: URL) async throws -> Data
}
```

### WebSocket
```swift
class WebSocketManager {
    func connect(to url: URL)
    func send(_ message: WebSocketMessage)
    func onMessage(_ handler: @escaping (Message) -> Void)
    func disconnect()
}
```

---

## 🔔 通知系统

### 本地通知
```swift
LocalNotificationService.shared.schedule(
    title: "学习提醒",
    body: "该开始学习了！",
    trigger: .timeInterval(60 * 30) // 30分钟后
)
```

### 推送通知
```swift
PushNotificationService.shared.requestAuthorization()
PushNotificationService.shared.registerForRemoteNotifications()
```

---

## 📊 分析监控

### 性能监控
```swift
PerformanceMonitoringService.shared.track(
    metric: .appLaunch,
    duration: startTime.distance(to: Date())
)
```

### 错误追踪
```Swift
ErrorTrackingService.shared.capture(error: error)
```

---

## 🧪 测试

### 单元测试
```swift
@testable import TRIX3DCompanion

class AuthServiceTests {
    @Test
    func testSignInSuccess() async throws {
        // Test code
    }
}
```

---

## 📦 依赖管理

### Swift Package Manager
```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/SnapKit/SnapKit.git", from: "5.6.0"),
    .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0")
]
```

---

## 🎨 主题系统

```swift
// Shared/Theme/
struct AppTheme {
    static let primary = Color("Primary")
    static let secondary = Color("Secondary")
    static let background = Color("Background")
    static let text = Color("Text")
}
```

---

## 🚀 构建配置

### Debug vs Release
- Debug: 本地服务器, 详细日志
- Release: 生产服务器, 崩溃报告

### 代码签名
- 自动签名
- App Store Connect

---

**最后更新**: 2026-03-01
**版本**: 2.0

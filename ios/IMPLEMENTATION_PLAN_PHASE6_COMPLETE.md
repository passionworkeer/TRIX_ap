# TRIX 3D Companion iOS Phase 6 完整实施计划

> 📅 计划日期: 2026-02-26
> 🎯 项目: TRIX 3D Companion iOS 原生应用
> 🌿 分支: `feat/ios-phase6-all`
> 👤 负责人: Claude Code Agent Cluster

---

## 📋 需求确认（已确认）

| 维度 | 确认结果 |
|------|----------|
| **Phase 6 优先级** | 1. 测试 2. 语音 3. 缓存 4. 通知 5. 个人资料 6. 登录 7. 支付 8. 安全 |
| **测试策略** | 覆盖率 40%→80%，严格测试驱动开发 |
| **目标平台** | iPhone (iOS 16+) |
| **发布时间** | 质量优先 |

---

## 🎯 阶段总览

| 阶段 | 内容 | 预估工作量 | 依赖 | 状态 |
|------|------|-----------|------|------|
| **Phase 6A** | 测试覆盖率提升 | 3-4 天 | 无 | ⏳ |
| **Phase 6B** | 语音功能 | 3-4 天 | Phase 6A | ⏳ |
| **Phase 6C** | 数据持久化 | 3-4 天 | Phase 6B | ⏳ |
| **Phase 6D** | 通知系统 | 3-4 天 | Phase 6C | ⏳ |
| **Phase 6E** | 个人资料页面 | 2-3 天 | Phase 6D | ⏳ |
| **Phase 6F** | 安全审计+性能优化 | 2-3 天 | 全部完成 | ⏳ |
| **Phase 6G** | 登录系统扩展 | 3-4 天 | Phase 6A | ⏳ |
| **Phase 6H** | 支付系统 | 3-4 天 | Phase 6G | ⏳ |

**总预估工作量**: 约 22-30 天

---

# 📊 Phase 6A: 测试覆盖率提升

## 目标

将单元测试覆盖率从 **40%** 提升到 **80%**

## 当前测试状态

```
TRIX3DCompanionTests/
├── LocationServiceTests.swift      ✅ 已有
├── CameraServiceTests.swift         ✅ 已有
├── MapViewModelTests.swift          ✅ 已有
├── Mock Classes                     ✅ 已有
└── (其他测试)                        ❌ 缺失
```

## 缺失的测试文件

### P0 - 必须实现

| 文件 | 覆盖模块 | 测试用例数 |
|------|---------|-----------|
| `AuthInterceptorTests.swift` | Token 自动刷新 | 10 |
| `APIClientTests.swift` | API 客户端 | 8 |
| `ImageUploadServiceTests.swift` | 图片上传服务 | 12 |
| `KeychainManagerTests.swift` | 密钥链管理 | 8 |
| `WebSocketManagerTests.swift` | WebSocket 管理 | 8 |
| `DatabaseManagerTests.swift` | 数据库管理 | 8 |

### P1 - 应该实现

| 文件 | 覆盖模块 | 测试用例数 |
|------|---------|-----------|
| `UserDefaultsManagerTests.swift` | 用户偏好 | 5 |
| `AuthServiceTests.swift` | 认证服务 | 8 |
| `StudyServiceTests.swift` | 学习服务 | 6 |

## 测试覆盖率目标

| 模块 | 当前 | 目标 |
|------|------|------|
| Core/Services | 30% | 90% |
| Core/Network | 40% | 85% |
| Core/Storage | 50% | 85% |
| Features | 40% | 60% |
| **总体** | **40%** | **80%** |

## 实施计划

### Day 1: Auth + Network 测试
- [ ] 创建 `AuthInterceptorTests.swift`
- [ ] 创建 `APIClientTests.swift`
- [ ] 实现 Token 刷新测试
- [ ] 实现网络错误处理测试

### Day 2: Storage 测试
- [ ] 创建 `KeychainManagerTests.swift`
- [ ] 创建 `DatabaseManagerTests.swift`
- [ ] 实现存储操作测试

### Day 3: Service 测试
- [ ] 创建 `ImageUploadServiceTests.swift`
- [ ] 创建 `WebSocketManagerTests.swift`
- [ ] 创建 `UserDefaultsManagerTests.swift`

### Day 4: 验证
- [ ] 运行 Xcode Code Coverage
- [ ] 补齐未覆盖的边界情况
- [ ] 确认覆盖率 ≥ 80%

## 质量门禁

- [ ] 测试覆盖率 ≥ 80%
- [ ] 所有新增测试通过
- [ ] 无测试警告
- [ ] Mock 类设计合理

---

# 🔊 Phase 6B: 语音功能

## 目标

实现文字转语音 (TTS) 和语音播放功能

## 架构设计

```
Core/Services/
├── TTSService.swift              # 文字转语音（AVSpeechSynthesizer）
├── TTSServiceProtocol.swift      # 协议定义
├── VoicePlaybackService.swift    # 语音播放（AVAudioPlayer）
├── VoicePlaybackServiceProtocol.swift
└── AudioSessionManager.swift     # 音频会话管理
```

## 接口设计

### TTSServiceProtocol

```swift
protocol TTSServiceProtocol {
    var isSpeaking: Bool { get }
    var currentVoice: AVSpeechSynthesisVoice? { get }

    func speak(_ text: String, language: String?) async throws
    func stop() async
    func pause() async
    func resume() async
    func setRate(_ rate: Float) async  // 0.0 - 1.0
    func setPitch(_ pitch: Float) async  // 0.5 - 2.0
    func getAvailableVoices(for language: String) -> [AVSpeechSynthesisVoice]
}
```

### VoicePlaybackServiceProtocol

```swift
protocol VoicePlaybackServiceProtocol {
    var isPlaying: Bool { get }
    var currentTime: TimeInterval { get }
    var duration: TimeInterval { get }
    var playbackRate: Float { get }

    func play(url: URL) async throws
    func play(data: Data, filename: String) async throws
    func pause() async
    func stop() async
    func seek(to time: TimeInterval) async
    func setPlaybackRate(_ rate: Float) async

    // Combine publishers
    var playbackStatePublisher: AnyPublisher<PlaybackState, Never> { get }
    var progressPublisher: AnyPublisher<PlaybackProgress, Never> { get }
}

enum PlaybackState {
    case idle
    case loading
    case playing
    case paused
    case finished
    case error(Error)
}

struct PlaybackProgress {
    let currentTime: TimeInterval
    let duration: TimeInterval
    let progress: Double  // 0.0 - 1.0
}
```

## 需要新增的文件

```
TRIX3DCompanion/
├── Core/
│   └── Services/
│       ├── TTSService.swift
│       ├── TTSServiceProtocol.swift
│       ├── VoicePlaybackService.swift
│       ├── VoicePlaybackServiceProtocol.swift
│       └── AudioSessionManager.swift
│
├── Features/
│   ├── Voice/
│   │   ├── Views/
│   │   │   ├── VoiceMessagePlayerView.swift
│   │   │   └── TTSControlView.swift
│   │   └── ViewModels/
│   │       ├── VoicePlayerViewModel.swift
│   │       └── TTSViewModel.swift
```

## 集成点

- 聊天模块：语音消息播放
- 学习模块：TTS 朗读提醒
- 设置模块：TTS 开关、语速、语言

## 验收标准

- [ ] TTS 可以朗读指定文本
- [ ] TTS 语速可调节（0.0-1.0）
- [ ] TTS 音调可调节（0.5-2.0）
- [ ] 语音消息可以播放/暂停/停止
- [ ] 进度条可拖动
- [ ] 支持后台播放
- [ ] 耳机插入/拔出正确处理

---

# 💾 Phase 6C: 数据持久化

## 目标

实现离线支持、缓存管理和数据备份

## 架构设计

```
Core/Services/
├── OfflineCacheService.swift       # 离线数据缓存
├── OfflineCacheServiceProtocol.swift
├── DataSyncService.swift           # 数据同步服务
├── DataSyncServiceProtocol.swift
├── NetworkMonitor.swift            # 网络状态监听
├── NetworkMonitorProtocol.swift
└── DataExportService.swift         # 数据导出
└── DataExportServiceProtocol.swift
```

## 缓存策略

| 数据类型 | 缓存时间 | 最大大小 |
|---------|---------|---------|
| 聊天消息 | 7 天 | 100MB |
| 学习记录 | 30 天 | 50MB |
| 用户资料 | 24 小时 | 1MB |
| 图片缓存 | 7 天 | 200MB |
| API 响应 | 5 分钟 | 20MB |

## 接口设计

### OfflineCacheProtocol

```swift
protocol OfflineCacheProtocol {
    // Chat
    func cacheMessages(_ messages: [Message], for roomId: String) async throws
    func getCachedMessages(for roomId: String, limit: Int) async throws -> [Message]
    func clearMessageCache(for roomId: String) async throws

    // Study
    func cacheStudyRecords(_ records: [StudyRecord]) async throws
    func getCachedStudyRecords() async throws -> [StudyRecord]

    // User
    func cacheUserProfile(_ profile: UserProfile) async throws
    func getCachedUserProfile() async throws -> UserProfile?

    // Management
    func clearAllCache() async throws
    func getCacheSize() async -> Int64
    func getCacheSizeBreakdown() async -> [CacheCategory: Int64]
}
```

### DataSyncServiceProtocol

```swift
protocol DataSyncServiceProtocol {
    var isSyncing: Bool { get }
    var lastSyncTime: Date? { get }
    var syncStatusPublisher: AnyPublisher<SyncStatus, Never> { get }

    func syncAll() async throws
    func syncMessages() async throws
    func syncStudyRecords() async throws
    func syncUserProfile() async throws
    func setSyncPolicy(_ policy: SyncPolicy) async
}

enum SyncPolicy {
    case automatic      // 自动同步
    case wifiOnly       // 仅 WiFi
    case manual         // 手动
}

enum SyncStatus {
    case idle
    case syncing
    case completed
    case failed(Error)
    case offline
}
```

### NetworkMonitorProtocol

```swift
protocol NetworkMonitorProtocol {
    var isConnected: Bool { get }
    var connectionType: ConnectionType { get }
    var isExpensive: Bool { get }
    var connectionPublisher: AnyPublisher<NetworkStatus, Never> { get }
}

enum ConnectionType {
    case wifi
    case cellular
    case ethernet
    case none
}
```

### DataExportServiceProtocol

```swift
protocol DataExportServiceProtocol {
    func exportAllData() async throws -> URL
    func exportStudyRecords() async throws -> URL
    func exportChatHistory() async throws -> URL
    func exportUserProfile() async throws -> URL

    func getExportProgress() -> AnyPublisher<Double, Never>
}
```

## 数据库表结构扩展

```sql
-- 离线消息缓存表
CREATE TABLE cached_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT,
    message_type TEXT NOT NULL,
    media_url TEXT,
    created_at TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    cached_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
);

CREATE INDEX idx_cached_messages_room ON cached_messages(room_id);
CREATE INDEX idx_cached_messages_cached ON cached_messages(cached_at);

-- 同步记录表
CREATE TABLE sync_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    local_version INTEGER NOT NULL,
    server_version INTEGER,
    sync_status TEXT NOT NULL,
    last_synced_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_sync_records_status ON sync_records(sync_status);
```

## 验收标准

- [ ] 离线可以查看已缓存的消息
- [ ] 网络恢复后自动同步
- [ ] 显示同步状态
- [ ] 可以导出用户数据为 JSON
- [ ] 缓存大小可查看和管理
- [ ] 缓存过期自动清理

---

# 🔔 Phase 6D: 通知系统

## 目标

实现本地通知、学习提醒、消息推送

## 架构设计

```
Core/Services/
├── LocalNotificationService.swift    # 本地通知
├── LocalNotificationServiceProtocol.swift
├── PushNotificationService.swift     # 推送通知
├── PushNotificationServiceProtocol.swift
└── NotificationManager.swift         # 统一管理
└── NotificationManagerProtocol.swift
```

## 接口设计

### LocalNotificationServiceProtocol

```swift
protocol LocalNotificationServiceProtocol {
    var isAuthorized: Bool { get }
    var authorizationStatus: UNAuthorizationStatus { get }

    func requestAuthorization() async throws -> Bool
    func scheduleStudyReminder(at time: Date, title: String, body: String) async throws -> String
    func scheduleDailyReminder(hour: Int, minute: Int, title: String, body: String) async throws -> String
    func cancelNotification(id: String) async
    func cancelAllNotifications() async
    func getPendingNotifications() async -> [UNNotificationRequest]
    func setNotificationCategories(_ categories: [UNNotificationCategory]) async
}
```

### PushNotificationServiceProtocol

```swift
protocol PushNotificationServiceProtocol {
    var deviceToken: Data? { get }
    var deviceTokenString: String? { get }

    func registerForRemoteNotifications() async
    func handleDeviceToken(_ token: Data) async throws
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) async -> UNNotificationPresentationOptions
    func updateServerWithToken() async throws
}
```

### NotificationManagerProtocol

```swift
protocol NotificationManagerProtocol {
    var preferences: NotificationPreferences { get }

    func enableNotification(type: NotificationType, enabled: Bool) async
    func setQuietHours(start: Int, end: Int) async
    func setQuietHoursEnabled(_ enabled: Bool) async
    func shouldShowNotification(type: NotificationType) -> Bool

    var preferencesPublisher: AnyPublisher<NotificationPreferences, Never> { get }
}

struct NotificationPreferences: Codable {
    var studyRemindersEnabled: Bool = true
    var dailyGoalReminderEnabled: Bool = true
    var chatMessagesEnabled: Bool = true
    var friendRequestsEnabled: Bool = true
    var quietHoursEnabled: Bool = false
    var quietHoursStart: Int = 22
    var quietHoursEnd: Int = 8
}

enum NotificationType: String, CaseIterable {
    case studyReminder = "study_reminder"
    case dailyGoal = "daily_goal"
    case chatMessage = "chat_message"
    case friendRequest = "friend_request"
    case system = "system"
}
```

## 通知场景

### 学习提醒
- 番茄钟开始提醒
- 专注时间结束提醒
- 休息时间结束提醒
- 每日学习目标提醒

### 消息通知
- 新聊天消息
- 新好友请求
- 配对请求

## 验收标准

- [ ] 可以请求通知权限
- [ ] 可以设置学习提醒时间
- [ ] 番茄钟切换时发送通知
- [ ] 可以按类型启用/禁用通知
- [ ] 支持免打扰模式

---

# 👤 Phase 6E: 个人资料页面

## 目标

实现完整的用户设置和个人资料管理

## 架构设计

```
Features/
├── Profile/
│   ├── Views/
│   │   ├── ProfileView.swift
│   │   ├── SettingsView.swift
│   │   ├── ProfileInfoCard.swift
│   │   ├── StatsSection.swift
│   │   ├── PointsHistoryView.swift
│   │   ├── PointsTransactionRow.swift
│   │   ├── PrivacySettingsView.swift
│   │   └── AboutView.swift
│   └── ViewModels/
│       ├── ProfileViewModel.swift
│       ├── SettingsViewModel.swift
│       ├── PointsHistoryViewModel.swift
│       └── PrivacySettingsViewModel.swift
```

## 接口设计

### ProfileViewModel

```swift
@MainActor
class ProfileViewModel: ObservableObject {
    @Published var profile: User?
    @Published var isLoading = false
    @Published var error: Error?

    var username: String { profile?.username ?? "User" }
    var email: String { profile?.email ?? "" }
    var points: Int { profile?.points ?? 0 }
    var level: Int { points / 1000 + 1 }
    var daysActive: Int { profile?.stats?.daysActive ?? 0 }
    var totalStudyTime: TimeInterval { profile?.stats?.totalStudyTime ?? 0 }

    func loadProfile() async
    func refresh() async
}
```

### SettingsViewModel

```swift
@MainActor
class SettingsViewModel: ObservableObject {
    @Published var selectedTheme: AppTheme = .system
    @Published var selectedLanguage: String = "zh"
    @Published var isLoading = false

    func clearCache() async
    func exportData() async
    func logout() async
}
```

### PrivacySettingsViewModel

```swift
@MainActor
class PrivacySettingsViewModel: ObservableObject {
    @Published var shareLocation = false
    @Published var showOnMap = false
    @Published var showOnlineStatus = true
    @Published var showLastSeen = true
    @Published var sendReadReceipts = true
    @Published var showDeleteConfirmation = false
    @Published var deleteAccountRequested = false

    // 7 天冷静期
    var deleteRequestDate: Date?
    var canDeleteImmediately: Bool { deleteRequestDate == nil }

    func requestDeleteAccount()
    func cancelDeleteRequest()
    func confirmDelete()
}
```

## 验收标准

- [ ] 显示完整的用户信息
- [ ] 可以切换主题（浅/深/系统）
- [ ] 可以切换语言（中/英/日）
- [ ] 可以管理通知设置
- [ ] 可以管理隐私设置
- [ ] 可以查看积分历史
- [ ] 可以清理缓存
- [ ] 可以导出数据
- [ ] 可以登出
- [ ] 可以删除账户（7 天冷静期）

---

# 🔐 Phase 6F: 安全审计 + 性能优化

## 安全审计

### 需要修复的问题

| 问题 | 优先级 | 预估工作量 |
|------|--------|-----------|
| 日志输出脱敏 | P1 | 2 小时 |
| Keychain 访问控制 | P1 | 2 小时 |
| API 参数验证 | P1 | 4 小时 |
| 位置数据加密 | P2 | 4 小时 |
| 用户数据删除 | P2 | 3 小时 |
| 并发上传优化 | P1 | 3 小时 |

### 安全检查清单

- [ ] 位置信息不输出到日志
- [ ] Keychain 使用 `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- [ ] API 参数格式验证
- [ ] 实现账户删除 API（7 天冷静期）
- [ ] 图片上传使用并发

## 性能优化

### 需要优化的模块

| 模块 | 问题 | 优化方案 |
|------|------|---------|
| ImageUploadService | 顺序上传 | TaskGroup 并发 |
| MapView | 频繁刷新 | 坐标聚合 |
| ChatDetailView | 大量消息 | 分页加载 |
| 数据库 | 查询慢 | 添加索引 |

### 性能指标目标

| 指标 | 目标值 |
|------|--------|
| 启动时间 | < 2 秒 |
| 内存占用 | < 150MB |
| 电池消耗 | < 5%/小时 |
| 滑动帧率 | 60 fps |

---

# 🔑 Phase 6G: 登录系统扩展

## 目标

实现微信登录、Apple Sign In、邮箱登录完善

## 架构设计

```
Core/
├── Services/
│   ├── AppleSignInService.swift      # Apple Sign In
│   ├── AppleSignInServiceProtocol.swift
│   ├── WeChatSignInService.swift     # 微信登录
│   ├── WeChatSignInServiceProtocol.swift
│   └── OAuthManager.swift            # 统一管理
└── Network/
    └── AuthService.swift             # 扩展第三方登录
```

## 接口设计

### AppleSignInServiceProtocol

```swift
protocol AppleSignInServiceProtocol {
    var isAuthorized: Bool { get }

    func signIn() async throws -> AppleSignInResult
    func getCredentialState() async -> AppleIDCredentialState
    func signOut()
}

struct AppleSignInResult {
    let userId: String
    let email: String?
    let fullName: PersonNameComponents?
    let identityToken: Data?
    let authorizationCode: Data
}

enum AppleIDCredentialState {
    case authorized
    case revoked
    case notFound
    case transiant
}
```

### WeChatSignInServiceProtocol

```swift
protocol WeChatSignInServiceProtocol {
    var isWeChatInstalled: Bool { get }
    var isAuthorized: Bool { get }

    func signIn() async throws -> WeChatSignInResult
    func handleOpenURL(_ url: URL) -> Bool
}

struct WeChatSignInResult {
    let openId: String
    let unionId: String?
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}
```

### OAuthManager

```swift
@MainActor
class OAuthManager: ObservableObject {
    @Published var currentProvider: OAuthProvider?
    @Published var isLoading = false
    @Published var error: Error?

    // 占位符 - 用户后续提供
    static var weChatAppId: String = "YOUR_WECHAT_APP_ID"
    static var weChatAppSecret: String = "YOUR_WECHAT_APP_SECRET"

    func signIn(with provider: OAuthProvider) async throws -> AuthResult<User>
    func handleCallback(_ result: OAuthCallbackResult) async throws
}

enum OAuthProvider: String, CaseIterable {
    case apple
    case wechat
    case email
}

struct OAuthCallbackResult {
    let provider: OAuthProvider
    let code: String?
    let error: Error?
}
```

## 需要新增的 API 端点

```swift
// AuthEndpoints.swift 扩展
case authAppleSignIn       // Apple 登录
case authWeChatSignIn      // 微信登录
case authUnlinkProvider    // 解除第三方绑定
case authDeleteAccount     // 删除账户（7天冷静期）
case authCancelDelete     // 撤销删除
```

## 集成点

- LoginView: 添加 Apple 登录按钮
- LoginView: 添加微信登录按钮
- SettingsView: 第三方账号绑定管理
- AuthService: 统一处理所有登录方式

## 验收标准

- [ ] Apple Sign In 可以正常登录
- [ ] 微信登录可以正常登录（Env 后续提供）
- [ ] 邮箱登录完善
- [ ] 可以切换登录方式
- [ ] 可以在设置中解绑第三方账号

---

# 💰 Phase 6H: 支付系统

## 目标

实现苹果应用内支付（IAP）和积分商城

## 架构设计

```
Core/
├── Services/
│   ├── StoreKitService.swift         # StoreKit 2 IAP
│   ├── StoreKitServiceProtocol.swift
│   ├── PaymentService.swift         # 支付统一管理
│   ├── PaymentServiceProtocol.swift
│   ├── PointsService.swift          # 积分服务
│   └── PointsServiceProtocol.swift
│
├── StoreKit/
│   └── StoreKitManager.swift         # StoreKit 2 Manager
│
Features/
├── Store/
│   ├── Views/
│   │   ├── StoreView.swift           # 积分商城首页
│   │   ├── ProductDetailView.swift   # 商品详情
│   │   ├── PointsPurchaseView.swift  # 积分购买
│   │   ├── SubscriptionView.swift     # 会员订阅
│   │   └── PaymentResultView.swift   # 支付结果
│   └── ViewModels/
│       ├── StoreViewModel.swift
│       ├── ProductViewModel.swift
│       └── PaymentViewModel.swift
```

## 接口设计

### StoreKitServiceProtocol

```swift
protocol StoreKitServiceProtocol {
    var products: [StoreProduct] { get }
    var purchasedProductIds: Set<String> { get }
    var isLoading: Bool { get }

    func loadProducts() async throws
    func purchase(productId: String) async throws -> PurchaseResult
    func restorePurchases() async throws
    func checkSubscriptionStatus() async -> SubscriptionStatus
}

struct StoreProduct: Identifiable {
    let id: String
    let name: String
    let description: String
    let price: Decimal
    let priceString: String
    let productType: ProductType
}

enum ProductType {
    case subscription(String)  // 会员
    case consumable             // 消耗品（积分）
    case nonConsumable         // 非消耗品
}

enum SubscriptionStatus {
    case active(expiresAt: Date)
    case expired
    case neverSubscribed
}

struct PurchaseResult {
    let transactionId: String
    let productId: String
    let purchaseDate: Date
}
```

### PaymentServiceProtocol

```swift
protocol PaymentServiceProtocol {
    var currentPaymentMethod: PaymentMethod? { get }

    // 积分购买
    func purchasePoints(package: PointsPackage) async throws -> PaymentResult
    func validateReceipt(_ receipt: Data) async throws -> Bool

    // 支付方式
    func availablePaymentMethods() -> [PaymentMethod]
    func setDefaultPaymentMethod(_ method: PaymentMethod)
}

enum PaymentMethod {
    case applePay
    case wechatPay
    case alipay
}

struct PointsPackage: Identifiable {
    let id: String
    let name: String
    let points: Int
    let price: Decimal
    let bonusPoints: Int  // 赠送积分
    let isPopular: Bool
}

struct PaymentResult {
    let orderId: String
    let status: PaymentStatus
    let pointsAdded: Int
}

enum PaymentStatus {
    case success
    case failed(Error)
    case cancelled
    case pending
}
```

### PointsServiceProtocol

```swift
protocol PointsServiceProtocol {
    var currentPoints: Int { get }
    var pointsPublisher: AnyPublisher<Int, Never> { get }

    func fetchPoints() async throws -> Int
    func fetchPointsHistory(page: Int) async throws -> [PointsTransaction]
    func addPoints(_ amount: Int, reason: String) async throws
    func deductPoints(_ amount: Int, reason: String) async throws
}

struct PointsTransaction: Identifiable {
    let id: String
    let amount: Int
    let type: TransactionType
    let reason: String
    let createdAt: Date
    let relatedId: String?  // 关联ID（如订单ID）
}

enum TransactionType {
    case earned   // 获得
    case spent    // 消费
    case bonus    // 赠送
    case refunded // 退款
}
```

## 会员权益

| 功能 | 免费用户 | 会员用户 |
|------|---------|---------|
| 每日学习提醒 | ✅ | ✅ |
| 语音提醒 | ❌ | ✅ |
| 消息云同步 | 7天 | 无限 |
| 导出数据 | ❌ | ✅ |
| 优先客服 | ❌ | ✅ |
| 会员专属表情 | ❌ | ✅ |

## 积分商城商品

| 商品 | 价格 | 积分 |
|------|------|------|
| 100 积分 | ¥6 | 100 |
| 300 积分 | ¥18 | 300+30 |
| 500 积分 | ¥28 | 500+80 |
| 1000 积分 | ¥50 | 1000+200 |

## 验收标准

- [ ] 可以购买会员订阅（StoreKit）
- [ ] 可以购买积分套餐
- [ ] 支付成功后积分正确到账
- [ ] 可以在设置中查看订阅状态
- [ ] 可以恢复购买
- [ ] 支付安全（Receipt 验证）

---

# 📋 完整实施时间线

```
Week 1-2:   Phase 6A - 测试覆盖率提升 (80%)
Week 3:     Phase 6B - 语音功能
Week 4:     Phase 6C - 数据持久化
Week 5:     Phase 6D - 通知系统
Week 6:     Phase 6E - 个人资料页面
Week 7:     Phase 6F - 安全审计 + 性能优化
Week 8:     Phase 6G - 登录系统扩展
Week 9:     Phase 6H - 支付系统
Week 10:    最终测试 + App Store 准备
```

---

# 🔧 技术占位符

以下内容需要用户后续提供：

| 项目 | 占位符 | 说明 |
|------|--------|------|
| 微信 App ID | `YOUR_WECHAT_APP_ID` | 微信开放平台申请 |
| 微信 App Secret | `YOUR_WECHAT_APP_SECRET` | 微信开放平台申请 |
| APNs 证书 | - | Apple Developer 配置 |
| Bundle ID | - | App Store Connect 配置 |
| App Icon | - | 1024x1024 PNG |

---

# ✅ 验收总表

## Phase 6A: 测试覆盖率
- [ ] 测试覆盖率 ≥ 80%
- [ ] 所有测试通过
- [ ] 无测试警告

## Phase 6B: 语音功能
- [ ] TTS 朗读功能
- [ ] 语音消息播放
- [ ] 后台播放支持

## Phase 6C: 数据持久化
- [ ] 离线缓存
- [ ] 自动同步
- [ ] 数据导出

## Phase 6D: 通知系统
- [ ] 本地通知
- [ ] 推送通知
- [ ] 免打扰模式

## Phase 6E: 个人资料
- [ ] 用户信息展示
- [ ] 设置管理
- [ ] 隐私设置

## Phase 6F: 安全+性能
- [ ] 安全问题修复
- [ ] 性能达标

## Phase 6G: 登录扩展
- [ ] Apple Sign In
- [ ] 微信登录
- [ ] 邮箱登录

## Phase 6H: 支付系统
- [ ] IAP 订阅
- [ ] 积分购买
- [ ] 支付安全

---

**文档版本**: 1.0
**生成时间**: 2026-02-26
**维护者**: Claude Code Agent Cluster

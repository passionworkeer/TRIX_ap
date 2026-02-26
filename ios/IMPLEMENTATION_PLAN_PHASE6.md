# iOS 后续开发详细实施计划

> 📅 计划日期: 2026-02-26
> 🎯 项目: TRIX 3D Companion iOS 原生应用
> 🌿 当前分支: `feat/ios-phase5-map-camera`

---

## 📋 需求确认

| 维度 | 确认结果 |
|------|----------|
| **Phase 6 优先级** | 1. 语音功能 2. 数据持久化 3. 通知系统 4. 个人资料页面 |
| **测试策略** | 先完成测试（覆盖率提升到 80%）再开发新功能 |
| **目标平台** | 仅 iPhone (iOS 16+) |
| **发布时间** | 时间不限（质量优先） |

---

## 🎯 阶段总览

| 阶段 | 内容 | 预估工作量 | 依赖 |
|------|------|-----------|------|
| **Phase 6A** | 测试覆盖率提升 | 3-4 天 | 无 |
| **Phase 6B** | 语音功能 | 3-4 天 | Phase 6A |
| **Phase 6C** | 数据持久化 | 3-4 天 | Phase 6B |
| **Phase 6D** | 通知系统 | 3-4 天 | Phase 6C |
| **Phase 6E** | 个人资料页面 | 2-3 天 | Phase 6D |
| **Phase 6F** | 安全审计 + 性能优化 | 2-3 天 | 全部完成 |

**总预估工作量**: 约 16-22 天

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
```

## 缺失的测试

### 需要新增的测试文件

| 文件 | 覆盖模块 | 优先级 |
|------|---------|--------|
| `AuthInterceptorTests.swift` | Token 自动刷新 | P0 |
| `ImageUploadServiceTests.swift` | 图片上传服务 | P0 |
| `APIClientTests.swift` | API 客户端 | P0 |
| `KeychainManagerTests.swift` | 密钥链管理 | P1 |
| `WebSocketManagerTests.swift` | WebSocket 管理 | P1 |
| `DatabaseManagerTests.swift` | 数据库管理 | P1 |
| `UserDefaultsManagerTests.swift` | 用户偏好 | P2 |
| `AuthServiceTests.swift` | 认证服务 | P2 |
| `StudyServiceTests.swift` | 学习服务 | P2 |

### 测试用例清单

#### AuthInterceptorTests (P0)

```swift
// 需要覆盖的场景
class AuthInterceptorTests {
    // adapt() 方法测试
    func testAdaptAddsToken()              // 有 Token 时添加 Authorization
    func testAdaptSkipsAuthEndpoints()     // 跳过认证端点
    func testAdaptWithoutToken()            // 无 Token 时正常通过

    // retry() 方法测试
    func testRetryOn401WithRefreshToken()   // 401 时有刷新 Token
    func testRetryOn401WithoutRefreshToken() // 401 时无刷新 Token
    func testRetryExceedsLimit()            // 超过重试次数
    func testRetryNon401Error()             // 非 401 错误不重试
    func testRefreshSuccessQueuesRequests() // 刷新成功重试队列请求
    func testRefreshFailureClearsTokens()   // 刷新失败清除 Token

    // 并发测试
    func testConcurrentRefresh()            // 并发刷新只执行一次
}
```

#### ImageUploadServiceTests (P0)

```swift
class ImageUploadServiceTests {
    // 图片压缩测试
    func testCompressJPEG()                 // JPEG 压缩
    func testCompressPNG()                  // PNG 压缩
    func testResizeImage()                  // 图片缩放
    func testCropImage()                    // 图片裁剪
    func testCompressionQuality()           // 压缩质量

    // 上传测试
    func testUploadSingleImage()             // 单图上传
    func testUploadMultipleImages()         // 多图上传
    func testUploadWithMetadata()            // 带元数据上传
    func testUploadProgress()                // 上传进度
    func testUploadFailure()                // 上传失败处理

    // 验证测试
    func testValidateImageSize()            // 图片大小验证
    func testValidateImageFormat()           // 图片格式验证
}
```

#### APIClientTests (P0)

```swift
class APIClientTests {
    // 请求测试
    func testGetRequest()                   // GET 请求
    func testPostRequest()                  // POST 请求
    func testPutRequest()                   // PUT 请求
    func testDeleteRequest()                // DELETE 请求

    // 错误处理测试
    func testNetworkError()                 // 网络错误
    func testServerError()                  // 服务器错误
    func testDecodingError()                // 解码错误
    func testTimeoutError()                 // 超时错误

    // Token 测试
    func testAuthHeaderAdded()              // 自动添加 Token
    func testTokenRefreshOn401()            // 401 时 Token 刷新
}
```

## 测试代码模板

### AuthInterceptorTests.swift 模板

```swift
import XCTest
import Alamofire
@testable import TRIX3DCompanion

final class AuthInterceptorTests: XCTestCase {

    var sut: AuthInterceptor!
    var mockKeychainManager: MockKeychainManager!

    override func setUp() {
        super.setUp()
        mockKeychainManager = MockKeychainManager()
        sut = AuthInterceptor(keychainManager: mockKeychainManager, maxRetryCount: 1)
    }

    override func tearDown() {
        sut = nil
        mockKeychainManager = nil
        super.tearDown()
    }

    // MARK: - adapt() Tests

    func testAdaptAddsToken() async throws {
        // Given
        mockKeychainManager.accessToken = "test_token"
        let request = URLRequest(url: URL(string: "https://api.test.com/data")!)

        // When
        let result = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Result<URLRequest, Error>, Never>) in
            sut.adapt(request, for: .default) { result in
                continuation.resume(returning: result)
            }
        }

        // Then
        let adaptedRequest = try result.get()
        XCTAssertEqual(adaptedRequest.value(forHTTPHeaderField: "Authorization"), "Bearer test_token")
    }

    func testAdaptSkipsAuthEndpoints() async throws {
        // Given
        let loginRequest = URLRequest(url: URL(string: "https://api.test.com/auth/login")!)

        // When
        let result = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Result<URLRequest, Error>, Never>) in
            sut.adapt(loginRequest, for: .default) { result in
                continuation.resume(returning: result)
            }
        }

        // Then
        let adaptedRequest = try result.get()
        XCTAssertNil(adaptedRequest.value(forHTTPHeaderField: "Authorization"))
    }
}

// MARK: - Mock

final class MockKeychainManager: KeychainManagerProtocol {
    var accessToken: String?
    var refreshToken: String?

    func getAccessToken() -> String? { accessToken }
    func saveAccessToken(_ token: String) throws {}
    func deleteAccessToken() throws {}

    func getRefreshToken() -> String? { refreshToken }
    func saveRefreshToken(_ token: String) throws {}
    func deleteRefreshToken() throws {}
}
```

## 执行计划

### Day 1: AuthInterceptor + APIClient 测试
- [ ] 创建 `AuthInterceptorTests.swift`
- [ ] 创建 `MockKeychainManager.swift`
- [ ] 实现 Token 刷新相关测试
- [ ] 创建 `APIClientTests.swift`
- [ ] 实现 API 请求测试

### Day 2: ImageUploadService + KeychainManager 测试
- [ ] 创建 `ImageUploadServiceTests.swift`
- [ ] 实现图片压缩/上传测试
- [ ] 创建 `KeychainManagerTests.swift`
- [ ] 实现密钥链操作测试

### Day 3: 服务层测试
- [ ] 创建 `WebSocketManagerTests.swift`
- [ ] 创建 `DatabaseManagerTests.swift`
- [ ] 创建 `UserDefaultsManagerTests.swift`

### Day 4: 集成测试 + 覆盖率验证
- [ ] 创建基础集成测试
- [ ] 运行 Xcode Code Coverage
- [ ] 补齐未覆盖的边界情况

## 验收标准

- [ ] 测试覆盖率 ≥ 80%
- [ ] 所有新增测试通过
- [ ] Mock 类设计合理
- [ ] 测试命名清晰
- [ ] 包含边界情况和错误处理测试

---

# 🔊 Phase 6B: 语音功能

## 目标

实现文字转语音 (TTS) 和语音播放功能

## Web 对标功能

来自 `src/services/ttsService.ts` 和 `src/services/voicePlaybackService.ts`

## 需要实现的模块

### 1. TTSService (文字转语音)

**功能需求**:
- [ ] 使用 AVSpeechSynthesizer 实现本地 TTS
- [ ] 支持多种语言/声音
- [ ] 语速控制
- [ ] 朗读学习提醒
- [ ] 朗读消息内容（可选）

**接口设计**:

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

final class TTSService: TTSServiceProtocol {
    static let shared = TTSService()
    private let synthesizer = AVSpeechSynthesizer()

    // 实现具体逻辑...
}
```

### 2. VoicePlaybackService (语音播放)

**功能需求**:
- [ ] 使用 AVAudioPlayer 播放语音消息
- [ ] 支持播放/暂停/停止
- [ ] 进度控制（拖动进度条）
- [ ] 倍速播放 (0.5x, 1x, 1.5x, 2x)
- [ ] 后台播放支持

**接口设计**:

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

    // Combine publisher for UI updates
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

### 3. AudioSessionManager (音频会话管理)

**功能需求**:
- [ ] 配置 AVAudioSession
- [ ] 处理中断（电话、闹钟等）
- [ ] 响应路由变化（耳机插入/拔出）
- [ ] 后台播放配置

```swift
final class AudioSessionManager {
    static let shared = AudioSessionManager()

    func configureForPlayback() throws
    func configureForRecording() throws
    func handleInterruption(_ notification: Notification)
    func handleRouteChange(_ notification: Notification)
}
```

## 需要新增的文件

```
TRIX3DCompanion/
├── Core/
│   └── Services/
│       ├── TTSService.swift              # 文字转语音
│       ├── TTSServiceProtocol.swift      # 协议定义
│       ├── VoicePlaybackService.swift    # 语音播放
│       ├── VoicePlaybackServiceProtocol.swift
│       └── AudioSessionManager.swift     # 音频会话管理
│
├── Features/
│   ├── Voice/
│   │   ├── Views/
│   │   │   ├── VoiceMessagePlayerView.swift  # 语音消息播放器
│   │   │   └── TTSControlView.swift           # TTS 控制面板
│   │   └── ViewModels/
│   │       ├── VoicePlayerViewModel.swift
│   │       └── TTSViewModel.swift
```

## 集成点

### 聊天模块集成
- 在 `ChatDetailView` 中集成 `VoiceMessagePlayerView`
- 点击语音消息自动播放

### 学习模块集成
- 学习完成时使用 TTS 朗读鼓励语
- 番茄钟切换时语音提醒

### 设置模块集成
- 添加 TTS 开关
- 添加默认语速设置
- 添加默认语言设置

## 验收标准

- [ ] TTS 可以朗读指定文本
- [ ] TTS 语速可调节
- [ ] 语音消息可以播放/暂停
- [ ] 进度条可拖动
- [ ] 支持后台播放
- [ ] 耳机插入/拔出正确处理

---

# 💾 Phase 6C: 数据持久化

## 目标

实现离线支持、缓存管理和数据备份

## 当前状态

已有基础存储:
- ✅ `UserDefaultsManager` - 用户偏好设置
- ✅ `DatabaseManager` - SQLite 数据库 (GRDB)
- ✅ `KeychainManager` - 密钥链存储

## 需要实现的功能

### 1. 离线数据缓存 (OfflineCache)

**功能需求**:
- [ ] 聊天消息缓存（支持离线查看）
- [ ] 学习记录缓存
- [ ] 用户数据缓存
- [ ] 缓存过期策略
- [ ] 缓存大小管理

**接口设计**:

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

### 2. 数据同步服务 (DataSyncService)

**功能需求**:
- [ ] 检测网络状态
- [ ] 自动同步策略（WiFi vs 蜂窝）
- [ ] 冲突解决策略
- [ ] 同步状态通知
- [ ] 手动触发同步

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

### 3. 网络状态监听 (NetworkMonitor)

**功能需求**:
- [ ] 使用 NWPathMonitor 监听网络状态
- [ ] 区分 WiFi / 蜂窝 / 无网络
- [ ] 网络状态变化回调
- [ ] 连接质量评估

```swift
protocol NetworkMonitorProtocol {
    var isConnected: Bool { get }
    var connectionType: ConnectionType { get }
    var isExpensive: Bool { get }  // 蜂窝网络
    var connectionPublisher: AnyPublisher<NetworkStatus, Never> { get }
}

enum ConnectionType {
    case wifi
    case cellular
    case ethernet
    case none
}

struct NetworkStatus {
    let isConnected: Bool
    let connectionType: ConnectionType
    let isExpensive: Bool
    let isConstrained: Bool
}
```

### 4. 数据备份/导出 (DataExportService)

**功能需求**:
- [ ] 导出用户数据为 JSON
- [ ] 导出学习记录
- [ ] 导出聊天记录
- [ ] 导出到文件
- [ ] 分享功能集成

```swift
protocol DataExportServiceProtocol {
    func exportAllData() async throws -> URL
    func exportStudyRecords() async throws -> URL
    func exportChatHistory() async throws -> URL
    func exportUserProfile() async throws -> URL

    func getExportProgress() -> AnyPublisher<Double, Never>
}

struct ExportData: Codable {
    let userProfile: UserProfile
    let studyRecords: [StudyRecord]
    let chatRooms: [ChatRoom]
    let exportedAt: Date
    let appVersion: String
}
```

## 需要新增的文件

```
TRIX3DCompanion/
├── Core/
│   ├── Services/
│   │   ├── OfflineCacheService.swift
│   │   ├── OfflineCacheServiceProtocol.swift
│   │   ├── DataSyncService.swift
│   │   ├── DataSyncServiceProtocol.swift
│   │   ├── NetworkMonitor.swift
│   │   ├── NetworkMonitorProtocol.swift
│   │   └── DataExportService.swift
│   │   └── DataExportServiceProtocol.swift
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
    entity_type TEXT NOT NULL,  -- 'message', 'study', 'user'
    entity_id TEXT NOT NULL,
    local_version INTEGER NOT NULL,
    server_version INTEGER,
    sync_status TEXT NOT NULL,  -- 'pending', 'synced', 'conflict'
    last_synced_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_sync_records_status ON sync_records(sync_status);
```

## 验收标准

- [ ] 离线可以查看已缓存的消息
- [ ] 网络恢复后自动同步
- [ ] 显示同步状态
- [ ] 可以导出用户数据
- [ ] 缓存大小可查看和管理

---

# 🔔 Phase 6D: 通知系统

## 目标

实现本地通知、学习提醒、消息推送

## 需要实现的模块

### 1. LocalNotificationService (本地通知)

**功能需求**:
- [ ] 通知权限请求
- [ ] 学习提醒通知
- [ ] 定时通知（番茄钟）
- [ ] 每日目标提醒
- [ ] 自定义通知声音
- [ ] 通知分类管理

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

### 2. PushNotificationService (推送通知)

**功能需求**:
- [ ] APNs 设备令牌注册
- [ ] 处理远程通知
- [ ] 通知显示定制
- [ ] 静默推送支持
- [ ] 通知后台处理

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

### 3. NotificationManager (统一通知管理)

**功能需求**:
- [ ] 统一入口管理本地和推送通知
- [ ] 通知偏好设置
- [ ] 免打扰模式
- [ ] 夜间模式
- [ ] 按类型启用/禁用

```swift
protocol NotificationManagerProtocol {
    var preferences: NotificationPreferences { get }

    func enableNotification(type: NotificationType, enabled: Bool) async
    func setQuietHours(start: Int, end: Int) async
    func setQuietHoursEnabled(_ enabled: Bool) async
    func shouldShowNotification(type: NotificationType) -> Bool

    // Combine publishers
    var preferencesPublisher: AnyPublisher<NotificationPreferences, Never> { get }
}

struct NotificationPreferences: Codable {
    var studyRemindersEnabled: Bool = true
    var dailyGoalReminderEnabled: Bool = true
    var chatMessagesEnabled: Bool = true
    var friendRequestsEnabled: Bool = true
    var quietHoursEnabled: Bool = false
    var quietHoursStart: Int = 22  // 10 PM
    var quietHoursEnd: Int = 8     // 8 AM
}

enum NotificationType: String, CaseIterable {
    case studyReminder = "study_reminder"
    case dailyGoal = "daily_goal"
    case chatMessage = "chat_message"
    case friendRequest = "friend_request"
    case system = "system"
}
```

### 4. Notification Views (通知相关视图)

```
TRIX3DCompanion/
├── Features/
│   ├── Settings/
│   │   ├── Views/
│   │   │   └── NotificationSettingsView.swift   # 通知设置页面
│   │   └── ViewModels/
│   │       └── NotificationSettingsViewModel.swift
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

### 系统通知
- 版本更新提醒
- 数据同步状态
- 积分变动提醒

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

## Web 对标功能

来自 `src/screens/Profile.tsx`

## 需要实现的模块

### 1. ProfileView (个人资料页面)

**功能需求**:
- [ ] 显示用户头像、用户名、邮箱
- [ ] 显示积分余额
- [ ] 显示统计数据（活跃天数、互动次数）
- [ ] 显示会员状态

```swift
struct ProfileView: View {
    @StateObject private var viewModel = ProfileViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // 用户信息卡片
                ProfileInfoCard(
                    avatarURL: viewModel.profile?.avatarUrl,
                    username: viewModel.username,
                    email: viewModel.email,
                    points: viewModel.points,
                    level: viewModel.level
                )

                // 统计数据
                StatsSection(
                    daysActive: viewModel.daysActive,
                    interactionCount: viewModel.interactionCount,
                    studyTime: viewModel.totalStudyTime
                )

                // 设置列表
                SettingsList(viewModel: viewModel)
            }
        }
    }
}
```

### 2. SettingsView (设置页面)

**功能需求**:
- [ ] 主题设置（浅色/深色/系统）
- [ ] 语言设置（中/英/日）
- [ ] 通知设置（跳转）
- [ ] 隐私设置
- [ ] 关于我们
- [ ] 清理缓存
- [ ] 登出

```swift
struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()
    @StateObject private var themeManager = ThemeManager.shared

    var body: some View {
        List {
            // 外观
            Section("外观") {
                Picker("主题", selection: $themeManager.currentTheme) {
                    Text("跟随系统").tag(AppTheme.system)
                    Text("浅色模式").tag(AppTheme.light)
                    Text("深色模式").tag(AppTheme.dark)
                }
            }

            // 语言
            Section("语言") {
                Picker("语言", selection: $viewModel.selectedLanguage) {
                    Text("简体中文").tag("zh")
                    Text("English").tag("en")
                    Text("日本語").tag("ja")
                }
            }

            // 通知
            Section("通知") {
                NavigationLink("通知设置") {
                    NotificationSettingsView()
                }
            }

            // 隐私
            Section("隐私") {
                NavigationLink("隐私设置") {
                    PrivacySettingsView()
                }
            }

            // 数据
            Section("数据") {
                Button("清理缓存") {
                    viewModel.clearCache()
                }

                Button("导出数据") {
                    viewModel.exportData()
                }
            }

            // 关于
            Section("关于") {
                NavigationLink("关于我们") {
                    AboutView()
                }

                Button("登出") {
                    viewModel.logout()
                }
            }
        }
    }
}
```

### 3. PointsHistoryView (积分历史)

**功能需求**:
- [ ] 显示积分余额
- [ ] 显示积分历史记录
- [ ] 按类型筛选
- [ ] 下拉刷新

```swift
struct PointsHistoryView: View {
    @StateObject private var viewModel = PointsHistoryViewModel()

    var body: some View {
        VStack {
            // 积分卡片
            PointsBalanceCard(
                totalPoints: viewModel.totalPoints,
                level: viewModel.level,
                todayEarned: viewModel.todayEarned,
                weekEarned: viewModel.weekEarned
            )

            // 历史列表
            List(viewModel.transactions) { transaction in
                PointsTransactionRow(transaction: transaction)
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }
}
```

### 4. PrivacySettingsView (隐私设置)

**功能需求**:
- [ ] 位置分享开关
- [ ] 在线状态可见性
- [ ] 阅读回执
- [ ] 数据使用说明
- [ ] 删除账户

```swift
struct PrivacySettingsView: View {
    @StateObject private var viewModel = PrivacySettingsViewModel()

    var body: some View {
        List {
            Section("位置") {
                Toggle("允许好友查看我的位置", isOn: $viewModel.shareLocation)
                Toggle("在地图上显示我", isOn: $viewModel.showOnMap)
            }

            Section("状态") {
                Toggle("显示在线状态", isOn: $viewModel.showOnlineStatus)
                Toggle("显示最后在线时间", isOn: $viewModel.showLastSeen)
            }

            Section("消息") {
                Toggle("发送已读回执", isOn: $viewModel.sendReadReceipts)
            }

            Section("数据") {
                Button("删除账户", role: .destructive) {
                    viewModel.showDeleteAccountConfirmation()
                }
            }
        }
    }
}
```

### 5. AboutView (关于页面)

**功能需求**:
- [ ] 应用图标和名称
- [ ] 版本号
- [ ] 构建号
- [ ] 服务条款链接
- [ ] 隐私政策链接
- [ ] 开发者信息

```swift
struct AboutView: View {
    var body: some View {
        VStack(spacing: 24) {
            Image("AppIcon")
                .resizable()
                .frame(width: 80, height: 80)
                .cornerRadius(18)

            Text("TRIX 3D Companion")
                .font(.title2)
                .fontWeight(.bold)

            Text("Version \(appVersion) (\(buildNumber))")

            Spacer()

            Link("服务条款", destination: URL(string: "https://...")!)
            Link("隐私政策", destination: URL(string: "https://...")!)
        }
    }
}
```

## 需要新增的文件

```
TRIX3DCompanion/
├── Features/
│   ├── Profile/
│   │   ├── Views/
│   │   │   ├── ProfileView.swift
│   │   │   ├── SettingsView.swift
│   │   │   ├── ProfileInfoCard.swift
│   │   │   ├── StatsSection.swift
│   │   │   ├── PointsHistoryView.swift
│   │   │   ├── PointsTransactionRow.swift
│   │   │   ├── PrivacySettingsView.swift
│   │   │   └── AboutView.swift
│   │   └── ViewModels/
│   │       ├── ProfileViewModel.swift
│   │       ├── SettingsViewModel.swift
│   │       ├── PointsHistoryViewModel.swift
│   │       └── PrivacySettingsViewModel.swift
```

## API 端点扩展

需要在 `APIEndpoints.swift` 中添加:

```swift
case userGetProfile
case userUpdateProfile
case userGetPoints
case userGetPointsHistory
case userUpdateSettings
case userDeleteAccount
```

## 验收标准

- [ ] 显示完整的用户信息
- [ ] 可以切换主题
- [ ] 可以切换语言
- [ ] 可以管理通知设置
- [ ] 可以管理隐私设置
- [ ] 可以查看积分历史
- [ ] 可以清理缓存
- [ ] 可以登出
- [ ] 可以删除账户

---

# 🔒 Phase 6F: 安全审计 + 性能优化

## 安全审计

### 需要修复的问题 (来自安全审计报告)

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
- [ ] 实现账户删除 API
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

| 指标 | 目标值 | 当前值 |
|------|--------|--------|
| 启动时间 | < 2 秒 | 未测 |
| 内存占用 | < 150MB | 未测 |
| 电池消耗 | < 5%/小时 | 未测 |
| 滑动帧率 | 60 fps | 未测 |

## 验收标准

- [ ] 所有安全问题已修复
- [ ] 代码通过安全审计 (评分 A)
- [ ] 启动时间 < 2 秒
- [ ] 内存占用 < 150MB
- [ ] 滑动帧率稳定 60 fps

---

# 📋 完整实施时间线

```
Week 1-2: Phase 6A - 测试覆盖率提升 (80%)
Week 3:   Phase 6B - 语音功能
Week 4:   Phase 6C - 数据持久化
Week 5:   Phase 6D - 通知系统
Week 6:   Phase 6E - 个人资料页面
Week 7:   Phase 6F - 安全审计 + 性能优化
Week 8:   最终测试 + App Store 准备
```

---

# ❓ 待确认问题

1. **TTS 语音选择**: 是否需要支持下载额外的语音包？
2. **离线数据范围**: 聊天消息缓存需要保留多久？
3. **推送证书**: APNs 推送证书是否已配置？
4. **账户删除**: 是否需要二次确认和冷静期？
5. **积分规则**: iOS 端是否需要显示积分商城入口？

---

# 📝 总结

此计划涵盖以下内容:

| 阶段 | 功能 | 文件数 | 预估代码量 |
|------|------|--------|-----------|
| 6A | 测试覆盖率提升 | 9 个测试文件 | ~1,500 行 |
| 6B | 语音功能 | 8 个文件 | ~1,200 行 |
| 6C | 数据持久化 | 7 个文件 | ~1,000 行 |
| 6D | 通知系统 | 6 个文件 | ~800 行 |
| 6E | 个人资料页面 | 10 个文件 | ~1,500 行 |
| 6F | 安全+性能 | - | ~500 行 |

**总计**: ~40 个新文件，约 6,500 行代码

---

**计划生成时间**: 2026-02-26
**生成者**: Claude Code iOS 开发专家

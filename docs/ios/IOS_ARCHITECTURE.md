# TRIX3DCompanion iOS Architecture Document

> iOS TRIX 3D Companion Technical Architecture
> Based on SwiftUI + Combine
> **Last Updated**: 2026-03-29
> **Version**: 1.4（准确性修复：AnalyticsService、UIRenderingOptimizer、InputValidator 均已存在；总 Swift 文件数修正为 231；新增 Core/Design、Core/Video、Features/Data 目录）

---

## Accuracy Notes (as of 2026-03-29)

**Known discrepancies:**
- `AppDelegate.swift` does not exist — lifecycle managed by `TRIX3DCompanionApp.swift`
- `PairingService.swift` does not exist — pairing implemented in `ClawbotChannelService`
- `WebSocketManager` does not exist — real-time uses `ClawbotChannelService` (TRIX Native Channel protocol)
- Core/Utils/, Core/Config/ have no Swift files (entire directory has no Swift files)
- Core/Services has 40 implementations + 21 protocols = **61 Swift files**
- Total Swift files (excluding tests): **231**

**Previously corrected (v1.3 → v1.4):**
- `AnalyticsService.swift` exists at `Core/Analytics/`
- `UIRenderingOptimizer.swift` exists at `Core/Performance/`
- `InputValidator.swift` exists at `Core/Utilities/`

---

## 1. Architecture Overview

```
iOS Architecture
=================================================================
Views (UI Layer)
  HomeView  ChatView  StudyView  ProfileView  MapView  StoreView  ...

  ViewModels (Business Logic)
    HomeViewModel  ChatViewModel  StudyViewModel  ProfileViewModel  ...

    Services (Data Layer)
      AuthService  ChatService  StudyService  ClawbotChannelService  ...

        Network Layer              Storage Layer             External
        (APIClient/Alamofire)     (Keychain/SQLite)        (Supabase/iOS)
        + SSLPinningManager       + UserDefaults
        + RequestRetryManager
        + RequestDeduplicator
        + SecurityHeadersValidator
=================================================================
```

---

## 2. Technology Stack

| Category | Technology | Notes |
|---------|-----------|-------|
| Language | Swift | 5.9+ |
| UI Framework | SwiftUI | iOS 16+ |
| State Management | Combine | Built-in |
| Networking | Alamofire + Starscream | Latest via SPM |
| Realtime Messaging | ClawbotChannelService | TRIX Native Channel protocol |
| Local Storage | SQLite (SQLite.swift) + Keychain | - |
| Payments | StoreKit 2 | - |
| Maps | MapKit + Baidu Map SDK | - |
| Camera | AVFoundation | Built-in |
| Push | APNs | - |
| Testing | XCTest | - |
| Dependency Manager | Swift Package Manager | Package.swift |

---

## 3. Directory Structure

```
ios/TRIX3DCompanion/
|
+- App/
|   +- TRIX3DCompanionApp.swift     # @main entry point
|   +- AppState.swift                # Global app state (@MainActor)
|   +- ContentView.swift             # Root view (auth-aware)
|   +- ClawbotChannelViewModel.swift # TRIX Native Channel pairing
|   +- AnimatedSplashView.swift     # Splash screen
|   +- UITestAccessibilityIdentifiers.swift
|
+- Core/
|   +- Design/
|   |   +- DesignSystem.swift          # Lumina design token system
|   |
|   +- Network/
|   |   +- APIClient.swift              # HTTP client (Alamofire)
|   |   +- APIEndpoints.swift            # REST endpoint enum
|   |   +- AuthInterceptor.swift        # Auto token injection
|   |   +- SSLPinningManager.swift      # SSL public key pinning
|   |   +- RequestRetryManager.swift     # Exponential backoff retry
|   |   +- RequestDeduplicator.swift    # Request deduplication (30s TTL)
|   |   +- NetworkRequestCache.swift     # HTTP response caching
|   |   +- NetworkError.swift            # Error enum
|   |   +- SecurityHeadersValidator.swift # HSTS, CSP, X-Frame validation
|   |   +- JSONDateDecoding.swift
|   |   +- NetworkLogger.swift
|   |
|   +- Storage/
|   |   +- KeychainManager.swift     # Secure storage (tokens, device ID)
|   |   +- DatabaseManager.swift      # SQLite (SQLite.swift), AES-256 encrypted
|   |   +- UserDefaultsManager.swift  # App settings/preferences
|   |   +- JailbreakDetector.swift   # Jailbreak detection
|   |   +- KeychainSecurityValidator.swift
|   |
|   +- Services/  (40 implementations + 21 matching *Protocol.swift = 61 files)
|   |   # 完整列表见 docs/ios/IOS_ARCHITECTURE.md
|   |
|   +- Analytics/
|   |   +- ErrorTrackingService.swift       # Error tracking
|   |   +- PerformanceMonitoringService.swift # Performance metrics
|   |   +- AppLaunchOptimizer.swift         # Cold/hot start optimization
|   |   +- MemoryLeakDetector.swift         # Memory leak detection
|   |
|   +- Performance/
|   |   +- BatteryConsumptionOptimizer.swift
|   |
|   +- Cache/
|   |   +- ImageCacheManager.swift          # Image caching (Kingfisher)
|   |
|   +- Utilities/
|   |   +- InputValidator.swift         # Input validation utilities
|   |   +- SecureLogger.swift         # Auto-sanitizing logger
|   |
|   +- Video/
|   |   +- VideoPlayerView.swift       # Video playback
|   |
|   +- Utils/
|       # 整个目录无 Swift 文件
|
|   +- Config/
       # 整个目录无 Swift 文件
+- Features/
|   +- Auth/
|   |   +- Views/  LoginView, RegisterView, AuthRootView, AuthSceneComponents
|   |   +- ViewModels/  AuthViewModel
|   |
|   +- Home/
|   |   +- Views/  HomeView, MainTabView, GlassDockView, ProfileView,
|   |   |         ChatListView, StudyListView, MailPanelView,
|   |   |         NotificationPanelView, TrixBotChatView,
|   |   |         HomeBotBubbleView, HeroBackgroundView,
|   |   |         RobotHeroBackgroundView, VideoBackgroundView
|   |   +- ViewModels/  HomeViewModel
|   |
|   +- Chat/
|   |   +- Views/  ChatDetailView, MessageBubbleView, MessageCell,
|   |   |         ChatInputBar, AIActionSelectorView, ImageMessageView,
|   |   |         VoiceMessageView, VoiceRecordingButton
|   |   +- ViewModels/  ChatDetailViewModel, ChatListViewModel
|   |   +- Components/  OnlineStatusIndicator, TypingIndicatorView, UnreadBadge
|   |   +- Models/  AIAction
|   |
|   +- Study/
|   |   +- Views/  StudyRoomView, StudyTimerView, StudyStatsView,
|   |   |         CelebrationAnimationView, DynamicBackgroundView,
|   |   |         FocusStartAnimationView, MusicButton, MusicSelectorView
|   |   +- ViewModels/  StudyRoomViewModel
|   |
|   +- Map/
|   |   +- Views/  MapView, BaiduMapView, LocationDetailView, LocationPickerView
|   |   +- ViewModels/  MapViewModel
|   |   +- Models/  MapModels
|   |
|   +- Store/
|   |   +- Views/  StoreView, PointsPurchaseView, ProductDetailView,
|   |   |         SubscriptionView, PaymentResultView
|   |   +- ViewModels/  StoreViewModel, ProductViewModel, PaymentViewModel
|   |
|   +- Pairing/
|   |   +- Views/  PairingView, QRScannerView
|   |
|   +- Snapshot/
|   |   +- Views/  CameraView, SnapshotListView, SnapshotAnalysisView
|   |   +- ViewModels/  CameraViewModel, SnapshotListViewModel
|   |
|   +- Voice/
|   |   +- Views/  TTSControlView, VoiceMessagePlayerView,
|   |   |         VoiceFeatureIntegrationExample
|   |   +- ViewModels/  TTSViewModel, VoicePlayerViewModel
|   |
|   +- Workbench/
|   |   +- Views/  WorkbenchView, WorkbenchCard, WorkbenchSheet,
|   |   |         TodoListView, TodoFormView, ScheduleListView, ScheduleFormView
|   |   +- ViewModels/  TodoViewModel, ScheduleViewModel
|   |   +- Models/  Todo, Schedule
|   |
|   +- Profile/
|   |   +- Views/  ProfileScreen, SettingsScreen, PrivacySettingsScreen,
|   |   |         AboutScreen, PointsHistoryScreen, ProfileInfoCard,
|   |   |         StatsSection, WardrobeView
|   |   +- ViewModels/  ProfileViewModel, SettingsViewModel,
|   |               PrivacySettingsViewModel, PointsHistoryViewModel
|   |
|   +- Diagnostic/
|   |   +- Views/  DiagnosticView, DiagnosticAdvancedView
|   |   +- ViewModels/  DiagnosticViewModel
|   |   +- Models/  DiagnosticModels
|
|   +- Data/
|   |   +- PersistenceIntegrationExample.swift
|
+- Shared/
|   +- Components/
|   |   +- AvatarView, GlassPanel, GlassPanelStyles, GradientButton,
|   |     ConfirmDialog, ErrorView, LoadingView, AnimatedCard,
|   |     AnimatedQRDisplay, ShimmerEffect,
|   |     EmptyStates/ (EmptyFriendListView, EmptyMessageListView,
|   |                   EmptyNotificationView, EmptyPointsHistoryView, NoInternetView),
|   |     Loading/ (LoadingIndicatorView, ProgressView, SkeletonView)
|   |
|   +- Theme/  Colors, Typography, Theme, ThemePreview
|   +- Extensions/  ColorGradientExtension, Animations, Accessibility,
|   |               Localizable, AVAudioPlayer+Extensions
|   +- Models/  User, ChatMessage, ChatRoom, StudyRoom,
|               Location, Snapshot, Device, BotState
+- Tests/
    +- TRIX3DCompanionTests/
        +- Auth/, Chat/, Home/, Diagnostic/, Map/, Profile/,
           Services/, Smoke/, Snapshot/, Store/, UI/, ViewModels/,
           Voice/, Workbench/, Performance/, Integration/
```

---

## 4. Key Services

### 4.1 Authentication (AuthService)

```swift
@MainActor
final class AuthService: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false

    func login(email: String, password: String) async throws -> User
    func register(username: String, email: String, password: String) async throws -> User
    func logout() async throws
    func refreshToken() async throws
}
```

### 4.2 Network (APIClient)

```swift
final class APIClient {
    func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T
    func post<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable?) async throws -> T
    func put<T: Decodable>(_ endpoint: APIEndpoint, body: Encodable?) async throws -> T
    func delete<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T
}
```

Features: SSL Pinning (SSLPinningManager), retry with exponential backoff, request deduplication, auto token refresh via AuthInterceptor, security header validation.

### 4.3 ClawbotChannelService (TRIX Native Channel — Real-Time)

Replaces the deprecated WebSocket-based approach. Uses TRIX Native Channel protocol (HTTP long-polling) for real-time messaging and device pairing.

```swift
final class ClawbotChannelService: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var messages: [ChatMessage] = []

    func connect(host: String, code: String, secret: String) async throws
    func disconnect()
    func send(message: String) async
}
```

**Pairing**: Use `ClawbotChannelViewModel` (in App/) for pairing flow. QR format: `http://host/pair?code=XXX&secret=YYY`.

### 4.4 Local Storage

| Service | Purpose |
|---------|---------|
| KeychainManager | Tokens, user ID, device ID, OAuth tokens, paired device info |
| DatabaseManager | Messages, chat rooms, study sessions (AES-256 encrypted content) |
| UserDefaultsManager | App settings, cached preferences, theme selection |

---

## 5. Data Flow

```
User action (View)
       v
ViewModel (business logic)
       |
       +-> Service (data processing)
       |         |
       |         +-> APIClient (network)
       |         |           |
       |         |           +-> AuthInterceptor (token injection)
       |         |           +-> SSLPinningManager
       |         |           +-> RequestRetryManager
       |         |           +-> SecurityHeadersValidator
       |         |
       |         +-> KeychainManager / DatabaseManager (local storage)
       |
       v
ViewModel (state update)
       v
View (SwiftUI update)
```

---

## 6. Security Architecture

### 6.1 Data Security

| Measure | Implementation |
|---------|---------------|
| Keychain | `whenUnlockedThisDeviceOnly`, no iCloud sync |
| DB Encryption | AES-256-CBC on message content + transaction descriptions |
| SSL Pinning | Public key pinning, SHA-256, enforced in production |
| Logging | SecureLogger auto-sanitizes tokens, emails, coordinates |
| Jailbreak Detection | `JailbreakDetector.swift` checks for common indicators |

### 6.2 Network Security

```swift
// SSLPinningManager — production only
self.enablePinning = (buildMode != .debug)
self.pinningMode = .publicKey
self.hashAlgorithm = .sha256

// Keychain access control
SecAccessControlCreateWithFlags(
    kCFAllocatorDefault,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    .biometryCurrentSet,
    nil
)
```

---

## 7. Performance Optimization

| Area | Strategy | Target |
|------|----------|--------|
| Launch | Lazy service init, async init, resource preload | Cold start < 2s |
| Memory | Kingfisher LRU cache, weak refs, object pooling | Peak < 200MB |
| Network | Request deduplication, retry backoff, prefetch | API p95 < 500ms |
| Battery | Background task limits, location optimization, push over poll | - |

---

## 8. Testing

| Category | Target |
|---------|--------|
| Unit tests | 80%+ |
| Integration tests | Critical paths |
| UI tests | Core flows |
| Performance benchmarks | Cold start, memory, network, battery |

---

## 9. Dependencies (Package.swift)

```swift
dependencies: [
    .package(url: ".../supabase-swift.git", from: "1.0.0"),
    .package(url: ".../Alamofire.git", from: "5.8.0"),
    .package(url: ".../Starscream.git", from: "4.0.0"),
    .package(url: ".../Kingfisher.git", from: "7.10.0"),
    .package(url: ".../KeychainAccess.git", from: "4.2.0"),
    .package(url: ".../SQLite.swift.git", from: "0.14.0"),
    .package(url: ".../CodeScanner.git", from: "2.0.0"),
    .package(url: ".../socket.io-client-swift.git", from: "16.0.0"),
    .package(url: ".../PopupView.git", from: "4.1.0"),
    .package(url: ".../WhatsNewKit.git", from: "1.0.0"),
    .package(url: ".../ActivityIndicatorView.git", from: "1.1.0"),
]
```

---

## 10. Build & Deploy

- **XcodeGen** generates `.xcodeproj` from `project.yml`
- **GitHub Actions** for CI/CD automated build
- **Bundle ID**: `com.trix3d.companion`
- **Min iOS**: 16.0

---

## 11. Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-02 | Initial version |
| 1.1 | 2026-03 | Performance optimization |
| 1.2 | 2026-03-25 | Accuracy update: added missing services (17), removed non-existent files |
| 1.3 | 2026-03-26 | Directory structure cleanup: Core/Network (3 files removed), Core/Storage (2 removed), Core/Services count: 61 files (40 impl + 21 protocols), total Swift: 293 |
| 1.4 | 2026-03-29 | Accuracy fix: AnalyticsService, UIRenderingOptimizer, InputValidator all exist; total Swift corrected to 231; added Core/Design, Core/Video, Features/Data to directory structure; removed duplicate Video/ entry |

---

**Last Updated**: 2026-03-29
**Version**: 1.4

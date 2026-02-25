# TRIX 3D Companion iOS 完整实现计划

> **项目**: TRIX 3D Companion iOS 原生应用
> **版本**: 3.0 (完整实现版)
> **目标系统**: iOS 16.0+
> **设备**: iPhone only
> **创建日期**: 2026-02-26

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [功能模块详细设计](#3-功能模块详细设计)
4. [项目结构](#4-项目结构)
5. [API 接口定义](#5-api-接口定义)
6. [数据模型](#6-数据模型)
7. [实现任务分解](#7-实现任务分解)
8. [里程碑计划](#8-里程碑计划)
9. [依赖库清单](#9-依赖库清单)
10. [配置文件](#10-配置文件)

---

## 1. 项目概述

### 1.1 项目目标

将现有的 Web 前端应用完全重写为 iOS 原生应用，使用 Swift/SwiftUI 开发，保持与 Web 版相同的功能和用户体验，同时利用 iOS 原生能力提升性能和交互体验。

### 1.2 核心特性

| 特性 | 描述 |
|------|------|
| 全屏 3D 角色 | 首页展示 3D 角色，点击显示导航 |
| AI 对话 | 通过 WebSocket 连接 Clawbot 进行 AI 对话 |
| 实时聊天 | 好友之间实时消息，支持文字/图片/语音 |
| 学习计时 | 番茄钟计时，本地通知提醒 |
| 设备配对 | 二维码扫描配对 Clawbot 设备 |
| 地图拍照 | 类似 Snapchat 的地图拍照功能 |
| 积分系统 | 学习获得积分，等级系统 |
| 离线支持 | 本地缓存聊天记录 |

### 1.3 约束条件

- iOS 16.0+ (最新特性支持)
- 仅支持 iPhone (不支持 iPad)
- 独立 iOS 项目，不与 Web 版合并

---

## 2. 技术栈

### 2.1 框架与语言

| 类别 | 技术 | 版本 |
|------|------|------|
| UI 框架 | SwiftUI | iOS 16+ |
| 语言 | Swift | 5.9+ |
| 最低系统 | iOS | 16.0 |
| Xcode | Latest | 15+ |
| 架构模式 | MVVM | - |

### 2.2 依赖管理

- **Swift Package Manager** (首选)
- **CocoaPods** (备选，仅用于无法用 SPM 的库)

### 2.3 核心依赖库

| 库名 | 用途 | 版本 | 管理方式 |
|------|------|------|----------|
| Supabase Swift | 认证+数据库+Realtime | 1.0+ | SPM |
| Alamofire | HTTP 网络请求 | 5.8+ | SPM |
| Starscream | WebSocket 实时通讯 | 4.0+ | SPM |
| Kingfisher | 图片加载与缓存 | 7.10+ | SPM |
| KeychainAccess | 安全存储 Token | 4.2+ | SPM |
| SQLite.swift | 本地结构化数据 | 0.14+ | SPM |

### 2.4 iOS 原生框架

| 框架 | 用途 |
|------|------|
| AuthenticationServices | Apple 登录 |
| UserNotifications | 本地/远程通知 |
| AVFoundation | 相机、音频录制播放 |
| MapKit | 地图显示 |
| CoreLocation | 位置服务 |
| PhotosUI | 相册选择 |
| CodeScanner | 二维码扫描 |

---

## 3. 功能模块详细设计

### 3.1 认证模块 (Auth)

#### 功能列表
- 邮箱/密码登录
- 邮箱/密码注册
- Apple 登录 (Sign in with Apple)
- Token 自动刷新
- 登出
- 忘记密码（可选）

#### 实现细节

```swift
// 认证服务
class AuthService {
    // 登录
    func login(email: String, password: String) async throws -> UserSession

    // 注册
    func register(username: String, email: String, password: String) async throws -> User

    // Apple 登录
    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async throws -> User

    // 登出
    func logout() async throws

    // 刷新 Token
    func refreshToken() async throws -> UserSession

    // 获取当前用户
    func getCurrentUser() async throws -> User

    // 检查登录状态
    func checkAuthStatus() -> Bool
}
```

#### 存储策略
- Access Token: Keychain
- Refresh Token: Keychain
- User Info: UserDefaults (缓存)

#### Apple 登录配置
1. 在 Apple Developer 后台创建 App ID
2. 启用 Sign in with Apple capability
3. 创建 Services ID
4. 配置回调域名
5. 实现 ASAuthorizationAppleIDProvider

### 3.2 首页模块 (Home)

#### 功能列表
- 全屏 3D 角色展示
- 点击任意位置显示底部导航
- 导航栏切换
- 主题适配（深色/浅色）

#### 实现细节

```swift
// 首页 View
struct HomeView: View {
    @State private var showNavigation = false
    @State private var selectedTab = 0

    var body: some View {
        ZStack {
            // 3D 角色层 (暂时用占位图)
            Hero3DView()

            // 点击检测层
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.3)) {
                        showNavigation.toggle()
                    }
                }

            // 底部导航层
            if showNavigation {
                GlassDockView(selectedTab: $selectedTab)
                    .transition(.move(edge: .bottom))
            }
        }
    }
}

// 底部导航 Dock
struct GlassDockView: View {
    @Binding var selectedTab: Int

    let tabs = [
        (icon: "house.fill", label: "首页"),
        (icon: "bubble.left.and.bubble.right.fill", label: "聊天"),
        (icon: "book.fill", label: "学习"),
        (icon: "person.fill", label: "我的")
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<tabs.count, id: \.self) { index in
                Button {
                    selectedTab = index
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tabs[index].icon)
                            .font(.system(size: 24))
                        Text(tabs[index].label)
                            .font(.caption2)
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundColor(selectedTab == index ? .purple : .gray)
                }
            }
        }
        .padding(.vertical, 20)
        .padding(.horizontal)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 20, y: 10)
        .padding(.horizontal, 20)
        .padding(.bottom, 34) // 安全区域
    }
}
```

#### 3D 角色实现
- Phase 1: 使用占位图
- Phase 2: 集成 Three.js / ModelViewer
- Phase 3: 纯 SceneKit 实现（可选）

### 3.3 聊天模块 (Chat)

#### 功能列表
- AI 对话 (Clawbot)
- 好友聊天
- 文字消息
- 图片消息
- 语音消息（录制/播放）
- 消息已读/未读状态
- 离线消息缓存
- 实时同步

#### 实现细节

```swift
// 聊天列表 ViewModel
@MainActor
class ChatListViewModel: ObservableObject {
    @Published var chatRooms: [ChatRoom] = []
    @Published var isLoading = false
    @Published var error: ChatError?

    // 获取聊天房间列表
    func fetchChatRooms() async

    // 创建聊天房间
    func createChatRoom(name: String, type: ChatRoomType) async

    // 删除聊天房间
    func deleteChatRoom(id: String) async
}

// 聊天详情 ViewModel
@MainActor
class ChatDetailViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText = ""
    @Published var isLoading = false
    @Published var isSending = false
    @Published var recordingState: RecordingState = .idle

    // 发送文字消息
    func sendMessage(_ text: String) async

    // 发送图片
    func sendImage(_ image: UIImage) async

    // 发送语音
    func sendVoice(data: Data, duration: TimeInterval) async

    // 开始录音
    func startRecording()

    // 停止录音
    func stopRecording() -> (Data, TimeInterval)?

    // 播放语音
    func playVoice(url: URL)

    // 加载历史消息
    func loadMoreMessages() async
}
```

#### WebSocket 事件

```swift
// 连接 Clawbot Channel
socket.connect(to: "ws://TRIX_SERVER_HOST:8765")

// 事件列表
enum ChatEvent {
    case connect
    case disconnect
    case messageReceived(ChatMessage)
    case messageSent(MessageId)
    case botMessageReceived(BotMessage)
    case pairingSuccess(DeviceInfo)
    case botOnline
    case botOffline
    case error(ChatError)
}
```

#### 消息类型

```swift
enum MessageType: String, Codable {
    case text
    case image
    case voice
    case video
}

struct ChatMessage: Codable, Identifiable {
    let id: String
    let roomId: String
    let senderId: String
    let sender: MessageSender
    let content: String
    let type: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?
    let mediaDuration: Int? // 语音时长(秒)
    let isRead: Bool
    let createdAt: Date
}

enum MessageSender: String, Codable {
    case user
    case bot
    case friend
}
```

#### 语音处理

```swift
class AudioService {
    // 录音
    private var audioRecorder: AVAudioRecorder?
    private var recordingURL: URL?

    func startRecording() throws
    func stopRecording() -> (URL, TimeInterval)?

    // 播放
    private var audioPlayer: AVAudioPlayer?

    func play(url: URL) throws
    func pause()
    func stop()

    // 压缩 (上传前压缩到 < 1MB)
    func compressAudio(_ url: URL) async throws -> Data
}
```

### 3.4 学习模块 (Study)

#### 功能列表
- 番茄钟计时器
- 学习房间创建/加入/离开
- 学习统计
- 专注提醒通知
- 积分获取
- 陪伴模式（显示好友在线状态）

#### 实现细节

```swift
// 学习计时器 ViewModel
@MainActor
class StudyTimerViewModel: ObservableObject {
    @Published var state: TimerState = .idle
    @Published var focusDuration: Int = 25 // 分钟
    @Published var restDuration: Int = 5 // 分钟
    @Published var remainingSeconds: Int = 0
    @Published var currentSession: StudySession?

    // 番茄钟流程
    func startFocus() // 开始专注
    func pauseFocus() // 暂停
    func resumeFocus() // 继续
    func stopFocus() // 停止

    // 自动开始休息
    func startRest()
}

// 计时器状态
enum TimerState {
    case idle
    case focusing
    case resting
    case paused
}
```

#### 本地通知

```swift
class NotificationService {
    // 请求权限
    func requestAuthorization() async -> Bool

    // 专注开始提醒
    func scheduleFocusStartNotification(at date: Date)

    // 专注结束提醒
    func scheduleFocusEndNotification(at date: Date, earnedPoints: Int)

    // 休息提醒
    func scheduleRestNotification(at date: Date)

    // 学习提醒（每日定时）
    func scheduleDailyStudyReminder(hour: Int, minute: Int)
}
```

#### 学习房间 (可选功能)

```swift
// 学习房间 ViewModel
@MainActor
class StudyRoomViewModel: ObservableObject {
    @Published var rooms: [StudyRoom] = []
    @Published var currentRoom: StudyRoom?
    @Published var members: [StudyMember] = []

    // 创建房间
    func createRoom(name: String, maxMembers: Int) async throws -> StudyRoom

    // 加入房间
    func joinRoom(code: String) async throws -> StudyRoom

    // 离开房间
    func leaveRoom() async

    // 同步房间状态
    func syncRoomState() async
}
```

### 3.5 配对模块 (Pairing)

#### 功能列表
- 扫描二维码配对
- 配对码输入配对
- 配对请求管理
- 已配对设备列表
- 解除配对

#### 实现细节

```swift
// 配对 ViewModel
@MainActor
class PairingViewModel: ObservableObject {
    @Published var pairingState: PairingState = .idle
    @Published var pairingCode: String?
    @Published var pairedDevices: [PairedDevice] = []
    @Published var error: PairingError?

    // 请求配对 (生成二维码)
    func requestPairing() async

    // 扫描二维码配对
    func pairWithQRCode(code: String) async

    // 配对码配对
    func pairWithCode(_ code: String) async

    // 解除配对
    func unpair(deviceId: String) async

    // 检查配对状态
    func checkPairingStatus() async
}

// 配对状态
enum PairingState {
    case idle
    case scanning
    case pairing
    case paired
    case failed(Error)
}
```

#### 二维码扫描

```swift
// 使用 CodeScanner (SwiftUI 封装)
import CodeScanner

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: PairingViewModel

    var body: some View {
        CodeScannerView(
            codeTypes: [.qr],
            scanMode: .continuous,
            showViewfinder: true
        ) { result in
            switch result {
            case .success(let scanResult):
                Task {
                    await viewModel.pairWithQRCode(scanResult.string)
                }
            case .failure(let error):
                viewModel.error = .scanFailed(error)
            }
        }
    }
}
```

#### WebSocket 配对协议

```
App → Server:
- app_register { userId, deviceId }
- request_pairing { userId }
- pair_with_code { code, deviceId }
- pair_with_token { token, deviceId }

Server → App:
- app_registered { success }
- pairing_code { code, expiresIn }
- pairing_token { token, qrUrl }
- pairing_success { success, pairingId }
- error { code, message }
```

### 3.6 地图/拍照模块 (Map & Snapshot)

#### 功能列表
- 地图显示 (MapKit)
- 当前位置定位
- 附近地点标记
- 拍照功能
- 相册选择
- 图片上传
- 拍照列表

#### 实现细节

```swift
// 地图 ViewModel
@MainActor
class MapViewModel: ObservableObject {
    @Published var region = MKCoordinateRegion()
    @Published var locations: [Location] = []
    @Published var userLocation: CLLocation?
    @Published var isLoading = false

    // 获取当前位置
    func requestLocationPermission() async -> Bool
    func getCurrentLocation()

    // 加载附近地点
    func fetchNearbyLocations() async

    // 创建地点标记
    func createLocationMarker(at coordinate: CLLocationCoordinate2D, name: String) async
}

// 拍照 ViewModel
@MainActor
class SnapshotViewModel: ObservableObject {
    @Published var capturedImages: [Snapshot] = []
    @Published var isCapturing = false
    @Published var cameraState: CameraState = .notAuthorized

    // 拍照
    func capturePhoto() async throws -> UIImage

    // 选择相册
    func pickFromGallery() async throws -> UIImage

    // 上传图片
    func uploadImage(_ image: UIImage) async throws -> String

    // 删除拍照记录
    func deleteSnapshot(id: String) async
}

// 相机状态
enum CameraState {
    case notAuthorized
    case authorized
    case capturing
}
```

### 3.7 个人中心模块 (Profile)

#### 功能列表
- 个人资料查看/编辑
- 头像上传
- 积分显示
- 积分历史
- 设置页面
- 登出

#### 实现细节

```swift
// 个人中心 ViewModel
@MainActor
class ProfileViewModel: ObservableObject {
    @Published var user: User?
    @Published var pointsStats: UserPointsStats?
    @Published var pointsHistory: [PointsTransaction] = []
    @Published var isLoading = false

    // 加载用户资料
    func loadProfile() async

    // 更新资料
    func updateProfile(_ updates: ProfileUpdate) async throws

    // 上传头像
    func uploadAvatar(_ image: UIImage) async throws -> String

    // 加载积分
    func loadPointsStats() async

    // 加载积分历史
    func loadPointsHistory() async
}

// 积分统计
struct UserPointsStats: Codable {
    let totalPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int
}

// 积分记录
struct PointsTransaction: Codable, Identifiable {
    let id: String
    let pointsChange: Int
    let type: TransactionType
    let description: String
    let balanceAfter: Int
    let createdAt: Date
}

enum TransactionType: String, Codable {
    case studyComplete = "study_complete"
    case studyStreak = "study_streak"
    case dailyLogin = "daily_login"
    case achievement = "achievement"
    case socialShare = "social_share"
    case redeem = "redeem"
    case adminAdjust = "admin_adjust"
}
```

### 3.8 通知推送模块

#### 通知类型

| 类型 | 发送方式 | 触发条件 |
|------|----------|----------|
| 新消息 | APNs 远程 | 服务器推送 |
| 配对成功 | APNs 远程 | 服务器推送 |
| 学习提醒 | 本地 | 用户设置定时 |
| 专注完成 | 本地 | 计时器结束 |

#### 实现

```swift
class PushNotificationService {
    // 注册远程通知
    func registerForRemoteNotifications()

    // 获取设备 Token
    func getDeviceToken() -> String?

    // 保存 Token 到服务器
    func saveDeviceToken(_ token: String) async

    // 处理收到远程通知
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any])
}
```

---

## 4. 项目结构

```
TRIX3DCompanion/
├── App/
│   ├── TRIX3DCompanionApp.swift      # App 入口
│   ├── AppDelegate.swift              # 推送代理
│   ├── ContentView.swift              # 根视图
│   └── AppState.swift                 # 全局状态
│
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift            # HTTP 客户端
│   │   ├── APIEndpoints.swift         # API 端点定义
│   │   ├── WebSocketManager.swift      # WebSocket 管理
│   │   └── NetworkError.swift          # 网络错误
│   │
│   ├── Storage/
│   │   ├── KeychainManager.swift       # Keychain 封装
│   │   ├── UserDefaultsManager.swift   # UserDefaults 封装
│   │   └── DatabaseManager.swift       # SQLite 封装
│   │
│   └── Services/
│       ├── AuthService.swift           # 认证服务
│       ├── ChatService.swift           # 聊天服务
│       ├── StudyService.swift          # 学习服务
│       ├── LocationService.swift       # 位置服务
│       ├── NotificationService.swift   # 通知服务
│       ├── AudioService.swift          # 音频服务
│       └── OSSService.swift            # 文件上传
│
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   │   ├── LoginView.swift
│   │   │   ├── RegisterView.swift
│   │   │   └── AuthRootView.swift
│   │   └── ViewModels/
│   │       └── AuthViewModel.swift
│   │
│   ├── Home/
│   │   ├── Views/
│   │   │   ├── HomeView.swift
│   │   │   ├── Hero3DView.swift
│   │   │   └── GlassDockView.swift
│   │   └── ViewModels/
│   │       └── HomeViewModel.swift
│   │
│   ├── Chat/
│   │   ├── Views/
│   │   │   ├── ChatListView.swift
│   │   │   ├── ChatDetailView.swift
│   │   │   ├── MessageCell.swift
│   │   │   ├── VoiceMessageView.swift
│   │   │   ├── ImageMessageView.swift
│   │   │   └── InputBarView.swift
│   │   └── ViewModels/
│   │       ├── ChatListViewModel.swift
│   │       └── ChatDetailViewModel.swift
│   │
│   ├── Study/
│   │   ├── Views/
│   │   │   ├── StudyView.swift
│   │   │   ├── StudyTimerView.swift
│   │   │   ├── StudyStatsView.swift
│   │   │   └── StudySummaryView.swift
│   │   └── ViewModels/
│   │       └── StudyViewModel.swift
│   │
│   ├── Pairing/
│   │   ├── Views/
│   │   │   ├── PairingView.swift
│   │   │   ├── QRScannerView.swift
│   │   │   └── PairedDevicesView.swift
│   │   └── ViewModels/
│   │       └── PairingViewModel.swift
│   │
│   ├── Map/
│   │   ├── Views/
│   │   │   ├── MapView.swift
│   │   │   ├── PlaceDetailView.swift
│   │   │   └── SnapshotCameraView.swift
│   │   └── ViewModels/
│   │       └── MapViewModel.swift
│   │
│   └── Profile/
│       ├── Views/
│       │   ├── ProfileView.swift
│       │   ├── EditProfileView.swift
│       │   ├── PointsHistoryView.swift
│       │   └── SettingsView.swift
│       └── ViewModels/
│           └── ProfileViewModel.swift
│
├── Shared/
│   ├── Models/
│   │   ├── User.swift
│   │   ├── ChatMessage.swift
│   │   ├── ChatRoom.swift
│   │   ├── StudySession.swift
│   │   ├── StudyRoom.swift
│   │   ├── Location.swift
│   │   ├── Snapshot.swift
│   │   ├── Points.swift
│   │   └── Device.swift
│   │
│   ├── Extensions/
│   │   ├── Color+Theme.swift
│   │   ├── View+Extensions.swift
│   │   ├── Date+Extensions.swift
│   │   └── String+Extensions.swift
│   │
│   ├── Components/
│   │   ├── GlassCard.swift
│   │   ├── PrimaryButton.swift
│   │   ├── SecondaryButton.swift
│   │   ├── AvatarView.swift
│   │   ├── LoadingView.swift
│   │   ├── ErrorView.swift
│   │   ├── EmptyStateView.swift
│   │   └── ConfirmDialog.swift
│   │
│   ├── Theme/
│   │   ├── Theme.swift
│   │   ├── Colors.swift
│   │   └── Typography.swift
│   │
│   └── Constants/
│       ├── AppConstants.swift
│       └── APIConstants.swift
│
└── Resources/
    ├── Assets.xcassets/
    │   ├── AppIcon.appiconset/
    │   ├── AccentColor.colorset/
    │   ├── LaunchBackground.colorset/
    │   └── Images/
    │
    ├── Localizable.strings (zh)
    ├── Localizable.strings (en)
    └── Info.plist
```

---

## 5. API 接口定义

### 5.1 Base URL

```
开发环境: http://TRIX_SERVER_HOST:8765
生产环境: https://api.trix3d.com (待配置)

WebSocket: ws://TRIX_SERVER_HOST:8765
```

### 5.2 认证接口

| 接口 | 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|------|
| `/auth/login` | POST | LoginRequest | UserSession | 邮箱登录 |
| `/auth/register` | POST | RegisterRequest | User | 注册 |
| `/auth/logout` | POST | - | - | 登出 |
| `/auth/refresh` | POST | {token} | UserSession | 刷新Token |
| `/auth/me` | GET | - | User | 当前用户 |

### 5.3 用户接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/user/profile` | GET | 获取用户资料 |
| `/user/profile` | PUT | 更新用户资料 |
| `/user/avatar` | POST | 上传头像 |
| `/user/stats` | GET | 获取用户统计 |
| `/user/settings` | GET/PUT | 用户设置 |

### 5.4 聊天接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/chat/rooms` | GET | 获取聊天列表 |
| `/chat/rooms` | POST | 创建聊天房间 |
| `/chat/rooms/{id}` | GET | 获取房间详情 |
| `/chat/rooms/{id}/messages` | GET | 获取历史消息 |
| `/chat/rooms/{id}/messages` | POST | 发送消息 |

### 5.5 学习接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/study/sessions` | GET | 学习记录 |
| `/study/sessions` | POST | 开始学习 |
| `/study/sessions/{id}` | PUT | 结束学习 |
| `/study/stats` | GET | 学习统计 |

### 5.6 配对接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/pairing/request` | POST | 请求配对 |
| `/pairing/status/{requestId}` | GET | 查询配对状态 |
| `/pairing/confirm` | POST | 确认配对 |
| `/pairing/devices` | GET | 已配对设备列表 |
| `/pairing/devices/{id}` | DELETE | 解除配对 |

### 5.7 积分接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/points` | GET | 积分统计 |
| `/points/history` | GET | 积分记录 |

### 5.8 文件上传

| 接口 | 方法 | 说明 |
|------|------|------|
| `/upload` | POST | 文件上传 |
| `/upload/base64` | POST | Base64 上传 |

### 5.9 位置/拍照

| 接口 | 方法 | 说明 |
|------|------|------|
| `/locations` | GET | 附近位置 |
| `/locations` | POST | 创建位置 |
| `/snapshots` | GET | 拍照列表 |
| `/snapshots` | POST | 上传拍照 |

### 5.10 WebSocket 事件

```
连接地址: ws://TRIX_SERVER_HOST:8765

App → Server:
- app_register { userId, deviceId }
- request_pairing
- pair_with_code { code, deviceId }
- pair_with_token { token, deviceId }
- app_message { content, contentType, messageId }
- unpair

Server → App:
- app_registered
- pairing_code / pairing_token
- pairing_success
- bot_message
- bot_online / bot_offline
- message_sent
- unpaired
- error
```

---

## 6. 数据模型

### 6.1 User

```swift
struct User: Codable, Identifiable {
    let id: String
    let username: String
    let email: String?
    let avatarUrl: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let points: Int
    let isStudying: Bool
    let companionId: String?
    let totalStudyTime: Int // 分钟
    let createdAt: Date
    let updatedAt: Date
}

struct UserSession: Codable {
    let id: String
    let userId: String
    let sessionToken: String
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
}
```

### 6.2 Chat

```swift
struct ChatRoom: Codable, Identifiable {
    let id: String
    let name: String
    let type: ChatRoomType
    let participants: [User]
    let lastMessage: ChatMessage?
    let unreadCount: Int
    let createdAt: Date
    let updatedAt: Date
}

enum ChatRoomType: String, Codable {
    case ai       // Clawbot AI 对话
    case group    // 群聊
    case privateChat = "private"  // 私聊
}
```

### 6.3 Study

```swift
struct StudySession: Codable, Identifiable {
    let id: String
    let userId: String
    let durationMinutes: Int
    let startedAt: Date
    let completedAt: Date?
    let earnedPoints: Int?
    let isCompleted: Bool
}

struct StudyStats: Codable {
    let totalDuration: Int       // 总学习时长(分钟)
    let sessionCount: Int        // 学习次数
    let averageDuration: Int      // 平均时长
    let streakDays: Int           // 连续学习天数
    let todayDuration: Int        // 今日时长
    let weekDuration: Int         // 本周时长
}
```

### 6.4 Pairing

```swift
struct PairedDevice: Codable, Identifiable {
    let id: String
    let deviceId: String
    let deviceName: String
    let deviceType: DeviceType
    let pairedAt: Date
    let isOnline: Bool
}

enum DeviceType: String, Codable {
    case mobile
    case desktop
    case tablet
    case web
}
```

---

## 7. 实现任务分解

### Phase 1: 基础架构 (Week 1-2)

#### Task 1.1: 项目初始化
- [ ] 创建 Xcode 项目 (XcodeGen)
- [ ] 配置 Swift Package Manager 依赖
- [ ] 配置 Info.plist 权限
- [ ] 配置 App Icons
- [ ] 创建项目目录结构

#### Task 1.2: 网络层
- [ ] 实现 APIClient (基于 Alamofire)
- [ ] 实现 APIEndpoints
- [ ] 实现 NetworkError
- [ ] 实现 WebSocketManager (基于 Starscream)

#### Task 1.3: 存储层
- [ ] 实现 KeychainManager
- [ ] 实现 UserDefaultsManager
- [ ] 实现 DatabaseManager (SQLite)

#### Task 1.4: 认证服务
- [ ] 实现 AuthService (Supabase)
- [ ] 实现 Apple 登录
- [ ] 实现 Token 刷新机制

#### Task 1.5: App 入口与导航
- [ ] 实现 TRIX3DCompanionApp
- [ ] 实现 AppState
- [ ] 实现 ContentView
- [ ] 实现 TabBar 导航

**Phase 1 交付**: 登录界面可运行

---

### Phase 2: 核心功能 (Week 3-4)

#### Task 2.1: 首页
- [ ] 实现 HomeView
- [ ] 实现 Hero3DView (占位图)
- [ ] 实现 GlassDockView

#### Task 2.2: AI 聊天
- [ ] 实现 ChatService
- [ ] 实现 ChatListView
- [ ] 实现 ChatDetailView
- [ ] 实现 MessageCell
- [ ] 实现文字消息发送/接收

#### Task 2.3: 语音消息
- [ ] 实现 AudioService
- [ ] 实现 VoiceMessageView
- [ ] 实现录音功能
- [ ] 实现语音播放功能
- [ ] 实现语音消息发送/接收

#### Task 2.4: 图片消息
- [ ] 实现图片选择器
- [ ] 实现图片压缩
- [ ] 实现 ImageMessageView
- [ ] 实现图片上传

**Phase 2 交付**: 聊天功能可运行

---

### Phase 3: 学习模块 (Week 5)

#### Task 3.1: 计时器
- [ ] 实现 StudyTimerViewModel
- [ ] 实现 StudyTimerView
- [ ] 实现番茄钟逻辑

#### Task 3.2: 学习统计
- [ ] 实现 StudyStatsView
- [ ] 实现学习数据持久化
- [ ] 实现积分计算

#### Task 3.3: 通知
- [ ] 实现 NotificationService
- [ ] 实现本地通知
- [ ] 配置通知权限

**Phase 3 交付**: 学习计时功能可运行

---

### Phase 4: 配对与设备 (Week 6)

#### Task 4.1: 配对服务
- [ ] 实现配对 WebSocket 逻辑
- [ ] 实现配对状态管理

#### Task 4.2: 二维码扫描
- [ ] 实现 QRScannerView
- [ ] 实现配对流程

#### Task 4.3: 设备管理
- [ ] 实现 PairedDevicesView
- [ ] 实现解除配对

**Phase 4 交付**: 配对功能可运行

---

### Phase 5: 地图与拍照 (Week 7)

#### Task 5.1: 地图
- [ ] 实现 MapView
- [ ] 实现 LocationService
- [ ] 实现 CoreLocation 权限

#### Task 5.2: 拍照
- [ ] 实现 CameraView
- [ ] 实现 PhotoLibraryView
- [ ] 实现图片上传

**Phase 5 交付**: 地图拍照功能可运行

---

### Phase 6: 个人中心 (Week 8)

#### Task 6.1: 个人资料
- [ ] 实现 ProfileView
- [ ] 实现 EditProfileView
- [ ] 实现头像上传

#### Task 6.2: 积分系统
- [ ] 实现 PointsHistoryView
- [ ] 实现积分展示

#### Task 6.3: 设置
- [ ] 实现 SettingsView
- [ ] 实现通知设置

**Phase 6 交付**: 个人中心功能可运行

---

### Phase 7: 优化与发布 (Week 9-10)

#### Task 7.1: 离线支持
- [ ] 实现消息缓存 (SQLite)
- [ ] 实现离线查看

#### Task 7.2: 推送通知
- [ ] 实现 APNs 配置
- [ ] 实现远程推送

#### Task 7.3: 深色模式
- [ ] 实现颜色系统适配
- [ ] 测试深色/浅色切换

#### Task 7.4: 多语言
- [ ] 创建 Localizable.strings
- [ ] 实现中英文切换

#### Task 7.5: 性能优化
- [ ] 图片缓存优化
- [ ] 列表懒加载
- [ ] 内存优化

#### Task 7.6: 发布
- [ ] 创建 App Store 描述
- [ ] 配置 Xcode 证书
- [ ] 打包上传

**Phase 7 交付**: 完整 App 可提交 App Store

---

## 8. 里程碑计划

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1: 项目初始化 | Week 1 | 项目骨架、可运行登录界面 |
| M2: 聊天功能 | Week 3-4 | 完整聊天功能（文字/图片/语音） |
| M3: 学习计时 | Week 5 | 番茄钟、统计、通知 |
| M4: 配对功能 | Week 6 | 二维码配对、设备管理 |
| M5: 地图拍照 | Week 7 | MapKit、相机功能 |
| M6: 个人中心 | Week 8 | 资料、积分、设置 |
| M7: 完成优化 | Week 9-10 | 离线、深色模式、多语言、提交 |

---

## 9. 依赖库清单

### Swift Package Manager

```swift
dependencies: [
    // Supabase
    .package(url: "https://github.com/supabase-community/supabase-swift.git", from: "1.0.0"),

    // 网络
    .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
    .package(url: "https://github.com/daltoniam/Starscream.git", from: "4.0.0"),

    // 图片
    .package(url: "https://github.com/onevcat/Kingfisher.git", from: "7.10.0"),

    // 安全存储
    .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.0"),

    // 本地数据库
    .package(url: "https://github.com/stephencelis/SQLite.swift.git", from: "0.14.0"),

    // 二维码扫描
    .package(url: "https://github.com/twostraws/CodeScanner.git", from: "2.0.0"),
]
```

---

## 10. 配置文件

### Info.plist 权限

```xml
<!-- 相机 -->
<key>NSCameraUsageDescription</key>
<string>需要相机权限来扫描二维码和拍照</string>

<!-- 麦克风 -->
<key>NSMicrophoneUsageDescription</key>
<string>需要麦克风权限来录制语音消息</string>

<!-- 位置 -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>需要位置权限来显示地图和位置分享</string>

<!-- 相册 -->
<key>NSPhotoLibraryUsageDescription</key>
<string>需要相册权限来保存和选择照片</string>
```

### Capabilities

- Push Notifications
- Sign in with Apple
- Background Modes: fetch, remote-notification

---

**文档版本**: 3.0
**最后更新**: 2026-02-26

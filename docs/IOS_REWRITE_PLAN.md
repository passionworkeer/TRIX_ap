# TRIX 3D Companion iOS 重写计划

## 1. 项目概述

### 1.1 目标
将现有的 Web 前端应用完全重写为 iOS 原生应用，使用 Swift/SwiftUI 开发。

### 1.2 约束条件
- iOS 16.0+ (最新特性支持)
- 仅支持 iPhone (不支持 iPad)
- 独立项目，不与 Web 版合并

---

## 2. 功能模块对照表

| Web 模块 | iOS 实现 | 优先级 |
|---------|---------|-------|
| Auth (登录/注册) | SwiftUI View + Keychain | P0 |
| Home (首页) | TabBar + NavigationStack | P0 |
| Chat (聊天列表) | SwiftUI List | P0 |
| ChatDetail (对话) | WebSocket + 语音录制 | P0 |
| Study (学习房间) | 计时器 + 本地通知 | P0 |
| Map (地图) | MapKit + CoreLocation | P1 |
| Snapshot (拍照) | AVFoundation 相机 | P1 |
| Pairing (设备配对) | AVFoundation 二维码扫描 | P1 |
| Profile (个人中心) | SwiftUI Form | P1 |
| Points (积分系统) | SwiftUI Charts | P2 |

---

## 3. 技术栈选型

### 3.1 框架与语言
| 类别 | 选型 | 版本 |
|------|------|------|
| UI 框架 | SwiftUI | iOS 16+ |
| 语言 | Swift | 5.9+ |
| 最低系统 | iOS | 16.0 |
| Xcode | Latest | 15+ |

### 3.2 依赖管理
- **Swift Package Manager** (首选)
- **CocoaPods** (备选)

### 3.3 核心依赖库
| 库名 | 用途 | 版本 |
|------|------|------|
| Alamofire | HTTP 网络请求 | 5.8+ |
| Starscream | WebSocket 实时通讯 | 4.0+ |
| Kingfisher | 图片加载与缓存 | 7.10+ |
| KeychainAccess | 安全存储 Token | 4.2+ |
| SQLite.swift | 本地结构化数据 | 0.14+ |

---

## 4. 项目架构

### 4.1 目录结构
```
TRIX3DCompanion/
├── App/
│   ├── TRIX3DCompanionApp.swift      # App 入口
│   ├── AppDelegate.swift             # 推送通知代理
│   └── ContentView.swift              # 根视图
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift            # HTTP 客户端封装
│   │   ├── APIEndpoints.swift         # API 端点定义
│   │   ├── WebSocketManager.swift     # WebSocket 管理
│   │   └── NetworkError.swift         # 网络错误类型
│   ├── Storage/
│   │   ├── KeychainManager.swift      # Keychain 封装
│   │   ├── UserDefaultsManager.swift  # UserDefaults 封装
│   │   └── DatabaseManager.swift      # SQLite 封装
│   └── Services/
│       ├── AuthService.swift          # 认证服务
│       ├── ChatService.swift          # 聊天服务
│       ├── StudyService.swift         # 学习服务
│       ├── OSSService.swift          # 阿里云 OSS
│       └── LocationService.swift      # 位置服务
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   │   ├── LoginView.swift
│   │   │   ├── RegisterView.swift
│   │   │   └── AuthRootView.swift
│   │   └── ViewModels/
│   │       └── AuthViewModel.swift
│   ├── Home/
│   │   ├── Views/
│   │   │   ├── HomeView.swift
│   │   │   └── HomeTabView.swift
│   │   └── ViewModels/
│   │       └── HomeViewModel.swift
│   ├── Chat/
│   │   ├── Views/
│   │   │   ├── ChatListView.swift
│   │   │   ├── ChatDetailView.swift
│   │   │   ├── MessageCell.swift
│   │   │   ├── VoiceMessageView.swift
│   │   │   └── ImageMessageView.swift
│   │   └── ViewModels/
│   │       ├── ChatListViewModel.swift
│   │       └── ChatDetailViewModel.swift
│   ├── Study/
│   │   ├── Views/
│   │   │   ├── StudyRoomView.swift
│   │   │   ├── StudyListView.swift
│   │   │   ├── TimerView.swift
│   │   │   └── StudyStatsView.swift
│   │   └── ViewModels/
│   │       ├── StudyRoomViewModel.swift
│   │       └── StudyStatsViewModel.swift
│   ├── Map/
│   │   ├── Views/
│   │   │   ├── MapView.swift
│   │   │   └── PlaceDetailView.swift
│   │   └── ViewModels/
│   │       └── MapViewModel.swift
│   ├── Snapshot/
│   │   ├── Views/
│   │   │   ├── SnapshotView.swift
│   │   │   ├── CameraView.swift
│   │   │   └── SnapshotListView.swift
│   │   └── ViewModels/
│   │       └── SnapshotViewModel.swift
│   ├── Pairing/
│   │   ├── Views/
│   │   │   ├── PairingView.swift
│   │   │   └── QRScannerView.swift
│   │   └── ViewModels/
│   │       └── PairingViewModel.swift
│   └── Profile/
│       ├── Views/
│       │   ├── ProfileView.swift
│       │   ├── EditProfileView.swift
│       │   └── PointsHistoryView.swift
│       └── ViewModels/
│           └── ProfileViewModel.swift
├── Shared/
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Message.swift
│   │   ├── ChatRoom.swift
│   │   ├── StudySession.swift
│   │   ├── Location.swift
│   │   └── Points.swift
│   ├── Extensions/
│   │   ├── Color+Theme.swift
│   │   ├── View+Extensions.swift
│   │   ├── Date+Extensions.swift
│   │   └── String+Extensions.swift
│   ├── Components/
│   │   ├── LoadingView.swift
│   │   ├── ErrorView.swift
│   │   ├── AvatarView.swift
│   │   ├── GlassPanel.swift
│   │   └── ConfirmDialog.swift
│   ├── Theme/
│   │   ├── Theme.swift
│   │   ├── Colors.swift
│   │   └── Typography.swift
│   └── Constants/
│       └── AppConstants.swift
├── Resources/
│   ├── Assets.xcassets/
│   │   ├── AppIcon.appiconset/
│   │   ├── AccentColor.colorset/
│   │   └── Images/
│   ├── Localizable.strings (zh)
│   ├── Localizable.strings (en)
│   └── LaunchScreen.storyboard
└── Supporting Files/
    ├── Info.plist
    └── TRIX3DCompanion.entitlements
```

### 4.2 架构模式: MVVM

```
View (SwiftUI) ←→ ViewModel (@Observable) ←→ Model (Codable)
                            ↓
                     Services (API/Storage)
```

---

## 5. 数据模型 (从 TypeScript 转换)

### 5.1 User
```swift
struct User: Codable, Identifiable {
    let id: String
    let username: String
    let email: String?
    let avatarUrl: String?
    let points: Int
    let createdAt: Date
}
```

### 5.2 Message
```swift
struct Message: Codable, Identifiable {
    let id: String
    let roomId: String
    let senderId: String
    let content: String
    let type: MessageType // text, image, voice
    let mediaUrl: String?
    let duration: Int? // 语音时长(秒)
    let createdAt: Date
}
```

### 5.3 ChatRoom
```swift
struct ChatRoom: Codable, Identifiable {
    let id: String
    let name: String
    let type: ChatRoomType // ai, group, private
    let participants: [User]
    let lastMessage: Message?
    let updatedAt: Date
}
```

### 5.4 StudySession
```swift
struct StudySession: Codable, Identifiable {
    let id: String
    let userId: String
    let startTime: Date
    let endTime: Date?
    let duration: Int // 秒
    let subject: String?
    let isCompleted: Bool
}
```

---

## 6. API 接口对接

### 6.1 认证接口
| 接口 | 方法 | 说明 |
|------|------|------|
| /auth/login | POST | 登录 |
| /auth/register | POST | 注册 |
| /auth/logout | POST | 登出 |
| /auth/refresh | POST | 刷新 Token |

### 6.2 聊天接口
| 接口 | 方法 | 说明 |
|------|------|------|
| /chat/rooms | GET | 获取聊天列表 |
| /chat/rooms/{id}/messages | GET | 获取历史消息 |
| /chat/rooms/{id}/messages | POST | 发送消息 |
| ws/chat | WebSocket | 实时消息 |

### 6.3 学习接口
| 接口 | 方法 | 说明 |
|------|------|------|
| /study/sessions | GET | 学习记录 |
| /study/sessions | POST | 开始学习 |
| /study/sessions/{id} | PUT | 结束学习 |
| /study/stats | GET | 学习统计 |

### 6.4 其他接口
| 接口 | 方法 | 说明 |
|------|------|------|
| /user/profile | GET/PUT | 用户资料 |
| /user/points | GET | 积分查询 |
| /points/history | GET | 积分记录 |
| /locations | GET | 附近位置 |
| /snapshot | POST | 上传拍照 |

---

## 7. 关键功能实现

### 7.1 实时聊天
- 使用 Starscream 连接 WebSocket
- 消息类型：文字、图片、语音
- 语音录制：AVAudioRecorder
- 图片压缩：UIImage 压缩
- 离线消息：本地 SQLite 缓存

### 7.2 学习计时
- 计时器：Timer + background task
- 本地通知：UNUserNotificationCenter
- 数据同步：退出会话时上传

### 7.3 二维码配对
- 扫描：AVCaptureSession
- 生成：CIFilter (QR Code)
- 配对逻辑：与后端 API 交互

### 7.4 地图与拍照
- 地图：MapKit + MKMapView
- 定位：CoreLocation
- 相机：UIImagePickerController / AVCaptureSession
- 图片上传：Alamofire 上传到 OSS

---

## 8. 多语言支持

### 8.1 支持语言
- 中文 (zh-Hans) - 默认
- 英文 (en)

### 8.2 实现方式
- SwiftUI 的 `Text` 组件支持 Localization
- `Localizable.strings` 文件
- 用户系统设置自动识别

### 8.3 待翻译内容
- 所有 UI 文字
- 错误提示
- 推送通知文案

---

## 9. 推送通知

### 9.1 通知类型
- 新消息提醒
- 学习提醒
- 配对成功通知
- 积分变动通知

### 9.2 实现
- APNs (Apple Push Notification service)
- 设备 Token 注册
- 通知权限请求
- 后台静默推送

---

## 10. 深色模式

### 10.1 实现方式
- SwiftUI 自动支持 `@Environment(\.colorScheme)`
- 定义 Theme Colors 适配 light/dark
- 系统设置自动切换

### 10.2 需要适配的颜色
- 主色调 (Primary)
- 背景色 (Background)
- 文字颜色 (Text)
- 分割线 (Separator)
- 卡片背景 (Card)

---

## 11. 实现顺序

### Phase 1: 基础架构 (第1-2周)
1. Xcode 项目创建与配置
2. 依赖库集成 (SPM)
3. 基础目录结构
4. 网络层 (APIClient, WebSocket)
5. 存储层 (Keychain, UserDefaults)
6. 认证流程 (登录/注册)

### Phase 2: 核心功能 (第3-4周)
1. 主界面 (TabBar + Navigation)
2. 聊天列表与详情
3. 消息收发 (文字/图片)
4. 语音录制与播放

### Phase 3: 学习模块 (第5周)
1. 学习房间列表
2. 计时器功能
3. 学习统计
4. 本地通知提醒

### Phase 4: 设备功能 (第6周)
1. 二维码扫描配对
2. 地图显示
3. 拍照功能
4. 位置分享

### Phase 5: 个人中心 (第7周)
1. 个人资料
2. 积分系统
3. 设置页面

### Phase 6: 优化与发布 (第8周)
1. 深色模式
2. 多语言
3. 性能优化
4. App Store 提交

---

## 12. 资源需求

### 12.1 App 图标
- 1024x1024 App Store 图标
- 各尺寸 iPhone 图标

### 12.2 启动页
- LaunchScreen.storyboard
- 适配各屏幕尺寸

### 12.3 图片资源
- TabBar 图标
- 占位图
- 空状态图

---

## 13. 待确认问题

- [x] iOS 版本: 16.0+
- [x] 设备: 仅 iPhone
- [x] 深色模式: 需要
- [x] 推送通知: 需要
- [x] 多语言: 中英文
- [x] App 图标: 用户提供
- [x] 启动页: 暂用占位符

---

## 15. 后端服务配置

### 15.1 现有服务复用
| 服务 | 地址 | 复用方式 |
|------|------|---------|
| Clawbot Channel Server | `47.243.55.130:8765` | HTTP API + WebSocket |
| Supabase | `*.supabase.co` | 认证 + 数据库 + Realtime |
| 豆包 TTS | HTTP API | 继续调用 API |

### 15.2 Apple 登录配置
- 需要在 Apple Developer 后台创建 App ID 并启用 Sign in with Apple
- 后端需要验证 Apple ID Token
- iOS 端使用 AuthenticationServices 框架

### 15.3 推送通知配置
- APNs 证书配置（开发/生产）
- 推送场景：
  - 新消息提醒
  - 学习专注提醒
  - 配对成功通知
  - 积分变动通知

---

## 16. 环境变量配置

```swift
// Info.plist 配置
struct APIConfig {
    static let supabaseURL = "https://xxx.supabase.co"
    static let supabaseAnonKey = "xxx"
    static let channelURL = "ws://47.243.55.130:8765"
    static let ttsAPIURL = "https://xxx"
}
```

---

## 17. UI 设计规范

### 17.1 风格定位
- **框架**: iOS 原生 SwiftUI
- **效果**: 复刻 Web 版的视觉风格
  - 紫粉渐变背景
  - 毛玻璃效果 (Material)
  - Kuromi 风格装饰元素

### 17.2 颜色系统
```swift
// 主色调 - 紫粉渐变
static let primaryGradient = LinearGradient(
    colors: [Color.purple, Color.pink],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

// 毛玻璃
struct GlassModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
```

---

**计划版本**: 2.0
**更新日期**: 2026-02-26

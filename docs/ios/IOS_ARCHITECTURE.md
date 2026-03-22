# iOS 架构

> **最后更新**: 2026-03-22
> **技术栈**: Swift 5.9 + SwiftUI + XcodeGen + SPM
> **部署目标**: iOS 18.0
> **代码量**: 328 Swift 文件

---

## 1. 架构概览

```text
SwiftUI Views
   ▼
ClawbotChannelViewModel
   ▼
ClawbotChannelService
   ├─ claim pairing (REST)
   ├─ user websocket (URLSessionWebSocketTask)
   ├─ messages (REST)
   └─ uploads (REST)
        ▼
    TRIX Native Server (https://trix.love 或 http://TRIX_SERVER_HOST:8788)
```

> **命名说明**：iOS 代码中使用 **"ClawbotChannel"** 作为命名别名，等同于文档中的 **"TRIX Native Channel"**。两者是同一套协议实现。

---

## 2. 项目结构

```
ios/TRIX3DCompanion/
├── App/                         # App 入口、状态管理
│   ├── TRIX3DCompanionApp.swift
│   └── AppState.swift
│
├── Core/                        # 核心基础设施
│   ├── Analytics/               # 错误跟踪、性能监控、内存泄漏检测
│   ├── Cache/                  # 图像缓存（Kingfisher）
│   ├── Config/                 # Supabase 配置
│   ├── Design/                  # 设计系统
│   ├── Network/                # APIClient、AuthInterceptor、SSL pinning
│   ├── Performance/             # UI 渲染优化、电池消耗
│   ├── Services/               # 60+ 服务文件（Protocol + Implementation）
│   ├── Storage/                # DatabaseManager（SQLite.swift）、KeychainManager
│   ├── Utilities/              # SecureLogger、InputValidator
│   ├── Utils/                  # 坐标转换等
│   └── Video/                  # 视频播放器
│
├── Features/                   # 14 个功能模块
│   ├── Auth/                   # 登录、注册
│   ├── Chat/                   # 聊天详情、消息气泡、语音消息
│   ├── Home/                   # 主 Tab、首页、聊天列表
│   ├── Map/                    # 地图、位置选择
│   ├── Pairing/                # 配对视图、QR 扫描（ClawbotChannel）
│   ├── Profile/                # 个人资料、设置、隐私
│   ├── Snapshot/               # 相机、快照列表
│   ├── Store/                  # 商城、支付
│   ├── Study/                  # 自习室、专注计时器
│   ├── Voice/                  # TTS、语音播放
│   ├── Workbench/              # 待办、日程
│   ├── Diagnostic/             # 诊断工具
│   └── Data/                   # 本地持久化示例
│
├── Shared/                    # 跨模块共享
│   ├── Components/             # 可复用 UI 组件
│   ├── Extensions/              # Swift 扩展
│   ├── Models/                 # 共享数据模型
│   └── Theme/                  # 颜色、字体主题
│
├── Resources/                  # 资源文件、本地化
│   ├── Assets.xcassets
│   ├── en.lproj / zh-Hans.lproj / zh-Hant.lproj
│   └── Info.plist
│
├── Config/                     # 配置文件
├── Security/                   # 安全配置
├── PushNotifications/          # 推送通知
├── AppStore/                   # App Store 提交文档
├── Tests/                      # 单元测试 + UI 测试
│
├── project.yml                 # XcodeGen 配置
├── Podfile                    # CocoaPods（为空，使用 SPM）
└── TRIX3DCompanion.xcodeproj/
```

---

## 3. XcodeGen 配置

**文件**: `ios/TRIX3DCompanion/project.yml`

```yaml
name: TRIX3DCompanion
options:
  bundleIdPrefix: com.trix3d
  deploymentTarget:
    iOS: "18.0"
  xcodeVersion: "15.0"

settings:
  SWIFT_VERSION: "5.9"

targets:
  TRIX3DCompanion:
    type: application
    platform: iOS
    sources: [App, Core, Features, Shared, Resources]
```

---

## 4. 依赖管理

### Swift Package Manager（主要）

| 包 | 用途 | 状态 |
|----|------|------|
| Supabase | 认证、数据库 | ✅ 活跃 |
| Alamofire | HTTP 网络 | ✅ 活跃 |
| Starscream | WebSocket | ⚠️ 可用但未使用（使用原生 URLSession） |
| Kingfisher | 图像缓存 | ✅ 活跃 |
| KeychainAccess | 安全存储 | ✅ 活跃 |
| SQLite.swift | 本地数据库 | ✅ 活跃 |
| CodeScanner | QR 扫描 | ✅ 活跃 |
| Firebase | 分析、性能监控 | ✅ 活跃 |
| Sentry | 错误跟踪 | ✅ 活跃 |
| SocketIO | WebSocket | ⚠️ 可用但未使用 |
| PopupView | UI 弹窗 | ✅ 活跃 |
| WhatsNewKit | 新功能提示 | ✅ 活跃 |
| ActivityIndicatorView | 加载指示 | ✅ 活跃 |

### CocoaPods

**状态**: Podfile 为空，**不使用 CocoaPods**，完全依赖 SPM。

---

## 5. 架构模式

### MVVM + Protocol

```swift
// View
@MainActor
struct PairingView: View {
    @StateObject var viewModel = ClawbotChannelViewModel.shared
    // ...
}

// ViewModel
@MainActor
final class ClawbotChannelViewModel: ObservableObject {
    @Published private(set) var isConnected: Bool = false
    @Published private(set) var connectionState: ClawbotConnectionState = .disconnected
    private let service = ClawbotChannelService.shared
}

// Service Protocol（依赖注入）
protocol ClawbotChannelServiceProtocol {
    func pairWithCode(_ code: String) async throws
    func pairWithQR(_ data: String) async throws
    // ...
}
```

### 单例服务

核心服务使用单例：
- `ClawbotChannelService.shared`
- `AuthService.shared`

---

## 6. TRIX Native Channel 实现

### ClawbotChannelService.swift（1170+ 行）

**架构**：
1. `NativeWebSocketClient` — URLSession WebSocket 适配器
2. `ChannelHTTPClient` — REST API 客户端
3. `ClawbotChannelService` — 主服务类

**服务器端点**：
```swift
// 生产
baseURL: "https://trix.love"

// 调试（UserDefaults 可配置）
baseURL: UserDefaults.standard.string(forKey: "clawbot.channel.url")
                ?? "http://TRIX_SERVER_HOST:8788"
```

### 支持的 QR 码格式

1. **URL 格式**: `https://trix.love/pair?code=ABC123&secret=xxx`
2. **JSON 格式**: `{ "claimUrl": "...", "serverUrl": "..." }`
3. **紧凑格式**: `ABC123:secret`
4. **纯配对码**: `ABC123`（6 字符）

### 配对流程

```
用户扫描/输入 → parseQRData() → POST /api/pairings/:code/claim
                                        ↓
                              handlePairingSuccess() 存储 Keychain
                                        ↓
                              WebSocket 连接建立
```

### QRScannerView.swift（536 行）

- 使用 CodeScanner 包
- 动画扫描线（渐变）
- 角落装饰
- 手电筒切换
- 权限处理
- 扫描成功震动反馈

### PairingView.swift（543 行）

四种状态：
- `.scan` — QR 扫描
- `.input` — 手动输入
- `.waiting` — 配对中
- `.success` — 配对成功

---

## 7. 本地化

支持三种语言：
- 英语 (`en.lproj`)
- 简体中文 (`zh-Hans.lproj`)
- 繁体中文 (`zh-Hant.lproj`)

所有用户可见字符串使用 `NSLocalizedString()`：
```swift
Text(L("pairing.scan.qr"))
Button(L("action.confirm"))
```

---

## 8. 安全特性

- Keychain 存储敏感凭证
- SSL Pinning（Network/AuthInterceptor）
- 越狱检测
- SecureLogger
- InputValidator

---

## 9. 已删除的旧方案

以下旧实现已从代码库中移除：
- 旧 relay 客户端
- 旧独立配对服务
- 旧 Gateway 私有协议层
- token-only pairing
- 旧私有二维码格式

---

**最后更新**: 2026-03-22

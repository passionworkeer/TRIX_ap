# TRIX 3D Companion - iOS 端产品需求文档

> **文档版本**: 1.0
> **最后更新**: 2026-03-19
> **产品**: TRIX 3D Companion iOS
> **平台**: iOS 16.0+
> **开发**: Xcode

---

## 1. 产品概述

### 1.1 产品定位

iOS 端是 TRIX 3D Companion 的**原生移动入口**，强调**随时随地**的沉浸式学习体验。通过原生性能、离线支持和 Push 通知，提供最佳移动端用户体验。

### 1.2 核心使用场景

| 场景 | 描述 |
|-----|------|
| 移动学习 | 随时随地启动番茄钟 |
| AI 陪伴 | 与 TRIX Bot 语音/文字交流 |
| 拍照分享 | 拍摄学习瞬间 |
| 位置打卡 | 图书馆/咖啡厅打卡 |
| 碎片学习 | 通勤时查看任务 |

---

## 2. 功能清单

### 2.1 已实现功能

| 模块 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| **认证** | Apple 登录 | P0 | ✅ |
| | 邮箱注册/登录 | P0 | ✅ |
| | Token 自动刷新 | P0 | ✅ |
| | 生物识别 | P1 | ✅ |
| **首页** | 3D 背景动画 | P0 | ✅ |
| | TRIX Bot 展示 | P0 | ✅ |
| | 快捷功能入口 | P0 | ✅ |
| | 邮件通知入口 | P1 | ✅ |
| **聊天** | 好友列表 | P0 | ✅ |
| | 实时聊天 | P0 | ✅ |
| | 消息历史 | P0 | ✅ |
| | 在线状态 | P0 | ✅ |
| | 语音消息录制 | P0 | ✅ |
| | 语音消息播放 | P0 | ✅ |
| | 图片消息 | P1 | ✅ |
| | AI 动作建议 | P1 | ✅ |
| **自习** | 番茄钟计时器 | P0 | ✅ |
| | 专注模式选择 | P0 | ✅ |
| | 学习统计 | P1 | ✅ |
| | 学习室 | P1 | ✅ |
| | 专注提醒 | P1 | ✅ |
| **好友** | 搜索添加好友 | P0 | ✅ |
| | 好友列表 | P0 | ✅ |
| | 在线状态 | P0 | ✅ |
| | 删除好友 | P1 | ✅ |
| **位置** | 地图展示 | P1 | ✅ |
| | 地点打卡 | P1 | ✅ |
| | 地点管理 | P1 | ✅ |
| | 好友位置 | P2 | 🔲 |
| **相机** | 拍照 | P0 | ✅ |
| | 照片保存 | P0 | ✅ |
| | 照片库选择 | P1 | ✅ |
| **商城** | 商品列表 | P1 | ✅ |
| | 积分展示 | P1 | ✅ |
| | 购买商品 | P2 | 🔲 |
| | 购买记录 | P2 | 🔲 |
| **衣柜** | 已拥有物品 | P1 | ✅ |
| | 装备物品 | P1 | ✅ |
| **配对** | QR 配对 | P0 | ✅ |
| | 6位码配对 | P0 | ✅ |
| | 配对状态管理 | P0 | ✅ |
| **任务** | 待办事项 | P1 | ✅ |
| | 日程管理 | P1 | ✅ |
| **个人** | 个人信息 | P0 | ✅ |
| | 学习统计 | P1 | ✅ |
| | 隐私设置 | P1 | ✅ |
| | 推送设置 | P1 | ✅ |
| **诊断** | 网络诊断 | P1 | ✅ |
| | 高级诊断 | P2 | ✅ |

### 2.2 规划中功能

| 模块 | 功能 | 优先级 |
|-----|------|--------|
| **相机** | AI 照片分析 | P2 |
| **离线** | 完整离线支持 | P1 |
| **通知** | 丰富 Push 通知 | P1 |
| **小组件** | iOS Widget | P2 |
| **快捷指令** | Siri 集成 | P2 |

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   TRIX3DCompanion                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │              App Layer                        │   │
│  │   (App, SceneDelegate)                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │           Presentation Layer                 │   │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │   │ Screens │ │Views    │ │Components│     │   │
│  │   └─────────┘ └─────────┘ └─────────┘     │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │            ViewModel Layer                    │   │
│  │   (ObservableObject, @Published)             │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │              Service Layer                   │   │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │   │  API    │ │  Auth   │ │ Location│     │   │
│  │   └─────────┘ └─────────┘ └─────────┘     │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │              Data Layer                       │   │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │
│  │   │Supabase│ │ Keychain│ │  GRDB   │     │   │
│  │   └─────────┘ └─────────┘ └─────────┘     │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 3.2 模块划分

```
TRIX3DCompanion/
├── App/                    # 应用入口
├── Features/               # 功能模块
│   ├── Auth/             # 认证
│   ├── Home/             # 首页
│   ├── Chat/             # 聊天
│   ├── Study/            # 学习
│   ├── Profile/          # 个人中心
│   ├── Map/              # 地图
│   ├── Pairing/          # 配对
│   ├── Snapshot/         # 相机
│   ├── Store/             # 商城
│   ├── Voice/            # 语音
│   ├── Wardrobe/         # 衣柜
│   ├── Workbench/        # 工作台
│   └── Diagnostic/       # 诊断
├── Core/                  # 核心
│   ├── Network/         # 网络
│   ├── Services/        # 服务
│   ├── Analytics/       # 分析
│   ├── Performance/     # 性能
│   └── Utilities/       # 工具
├── Shared/               # 共享
│   ├── Components/      # 组件
│   ├── Extensions/      # 扩展
│   ├── Models/          # 模型
│   └── Theme/           # 主题
└── Resources/           # 资源
```

---

## 4. 核心功能详述

### 4.1 认证系统

#### Apple 登录
- 使用 Sign in with Apple
- 获取用户 name 和 email
- 自动创建 Supabase 用户

#### Token 管理
- Access Token 存储在 Keychain
- Refresh Token 自动刷新
- 登出时清除所有 Token

### 4.2 AI 对话

#### 消息类型
- 文字消息
- 语音消息 (AVAudioRecorder)
- 图片消息

#### WebSocket
- 使用 Starscream 库
- 自动重连机制
- 心跳保活

#### AI 动作
- 学习建议
- 休息提醒
- 任务提醒

### 4.3 自习功能

#### 番茄钟
- 25/5 分钟循环
- 后台计时 (Background Tasks)
- 本地通知提醒

#### 统计
- 每日/每周/每月统计
- 数据可视化
- 积分计算

### 4.4 相机功能

#### 拍照
- AVFoundation 相机
- 前后摄像头切换
- 闪光灯控制

#### 照片处理
- 压缩处理
- 上传至 OSS
- 发送至聊天

---

## 5. 技术实现

### 5.1 网络层

| 组件 | 技术 |
|-----|------|
| HTTP Client | Alamofire |
| WebSocket | Starscream |
| GraphQL | 暂无 |

### 5.2 本地存储

| 数据 | 存储方案 |
|-----|---------|
| 用户 Token | Keychain |
| 用户信息 | UserDefaults |
| 离线数据 | SQLite (GRDB) |
| 图片缓存 | FileManager |

### 5.3 推送通知

| 类型 | 方案 |
|-----|------|
| 本地通知 | UNUserNotificationCenter |
| 远程通知 | APNs + Supabase |

### 5.4 性能优化

| 优化项 | 方案 |
|-----|------|
| 图片加载 | Kingfisher |
| 列表优化 | LazyVStack |
| 内存优化 | 懒加载 |
| 启动优化 | 启动图 + 增量加载 |

---

## 6. 页面结构

### 6.1 导航

```
TabView (主导航)
├── HomeTab
│   └── HomeView
├── ChatTab
│   ├── ChatListView
│   └── ChatDetailView
├── StudyTab
│   ├── StudyHomeView
│   └── StudyTimerView
├── MapTab
│   └── MapView
└── ProfileTab
    ├── ProfileView
    ├── WardrobeView
    └── SettingsView
```

### 6.2 模态页面

| 页面 | 触发方式 |
|-----|---------|
| PairingView | 设置入口 |
| QRCodePairingView | 配对页 |
| CameraView | 首页按钮 |
| PointsMallView | 商城入口 |
| SnapshotListView | 相册入口 |

---

## 7. 组件库

### 7.1 共享组件

| 组件 | 描述 |
|-----|------|
| AvatarView | 头像组件 |
| GlassPanel | 毛玻璃面板 |
| GradientButton | 渐变按钮 |
| LoadingView | 加载视图 |
| EmptyStateView | 空状态视图 |

### 7.2 自定义组件

| 组件 | 描述 |
|-----|------|
| ChatBubble | 聊天气泡 |
| VoiceRecorderButton | 录音按钮 |
| VoicePlayerView | 语音播放 |
| MapMarker | 地图标记 |
| StudyTimerView | 计时器视图 |

---

## 8. 数据模型

### 8.1 模型定义

```swift
// 用户
struct User {
    let id: String
    let email: String
    let username: String
    let avatarUrl: String?
    let points: Int
    let totalStudyTime: Int
}

// 消息
struct ChatMessage {
    let id: String
    let fromUserId: String
    let toUserId: String
    let content: String
    let type: MessageType
    let createdAt: Date
}

// 学习会话
struct StudySession {
    let id: String
    let userId: String
    let startTime: Date
    let duration: Int
    let points: Int
}

// 好友
struct Friend {
    let id: String
    let userId: String
    let friendId: String
    let status: FriendStatus
}
```

### 8.2 API 响应

```swift
// 统一响应格式
struct APIResponse<T> {
    let success: Bool
    let data: T?
    let error: Error?
}

// 分页响应
struct PaginatedResponse<T> {
    let data: [T]
    let page: Int
    let total: Int
}
```

---

## 9. 测试

### 9.1 测试类型

| 类型 | 框架 | 覆盖率目标 |
|-----|------|----------|
| 单元测试 | XCTest | 80% |
| UI 测试 | XCTest | 60% |
| E2E 测试 | XCUITest | 核心流程 |

### 9.2 测试模块

| 模块 | 测试用例 |
|-----|---------|
| AuthService | 登录、登出、Token 刷新 |
| ChatService | 消息发送、接收 |
| StudyService | 计时、统计 |
| LocationService | 定位、打卡 |
| PointsService | 积分计算 |

---

## 10. 部署

### 10.1 构建配置

```
Xcode: 15.0+
Swift: 5.9+
iOS: 16.0+
```

### 10.2 签名

- 自动签名
- Bundle ID: com.trixcompanion.app
- Team: OpenClaw

### 10.3 推送证书

- APNs 开发证书
- APNs 生产证书

---

## 11. 性能指标

### 11.1 启动性能

| 指标 | 目标 |
|-----|------|
| 冷启动 | < 2s |
| 热启动 | < 1s |
| 首屏渲染 | < 1.5s |

### 11.2 运行时性能

| 指标 | 目标 |
|-----|------|
| 内存使用 | < 150MB |
| CPU 占用 | < 30% |
| 电池消耗 | 低 |

### 11.3 网络性能

| 指标 | 目标 |
|-----|------|
| API 响应 | < 500ms |
| WebSocket 延迟 | < 100ms |
| 图片加载 | < 1s |

---

## 12. 未来规划

### 12.1 短期 (v1.x)

- [ ] 完整离线支持
- [ ] 丰富 Push 通知
- [ ] Widget 小组件

### 12.2 中期 (v2.x)

- [ ] Siri 快捷指令
- [ ] AR 场景
- [ ] 视频通话

### 12.3 长期 (v3.x)

- [ ] AI Agent 个性化
- [ ] Apple Vision Pro 支持
- [ ] 跨设备协同

---

## 13. 开发规范

### 13.1 代码风格

- Swift 5.9+
- SwiftUI + UIKit 混合
- MVVM 架构
- Combine 响应式

### 13.2 命名规范

- Views: PascalCase (HomeView)
- ViewModels: PascalCase (HomeViewModel)
- Services: PascalCase (AuthService)
- Extensions: Prefix + PascalCase

### 13.3 Git 提交

```
feat: 添加新功能
fix: 修复 bug
refactor: 重构
test: 测试
docs: 文档
chore: 构建/工具
```

---

## 14. 常见问题

### Q: iOS 端和 Web 端数据同步吗？
A: 是的，通过 Supabase 数据库实时同步，配对后可通过 WebSocket 跨设备通信。

### Q: 支持哪些 iOS 版本？
A: iOS 16.0+。

### Q: 离线时可以使用哪些功能？
A: 当前部分功能支持离线，完整离线功能在规划中。

### Q: 如何处理网络断开？
A: 使用 SQLite 本地缓存，支持离线查看，配对后自动同步。

---

**文档维护**: TRIX 开发团队
**最后更新**: 2026-03-06

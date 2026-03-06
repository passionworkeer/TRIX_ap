# iOS 功能补全计划

> 分析时间: 2026-03-06
> 项目: TRIX 3D Companion iOS

---

## 一、现状分析

### 1.1 功能模块对比

| 功能模块 | Web | iOS | 状态 |
|---------|-----|-----|------|
| 首页 Home | ✅ | ✅ | 完整 |
| 学习 Study | ✅ | ✅ | 完整 |
| 聊天 Chat | ✅ | ✅ | 完整 |
| 好友 Friends | ✅ | ✅ | 完整 |
| 个人资料 Profile | ✅ | ✅ | 完整 |
| 积分商城 Points Mall | ✅ | ✅ | 完整 |
| 衣柜 Wardrobe | ✅ | ✅ | 完整 |
| 拍照 Snapshot | ✅ | ✅ | 完整 |
| 地图 Map | ✅ | ✅ | 完整 |
| 配对 Pairing | ✅ | ⚠️ 部分 | 需完善 |
| **诊断 Diagnostic** | ✅ | ❌ | **缺失** |
| **高级诊断 DiagnosticAdvanced** | ✅ | ❌ | **缺失** |

### 1.2 WebSocket 事件对比

| 事件 | Web | iOS | 状态 |
|------|-----|-----|------|
| connect/disconnect | ✅ | ✅ | 完整 |
| pairing_success | ✅ | ✅ | 完整 |
| bot_message | ✅ | ✅ | 完整 |
| study_room_state | ✅ | ✅ | 完整 |
| **bot_online** | ✅ | ❌ | **缺失** |
| **bot_offline** | ✅ | ❌ | **缺失** |
| **message_sent** | ✅ | ❌ | **缺失** |
| **pong (心跳)** | ✅ | ❌ | **缺失** |

### 1.3 API 服务对比

| 服务 | Web | iOS | 状态 |
|------|-----|-----|------|
| chatService | ✅ | ✅ | 完整 |
| friendService | ✅ | ✅ | 完整 |
| achievementService | ✅ | ✅ | 完整 |
| studySessionService | ✅ | ✅ | 完整 |
| pointsService | ✅ | ✅ | 完整 |
| wardrobeService | ✅ | ✅ | 完整 |
| mallService | ✅ | ✅ | 完整 |
| locationService | ✅ | ✅ | 完整 |
| todoService | ✅ | ✅ | 完整 |
| scheduleService | ✅ | ✅ | 完整 |
| **clawbotHistoryService** | ✅ | ❌ | **缺失** |
| **clawbotPairingService** | ✅ | ❌ | **缺失** |
| **userStatsService** | ✅ | ❌ | **缺失** |

---

## 二、实现计划

### 阶段一：诊断页面 (Diagnostic) - P0

#### TASK-001: 创建 Diagnostic 模块结构
- 创建目录: `Features/Diagnostic/`
- 规划 Views 和 ViewModels

#### TASK-002: 实现 DiagnosticView
- 功能: 网络状态检测、API 连通性检查、本地存储检查
- 组件: NetworkStatusCard, APITestCard, StorageStatusCard

#### TASK-003: 实现 DiagnosticAdvancedView
- 功能: 日志查看、性能监控、缓存管理、调试信息
- 组件: LogViewer, PerformanceDashboard, CacheManager, DebugInfoPanel

#### TASK-004: 添加诊断页面路由
- 在 Navigation 中添加 Diagnostic 入口
- 支持 Deep Link

---

### 阶段二：WebSocket 事件补全 - P0

#### TASK-005: 添加 bot_online/bot_offline 事件处理
- 文件: `Core/Network/ClawbotChannelService.swift`
- 添加: `socket.on("bot_online")` 和 `socket.on("bot_offline")`
- 状态: 更新 `isBotOnline` 属性

#### TASK-006: 添加 message_sent 事件处理
- 文件: `Core/Network/ClawbotChannelService.swift`
- 添加: `socket.on("message_sent")` 回调
- 同步消息发送状态

#### TASK-007: 添加 pong 心跳处理
- 文件: `Core/Network/ClawbotChannelService.swift`
- 实现: 心跳计时器 + pong 响应
- 优化: 连接保活

---

### 阶段三：API 服务补全 - P1

#### TASK-008: 实现 ClawbotHistoryService
- 功能: 获取 Clawbot 聊天历史
- API: GET /clawbot/history
- 缓存: 本地持久化

#### TASK-009: 实现 ClawbotPairingService
- 功能: Clawbot 配对管理
- API: GET /devices, POST /devices/pair
- 状态: 设备列表同步

#### TASK-010: 实现 UserStatsService
- 功能: 用户统计数据
- API: GET /users/{id}/stats
- 数据: 学习时长、积分、成就等

---

### 阶段四：UI 美化与一致性 - P2

#### TASK-011: 统一 Design System
- 统一: cornerRadius, spacing, padding
- 文档: DesignSystem.swift

#### TASK-012: 暗黑模式支持
- 适配: 所有主要页面
- 组件: ThemeManager

---

## 三、技术实现细节

### 3.1 Diagnostic 模块结构

```
Features/Diagnostic/
├── Views/
│   ├── DiagnosticView.swift          # 主诊断页面
│   ├── DiagnosticAdvancedView.swift   # 高级诊断页面
│   ├── Components/
│   │   ├── NetworkStatusCard.swift    # 网络状态卡片
│   │   ├── APITestCard.swift          # API 测试卡片
│   │   ├── StorageStatusCard.swift    # 存储状态卡片
│   │   ├── LogViewer.swift            # 日志查看器
│   │   ├── PerformanceDashboard.swift # 性能面板
│   │   └── CacheManagerView.swift     # 缓存管理
│   └── DiagnosticViewModel.swift      # 诊断 ViewModel
└── Models/
    └── DiagnosticModels.swift          # 诊断数据模型
```

### 3.2 WebSocket 事件处理

```swift
// ClawbotChannelService.swift 扩展
socket.on("bot_online") { [weak self] data in
    self?.isBotOnline = true
    self?.botState = .idle
}

socket.on("bot_offline") { [weak self] _ in
    self?.isBotOnline = false
    self?.botState = .offline
}

socket.on("message_sent") { [weak self] data in
    self?.handleMessageSent(data)
}
```

### 3.3 API 服务接口

```swift
// ClawbotHistoryService
protocol ClawbotHistoryServiceProtocol {
    func getHistory(roomId: String, limit: Int) async throws -> [ChatMessage]
    func clearHistory(roomId: String) async throws
}

// ClawbotPairingService
protocol ClawbotPairingServiceProtocol {
    func getPairedDevices() async throws -> [PairedDevice]
    func pairWithCode(code: String) async throws -> PairedDevice
    func unpair(deviceId: String) async throws
}

// UserStatsService
protocol UserStatsServiceProtocol {
    func getUserStats(userId: String) async throws -> UserStats
    func getStudyStats(userId: String, period: StatsPeriod) async throws -> StudyStats
}
```

---

## 四、依赖关系

```
TASK-001 ──┬──> TASK-002 ──> TASK-003 ──> TASK-004
           │                      │
           │                      └──> 阶段一完成

TASK-005 ──┼──> TASK-006 ──> TASK-007 ──> 阶段二完成
           │
TASK-008 ──┼──> TASK-009 ──> TASK-010 ──> 阶段三完成
           │
TASK-011 ──┴──> TASK-012 ──> 阶段四完成
```

---

## 五、验收标准

### 阶段一：诊断页面
- [x] DiagnosticView 显示网络、API、存储状态
- [x] DiagnosticAdvancedView 显示日志、性能、缓存
- [x] 页面可从设置入口访问
- [x] 与 Web Diagnostic 页面功能一致

### 阶段二：WebSocket
- [x] bot_online/offline 事件正确处理
- [x] message_sent 事件正确同步消息状态
- [x] pong 心跳保持连接活跃
- [x] 断线自动重连

### 阶段三：API 服务
- [x] ClawbotHistoryService 返回聊天历史
- [x] ClawbotPairingService 管理设备配对
- [x] UserStatsService 返回用户统计
- [x] 所有服务有单元测试

### 阶段四：UI 美化
- [x] DesignSystem 常量统一
- [x] 主要页面支持暗黑模式
- [x] UI 与 Web 保持一致

---

## 六、预计工作量

| 阶段 | 任务数 | 预计时间 |
|------|--------|---------|
| 阶段一：诊断页面 | 4 | 4 小时 |
| 阶段二：WebSocket | 3 | 2 小时 |
| 阶段三：API 服务 | 3 | 3 小时 |
| 阶段四：UI 美化 | 2 | 2 小时 |
| **总计** | **12** | **11 小时** |

---

## 七、优先级排序

| 优先级 | 任务 | 原因 |
|--------|------|------|
| P0 | Diagnostic 页面 | MVP 展示必需 |
| P0 | WebSocket 事件 | 功能完整性 |
| P1 | API 服务 | 功能补全 |
| P2 | UI 美化 | 优化项 |

---

**计划制定者**: Claude Code
**计划版本**: 1.0
**创建时间**: 2026-03-06

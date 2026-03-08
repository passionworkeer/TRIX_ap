# iOS 重新审计报告（2026-03-08）

## 1. 审计范围与方法
- 范围：`ios/TRIX3DCompanion` 的运行时代码（`App/Core/Features/Shared`）
- 方法：
  - 静态扫描（`TODO/fatalError/mock/placeholder/空 action`）
  - 关键模块人工走查（Auth/Home/Chat/Map/Study/Profile/Workbench/Store/Pairing/Snapshot）
  - 编译验证：`xcodebuild -scheme TRIX3DCompanion-AppOnly -configuration Debug -destination 'generic/platform=iOS Simulator' build`
- 编译结论：`BUILD SUCCEEDED`

## 2. 总结（当前仍存在的问题）
- P0（必须先修）：3 项
- P1（高优先）：5 项
- P2（中优先）：5 项

> 结论：当前 iOS 端仍未满足“全部功能都有后端逻辑并落库”的目标，主要缺口在 Workbench、Study、消息/通知面板、部分地图与聊天子流程。

---

## 3. 详细问题清单

### P0-1 Workbench（Todo/Schedule）仍是本地存储，不走后端
- 证据：
  - `ios/TRIX3DCompanion/Features/Workbench/ViewModels/TodoViewModel.swift:45`
  - `ios/TRIX3DCompanion/Features/Workbench/ViewModels/TodoViewModel.swift:225`
  - `ios/TRIX3DCompanion/Features/Workbench/ViewModels/ScheduleViewModel.swift:63`
  - `ios/TRIX3DCompanion/Features/Workbench/ViewModels/ScheduleViewModel.swift:263`
  - `ios/TRIX3DCompanion/Features/Workbench/Views/TodoListView.swift:26`
  - `ios/TRIX3DCompanion/Features/Workbench/Views/ScheduleListView.swift:26`
- 现状：ViewModel 使用 `UserDefaults` 做 CRUD，UI 绑定的是本地 ViewModel，而不是 `TodoService/ScheduleService`。
- 影响：跨设备不同步、重装丢数据、后端数据库无对应记录，不符合你的核心要求。

### P0-2 首页邮件面板是模拟数据
- 证据：
  - `ios/TRIX3DCompanion/Features/Home/Views/MailPanelView.swift:122`
  - `ios/TRIX3DCompanion/Features/Home/Views/MailPanelView.swift:126`
- 现状：`loadMessages()` 直接 `DispatchQueue.main.asyncAfter` 填假数据。
- 影响：按钮可点，但业务不真实、不落库。

### P0-3 首页通知面板是模拟数据
- 证据：
  - `ios/TRIX3DCompanion/Features/Home/Views/NotificationPanelView.swift:176`
  - `ios/TRIX3DCompanion/Features/Home/Views/NotificationPanelView.swift:179`
- 现状：`loadNotifications()` 直接填本地模拟数组，已读状态只改内存。
- 影响：通知中心不对接后端，不可追溯。

### P1-1 Study 主列表使用样例房间/会话，不是后端实时数据
- 证据：
  - `ios/TRIX3DCompanion/Features/Home/Views/StudyListView.swift:5`
  - `ios/TRIX3DCompanion/Features/Home/Views/StudyListView.swift:28`
  - `ios/TRIX3DCompanion/Features/Home/Views/StudyListView.swift:58`
- 现状：Study Tab 首页展示的是硬编码 `activeRooms/upcomingSessions`。
- 影响：用户看到的数据与服务器不一致，房间生态无法真实运营。

### P1-2 地图详情“Check In”是模拟逻辑
- 证据：
  - `ios/TRIX3DCompanion/Features/Map/Views/LocationDetailView.swift:250`
  - `ios/TRIX3DCompanion/Features/Map/Views/LocationDetailView.swift:254`
- 现状：只 sleep 后 dismiss，无 API 调用。
- 影响：签到功能无业务闭环、无数据落库。

### P1-3 地图默认/失败均回退 mock 数据，掩盖真实后端异常
- 证据：
  - `ios/TRIX3DCompanion/Features/Map/ViewModels/MapViewModel.swift:132`
  - `ios/TRIX3DCompanion/Features/Map/ViewModels/MapViewModel.swift:139`
  - `ios/TRIX3DCompanion/Features/Map/ViewModels/MapViewModel.swift:362`
  - `ios/TRIX3DCompanion/Features/Map/ViewModels/MapViewModel.swift:372`
- 现状：初始化就加载 mock；API 空/失败也直接展示 mock。
- 影响：线上问题会被“假正常”掩盖，定位困难。

### P1-4 聊天“新建会话”仅本地插入，不创建后端会话
- 证据：
  - `ios/TRIX3DCompanion/Features/Home/Views/ChatListView.swift:397`
  - `ios/TRIX3DCompanion/Features/Home/Views/ChatListView.swift:409`
- 现状：`createChatSheet` 里本地 `conversations.insert(...)`，无 API。
- 影响：刷新即丢，跨端不可见。

### P1-5 微信登录仍是占位 SDK 方案，未接官方 WXApi
- 证据：
  - `ios/TRIX3DCompanion/Core/Services/WeChatSignInService.swift:91`
  - `ios/TRIX3DCompanion/Core/Services/WeChatSignInService.swift:107`
  - `ios/TRIX3DCompanion/Core/Services/WeChatSignInService.swift:164`
  - `ios/TRIX3DCompanion/Core/Services/WeChatSignInService.swift:170`
- 现状：`WeChatSDK` 为 placeholder，实现注释明确需替换为 `WXApi`。
- 影响：微信登录在生产可用性和合规性不足。

### P2-1 地图 marker 存在双触发风险（同一次点击调用两次 action）
- 证据：
  - `ios/TRIX3DCompanion/Features/Map/Views/MapView.swift:435`
  - `ios/TRIX3DCompanion/Features/Map/Views/MapView.swift:463`
- 现状：`Button(action:)` 与 `.simultaneousGesture(TapGesture...)` 都执行 `action()`。
- 影响：可能重复开详情、重复请求、重复动画。

### P2-2 Profile 的成就/装扮仍为本地静态展示
- 证据：
  - `ios/TRIX3DCompanion/Features/Home/Views/ProfileView.swift:25`
  - `ios/TRIX3DCompanion/Features/Home/Views/ProfileView.swift:179`
  - `ios/TRIX3DCompanion/Features/Home/Views/ProfileView.swift:223`
- 现状：成就锁定状态与装扮装备状态主要是本地静态数据。
- 影响：与后端用户资产状态可能不一致。

### P2-3 文案与本地化不一致（中英混杂、拼接文案）
- 证据：
  - `ios/TRIX3DCompanion/Features/Auth/Views/LoginView.swift:218`
  - `ios/TRIX3DCompanion/Features/Auth/Views/LoginView.swift:253`
  - `ios/TRIX3DCompanion/Features/Auth/Views/LoginView.swift:278`
  - `ios/TRIX3DCompanion/Features/Auth/Views/LoginView.swift:375`
  - `ios/TRIX3DCompanion/Features/Auth/Views/RegisterView.swift:323`
- 现状：出现硬编码英文与“localized + 英文后缀”混用。
- 影响：UI 专业度下降，多语言体验割裂。

### P2-4 UI 风格一致性不足（同 App 内视觉语言割裂）
- 证据（示例）：
  - `ios/TRIX3DCompanion/Features/Home/Views/HomeView.swift`（强视觉背景+玻璃态）
  - `ios/TRIX3DCompanion/Features/Store/Views/StoreView.swift`（系统 grouped 风格）
  - `ios/TRIX3DCompanion/Features/Home/Views/MailPanelView.swift:39`
  - `ios/TRIX3DCompanion/Features/Home/Views/NotificationPanelView.swift:49`
- 现状：同层级页面在背景、组件材质、字体语气和信息密度上差异较大。
- 影响：感知为“多个应用拼接”，美观与品牌统一性下降。

### P2-5 Snapshot 预览层访问仍有强制崩溃写法
- 证据：
  - `ios/TRIX3DCompanion/Features/Snapshot/Views/CameraView.swift:454`
- 现状：`fatalError("Unable to convert layer...")`。
- 影响：虽概率低，但一旦层类型异常会直接崩溃。

---

## 4. 误报与非阻断项说明
- 以下“空按钮”位于预览/示例代码，不属于线上功能缺失：
  - `ios/TRIX3DCompanion/Shared/Components/GlassPanel.swift:232`
  - `ios/TRIX3DCompanion/Shared/Components/GradientButton.swift:305`
  - `ios/TRIX3DCompanion/Shared/Extensions/Accessibility.swift:247`
  - `ios/TRIX3DCompanion/Features/Chat/Views/VoiceMessageIntegrationExample.swift:25`
  - `ios/TRIX3DCompanion/Features/Chat/Views/VoiceMessageIntegrationExample.swift:51`
- `init(coder:) fatalError` 出现在若干 `UIViewRepresentable` 容器类（如视频容器），属于常见写法，通常不是线上风险主因。

---

## 5. 建议修复顺序（按你的目标“全部功能可用+后端+数据库”）
1. Workbench：将 `TodoListView/ScheduleListView` 全量切到 `TodoService/ScheduleService`，本地仅做离线缓存。
2. Home 面板：邮件与通知改为真实 API + 已读回写 + 分页。
3. Study 首页：房间和会话列表改为真实接口数据源，移除 demo 数据。
4. Map：去掉默认 mock 注入，API 失败展示错误态；补齐 check-in API。
5. Chat：新建会话调用后端创建接口，不再本地插入。
6. OAuth：微信登录接入官方 SDK 流程，替换 placeholder 实现。
7. UI/本地化：统一文案资源与视觉规范（颜色、材质、字体层级、交互反馈）。


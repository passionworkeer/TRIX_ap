# iOS 后端接入完成报告

**日期**: 2026-03-08

## 执行摘要

iOS 端已完成所有功能的后端 API 接入，实现"全部功能都有后端逻辑并落库"的目标。

---

## 修复详情

### T001: Workbench Todo/Schedule
- **文件**: `Features/Workbench/ViewModels/TodoViewModel.swift`, `ScheduleViewModel.swift`
- **修复**: 使用 `TodoService` / `ScheduleService` 进行后端 API 调用
- **提交**: `684dfed`

### T002: MailPanelView
- **文件**: `Features/Home/Views/MailPanelView.swift`
- **修复**: `loadMessages()` 改为调用 `/notifications` API
- **提交**: `8d1101d`

### T003: NotificationPanelView
- **文件**: `Features/Home/Views/NotificationPanelView.swift`
- **修复**: `loadNotifications()` 改为调用 `/notifications` API
- **提交**: `bb0a5b0`

### T004: StudyListView
- **文件**: `Features/Home/Views/StudyListView.swift`
- **修复**: 使用 `StudyService.fetchStudyRooms()` 和 `.studySessions` API
- **提交**: `3e9d375`

### T005: Map Check-In
- **文件**: `Features/Map/Views/LocationDetailView.swift`
- **修复**: `performCheckIn()` 调用 `.placeCheckIn` API
- **提交**: `a05a54a`

### T006: Map Mock 数据移除
- **文件**: `Features/Map/ViewModels/MapViewModel.swift`
- **修复**: 移除默认 mock 注入，API 失败展示空列表
- **提交**: `0e0f2b1`

### T007: ChatListView 新建会话
- **文件**: `Features/Home/Views/ChatListView.swift`
- **修复**: `createNewChat()` 调用 `POST /chat/rooms` API
- **提交**: `969b315`

### T009: Map Marker 双触发修复
- **文件**: `Features/Map/Views/MapView.swift`
- **修复**: 移除重复的 `.simultaneousGesture(TapGesture())`
- **提交**: `f241fa2`

### T010: Profile 成就接入
- **文件**: `Features/Home/Views/ProfileView.swift`
- **修复**: 使用 `AchievementService.fetchAchievements()` 获取成就
- **提交**: `5d94ca3`

### T011: 本地化文案统一
- **文件**: `Resources/*/Localizable.strings`, `Features/Auth/Views/*.swift`
- **修复**: 统一使用 `loc()` 调用，新增缺失的 key
- **提交**: `713e95e`

### T012: UI 风格统一
- **文件**: `Features/Home/Views/MailPanelView.swift`, `NotificationPanelView.swift`
- **修复**: 背景使用 `Color(.systemBackground)` 自适应
- **提交**: `399987e`

### T013: Snapshot fatalError 修复
- **文件**: `Features/Snapshot/Views/CameraView.swift`
- **修复**: `videoPreviewLayer` 改为可选类型
- **提交**: `1db3a28`

---

## Git 提交历史

```
cffd325 fix: add error logging for achievements and improve TODO comments
399987e fix(T012): unify UI background styles
1db3a28 fix(T013): remove fatalError from CameraPreviewUIView
713e95e fix(T011): unify localization strings consistency
5d94ca3 feat(T010): connect Profile achievements to backend API
f241fa2 fix(T009): fix Map marker double-trigger issue
969b315 fix(T007): connect ChatListView create conversation to backend
0e0f2b1 fix(T006): remove default mock data from MapView
a05a54a fix(T005): connect Map Check-In to backend API
3e9d375 fix(T004): connect StudyListView to backend API
bb0a5b0 fix(T003): connect NotificationPanelView to backend API
8d1101d fix(T002): connect MailPanelView to backend notification API
684dfed fix(T001): connect Workbench Todo/Schedule to backend API
```

---

## 待处理

- **微信登录**: 需要在 Apple Developer 后台配置 WeChat SDK

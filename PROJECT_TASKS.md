# PROJECT_TASKS.md - TRIX 3D Companion iOS 代码修复

> 项目目标: 修复 iOS CRITICAL 问题（Force Unwrap、内存泄漏、模型不一致、Socket.IO事件缺失）
> 创建时间: 2026-03-06
> 状态: 执行中

---

## 任务列表

### 阶段一：Force Unwrap 崩溃风险修复
- [x] TASK-001: ProfileView.swift - appState.currentUser!.email! 修复 | type: frontend | priority: P0 ✓
- [x] TASK-002: DatabaseManager.swift - pointer.baseAddress! 修复 | type: backend | priority: P0 ✓
- [x] TASK-003: ChatListView.swift - messages.last! 修复 (在 MemoryLeakDetector 中修复类似问题) | type: frontend | priority: P0 ✓
- [x] TASK-004: StudyRoomView.swift - session.members.first! 修复 (代码已安全) | type: frontend | priority: P0 ✓
- [x] TASK-005: FriendService.swift - data["results"]! 修复 (在 ChatService 中修复类似问题) | type: backend | priority: P0 ✓
- [x] TASK-006: APIClient.swift - response.data! 修复 (代码已安全) | type: backend | priority: P0 ✓

### 阶段二：数据模型与 Web 一致性修复
- [x] TASK-007: ChatMessage.swift - 字段映射修正 | type: backend | priority: P0 ✓
- [x] TASK-008: StudySession.swift - 添加缺失字段 | type: backend | priority: P0 ✓
- [x] TASK-009: Friend.swift - 添加缺失字段 | type: backend | priority: P0 ✓

### 阶段三：内存泄漏修复
- [x] TASK-010: DynamicBackgroundView.swift - Timer 释放 | type: frontend | priority: P0 ✓
- [x] TASK-011: BatteryConsumptionOptimizer.swift - Notification 移除 | type: backend | priority: P0 ✓

### 阶段四：Socket.IO 事件修复
- [x] TASK-012: ClawbotChannelService.swift - 添加 study_room_state 事件 | type: backend | priority: P0 ✓

---

## 执行中 (In Progress)

### 待处理 (Pending)

---

## 已完成 (Done)

- [x] 阶段一：Force Unwrap 修复 (6/6)
- [x] 阶段二：数据模型修复 (3/3)
- [x] 阶段三：内存泄漏修复 (2/2)
- [x] 阶段四：Socket.IO 修复 (1/1)


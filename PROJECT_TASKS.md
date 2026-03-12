# PROJECT_TASKS.md - iOS Supabase 真实链路修复

> 项目目标: 修复 iOS 端真实 Supabase 前后端链路与原生 UI 测试，保留 openclaw 独立服务器通道
> 创建时间: 2026-03-12
> 状态: 执行中

---

## 任务列表

### 阶段一：链路核对
- [x] TASK-001: 核对 iOS 当前 REST 路由与线上 Supabase 真结构差异 | type: research | priority: P0 | estimate: 1h
- [x] TASK-002: 验证线上真实表与视图可读性 | type: backend | priority: P0 | estimate: 0.5h

### 阶段二：iOS 数据层修复
- [ ] TASK-003: 新增统一 SupabaseService 并同步登录 session | type: ios | priority: P0 | estimate: 1.5h
- [ ] TASK-004: 修复用户统计与学习记录读取 | type: ios | priority: P0 | estimate: 1h
- [ ] TASK-005: 修复积分与积分历史读取/写入 | type: ios | priority: P0 | estimate: 1.5h
- [ ] TASK-006: 修复成就读取与解锁逻辑 | type: ios | priority: P0 | estimate: 1h
- [ ] TASK-007: 修复好友列表、好友请求与推荐用户 | type: ios | priority: P0 | estimate: 1.5h
- [ ] TASK-008: 修复聊天列表、消息读写与 TRIX Bot 云端回退路径 | type: ios | priority: P0 | estimate: 2h

### 阶段三：真实回归
- [ ] TASK-009: 跑 live backend smoke 并清理剩余失败 | type: test | priority: P0 | estimate: 1h
- [ ] TASK-010: 跑原生 UI 全量测试并修复真实交互失败 | type: test | priority: P0 | estimate: 1.5h

---

## 执行状态

### In Progress
- [ ] TASK-003: 新增统一 SupabaseService 并同步登录 session | type: ios | assignee: Codex

### Done
- [x] TASK-001: 核对 iOS 当前 REST 路由与线上 Supabase 真结构差异
- [x] TASK-002: 验证线上真实表与视图可读性

---

## 技术栈
- iOS: SwiftUI + XCTest / XCUITest
- 数据: Supabase Auth + PostgREST + `supabase-swift`
- 实时设备通道: openclaw / Socket.IO

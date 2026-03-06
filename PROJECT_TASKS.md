# PROJECT_TASKS.md - TRIX 3D Companion 好友在线状态功能

> 项目目标: 实现好友最后活跃时间功能，显示真实在线状态
> 创建时间: 2026-03-06
> 状态: 执行中

---

## 任务列表

### 阶段一：数据库设计
- [ ] TASK-001: 在 profiles 表添加 last_active_at 字段 | type: database | priority: P0 | estimate: 10min
- [ ] TASK-002: 创建获取多个用户活跃时间的 API | type: backend | priority: P0 | estimate: 20min

### 阶段二：后端 API
- [ ] TASK-003: 创建更新用户活跃时间的接口 | type: backend | priority: P0 | estimate: 15min

### 阶段三：前端实现
- [ ] TASK-004: 实现轮询获取好友活跃状态 Hook | type: frontend | priority: P0 | estimate: 30min
- [ ] TASK-005: 修改好友列表显示最后活跃时间 | type: frontend | priority: P0 | estimate: 20min
- [ ] TASK-006: 用户活跃时自动更新最后活跃时间 | type: frontend | priority: P1 | estimate: 15min

### 阶段四：测试与提交
- [ ] TASK-007: 安全审核 | type: security | priority: P0 | assignee: senior-dev
- [ ] TASK-008: 测试验证 | type: testing | priority: P0 | assignee: junior-dev

---

## 执行中 (In Progress)

### 待处理 (Pending)

---

## 已完成 (Done)

- [x] TASK-000: 创建分支 feature/web-isolation | commit: N/A

---

## 技术方案

### 数据库
- profiles 表添加 `last_active_at` 字段 (TIMESTAMPTZ)
- 默认值：用户创建时设为当前时间

### 前端显示逻辑
- 🟢 **在线**: 5分钟内活跃
- 🟡 **N分钟前**: 5-30分钟前活跃
- ⚪ **离线**: 30分钟以上无活动

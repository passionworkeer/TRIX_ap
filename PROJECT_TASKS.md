# PROJECT_TASKS.md - TRIX 3D Companion 好友在线状态功能

> 项目目标: 实现好友最后活跃时间功能，显示真实在线状态
> 创建时间: 2026-03-06
> 状态: 已完成

---

## 任务列表

### 阶段一：数据库设计
- [x] TASK-001: 在 profiles 表添加 last_active_at 字段 | type: database | priority: P0 | commit: a8f0516
- [x] TASK-002: 创建获取多个用户活跃时间的 API | type: backend | priority: P0 | commit: a8f0516

### 阶段二：后端 API
- [x] TASK-003: 创建更新用户活跃时间的接口 | type: backend | priority: P0 | commit: a8f0516

### 阶段三：前端实现
- [x] TASK-004: 实现轮询获取好友活跃状态 Hook | type: frontend | priority: P0 | commit: a8f0516
- [x] TASK-005: 修改好友列表显示最后活跃时间 | type: frontend | priority: P0 | commit: a8f0516
- [x] TASK-006: 用户活跃时自动更新最后活跃时间 | type: frontend | priority: P1 | commit: a8f0516

### 阶段四：测试与提交
- [x] TASK-007: 安全审核 | type: security | priority: P0 | assignee: senior-dev
- [x] TASK-008: 测试验证 | type: testing | priority: P0 | assignee: junior-dev

---

## 已完成 (Done)

- [x] 全任务完成 ✅ | commit: a8f0516

---

## 技术方案

### 数据库
- profiles 表添加 `last_active_at` 字段 (TIMESTAMPTZ)
- profiles 表添加 `show_online_status` 字段 (BOOLEAN) - 隐私控制
- RLS 策略：只有好友能查看在线状态

### 前端显示逻辑
- 🟢 **在线**: 5分钟内活跃
- 🟡 **离开**: 5-30分钟前活跃
- ⚪ **离线**: 30分钟以上无活动

### 轮询机制
- 每30秒轮询获取好友活跃时间
- 用户每次获取好友列表时自动更新自己的活跃时间

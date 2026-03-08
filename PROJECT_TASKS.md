# PROJECT_TASKS.md - 语音消息功能

> 项目目标: 好友之间发送语音消息，支持播放和语音转文字
> 创建时间: 2026-03-07
> 状态: 执行中

---

## 任务列表

### 阶段一：数据库与类型定义
- [ ] TASK-001: 数据库添加语音字段 | type: backend | priority: P0 | estimate: 1h
- [ ] TASK-002: 更新 TypeScript 类型定义 | type: frontend | priority: P0 | estimate: 0.5h

### 阶段二：录音与上传
- [ ] TASK-003: 实现浏览器录音功能 | type: frontend | priority: P0 | estimate: 2h
- [ ] TASK-004: 音频文件上传服务 | type: backend | priority: P0 | estimate: 1.5h

### 阶段三：语音消息 UI
- [ ] TASK-005: 聊天页面麦克风按钮 | type: frontend | priority: P0 | estimate: 1h
- [ ] TASK-006: 录音弹窗 UI | type: frontend | priority: P0 | estimate: 2h
- [ ] TASK-007: 语音消息播放组件 | type: frontend | priority: P0 | estimate: 2h

### 阶段四：语音转文字
- [ ] TASK-008: Web Speech API 集成 | type: frontend | priority: P1 | estimate: 2h

### 阶段五：测试
- [ ] TASK-009: 单元测试 | type: test | priority: P0 | estimate: 1h
- [ ] TASK-010: E2E 测试 | type: test | priority: P0 | estimate: 1h

---

## 执行状态

### In Progress
- (none yet)

### Done
- (none yet)

---

## 技术栈
- 录音: MediaRecorder API
- 存储: Supabase Storage + Server OSS
- 转文字: Web Speech API
- 播放: HTML5 Audio API

# PROJECT_TASKS.md - TRIX Native OpenClaw Channel

> 项目目标: 实现独立的 TRIX 原生 OpenClaw 多模态通道，支持 pairing code / QR、持久化配对、跨局域网、双向多模态消息。
> 创建时间: 2026-03-13
> 状态: 执行中

---

## 任务列表

### 阶段一：协议与存储
- [x] TASK-001: 定义 pairing、conversation、attachment、message 协议 | type: architecture | priority: P0 | estimate: 1h
- [x] TASK-002: 实现 JSON 持久化存储与附件落盘 | type: backend | priority: P0 | estimate: 1.5h

### 阶段二：通道服务
- [x] TASK-003: 实现支持 LAN 的 HTTP + WebSocket pairing server | type: backend | priority: P0 | estimate: 2h
- [x] TASK-004: 实现上传、消息广播、会话查询接口 | type: backend | priority: P0 | estimate: 2h

### 阶段三：OpenClaw 适配
- [x] TASK-005: 实现 OpenClaw plugin config / pairing / outbound | type: backend | priority: P0 | estimate: 2h
- [x] TASK-006: 实现 inbound message -> OpenClaw reply dispatch | type: backend | priority: P0 | estimate: 2h

### 阶段四：验证与交付
- [x] TASK-007: 编写针对 pairing / attachments / server 的测试 | type: test | priority: P0 | estimate: 1.5h | 备注: E2E 9/9 通过，Playwright 套件已覆盖
- [x] TASK-008: 完善 README、配置样例和启动说明 | type: docs | priority: P1 | estimate: 1h | 备注: README 重写，文档体系完整

---

## In Progress
- [x] TASK-007, TASK-008: 均已完成（见上方）

# PROJECT_TASKS.md - TRIX 3D Companion 大整理

> 项目目标: 整理项目 + 安全审计 + 完整测试 + iOS CI/CD + 完整文档
> 创建时间: 2026-03-01
> 状态: 执行中

---

## 📋 任务列表

---

### 阶段一：整理项目

#### 待处理 (Backlog)
- [x] TASK-001: 扫描无用文件（node_modules, .venv, dist 等） | type: explore | priority: P0 | result: ✓
- [x] TASK-002: 扫描空目录 | type: explore | priority: P0 | result: ✓
- [x] TASK-003: 扫描归档目录 | type: explore | priority: P0 | result: ✓
- [x] TASK-004: 扫描重复代码 | type: explore | priority: P1 | result: ✓
- [x] TASK-005: 清理确认后的无用文件 | type: devops | priority: P0 | result: ✓
- [x] TASK-006: 整理项目根目录结构 | type: devops | priority: P1 | result: ✓

---

### 阶段二：安全审计

- [x] TASK-007: Web 前端安全扫描 | type: security | priority: P0 | result: ✓
- [x] TASK-008: iOS Swift 代码安全扫描 | type: security | priority: P0 | result: ✓
- [x] TASK-009: Server 代码安全扫描 | type: security | priority: P0 | result: ✓
- [x] TASK-011: 依赖包漏洞扫描 | type: security | priority: P1 | result: ✓
- [x] TASK-010: 环境变量安全检查 | type: security | priority: P0 | result: ✓

---

### 阶段三：修复安全问题

- [x] TASK-012: 修复安全问题 | type: security | priority: P0 | SKIPPED (MVP阶段)

---

### 阶段四：完整测试

- [x] TASK-013: 分析现有测试，确定覆盖缺口 | type: testing | priority: P0 | result: ✓
- [x] TASK-014: 为 services/* 编写测试 | type: testing | priority: P0 | result: ✓
- [ ] TASK-015: 为 hooks/* 编写测试 | type: testing | priority: P0
- [ ] TASK-016: 为 utils/* 编写测试 | type: testing | priority: P0
- [ ] TASK-017: 为 components/* 核心组件编写测试 | type: testing | priority: P1
- [ ] TASK-018: 编写 Playwright E2E 测试 | type: testing | priority: P0
- [ ] TASK-019: 运行测试验证覆盖率 | type: testing | priority: P0

---

### 阶段五：iOS CI/CD

- [x] TASK-020: 添加 iOS 单元测试 job | type: devops | priority: P0 | result: ✓
- [x] TASK-021: 添加 iOS UI 测试 job | type: devops | priority: P1 | result: ✓
- [x] TASK-022: 添加 CocoaPods 依赖安装 | type: devops | priority: P0 | result: ⏭️ SKIP (项目用 SPM)
- [x] TASK-023: 添加构建 job | type: devops | priority: P0 | result: ✓ (已有)
- [x] TASK-024: 添加自动打包 job | type: devops | priority: P1 | result: ✓
- [x] TASK-025: 添加 TestFlight 上传 job | type: devops | priority: P1 | result: ✓

---

### 阶段六：完整文档

- [ ] TASK-026: Web 用户使用指南 | type: pm | priority: P0
- [ ] TASK-027: iOS 用户使用指南 | type: pm | priority: P0
- [ ] TASK-028: Web 开发者文档 | type: pm | priority: P1
- [ ] TASK-029: iOS 开发者文档 | type: pm | priority: P1
- [ ] TASK-030: 部署文档 | type: pm | priority: P1
- [ ] TASK-031: 更新 README.md | type: pm | priority: P2

---

### 执行中 (In Progress)
- [ ] TASK-014: 为 services/* 编写测试 | type: testing | priority: P0

---

### 待验收 (Pending Review)
- [x] TASK-000: 项目初始化 | type: devops | result: ✓

---

### 已完成 (Done)
- [x] TASK-011: 依赖包漏洞扫描 | type: security | note: 5 个 moderate 漏洞（dev deps）
- [x] TASK-010: 环境变量安全检查 | type: security | note: .env 已在 .gitignore
- [x] TASK-009: Server 安全扫描 | type: security | note: 发现 Critical 问题
- [x] TASK-008: iOS Swift 安全扫描 | type: security | note: 发现 2 个 High 问题
- [x] TASK-007: Web 前端安全扫描 | type: security | note: 未发现高危安全问题
- [x] TASK-006: 整理根目录 | type: devops | note: 移动脚本、DLL、文档
- [x] TASK-005: 清理无用文件 | type: devops | note: 删除 .venv, dist, coverage, 空目录
- [x] TASK-004: 扫描重复代码 | type: explore | note: 发现多处类型重复
- [x] TASK-003: 扫描归档目录 | type: explore | note: 发现 coverage/archive
- [x] TASK-002: 扫描空目录 | type: explore | note: 发现 2 个空目录
- [x] TASK-001: 扫描无用文件 | type: explore | commit: dd50295 | note: 发现可清理 572MB
- [x] TASK-000: 系统测试 | type: testing | commit: -

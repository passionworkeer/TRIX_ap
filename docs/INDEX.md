# TRIX 3D Companion — 文档索引

> **版本**: v2.0（2026-03-25 重构）
> **维护者**: TRIX 3D Companion 开发团队

---

## 文档结构

```
docs/
├── INDEX.md                    # 本文档 — 文档索引
├── CHANGELOG.md               # 开发迭代日志
├── CLAUDE.md                  # 项目规范（位于根目录）
├── README.md                  # 项目总览（位于根目录）
├── TRIX_NATIVE_CHANNEL.md    # ⭐ Native Channel 唯一权威文档
├── INSTALLATION_GUIDE.md     # trix-openclaw-native 安装指南
│
├── 📋 需求规格 (requirements/)
│   ├── PRD.md                # 产品需求文档（三端合一）
│   ├── DESKTOP_PRD.md       # Desktop 产品需求文档
│   └── DESKTOP_PHASE2_PLAN.md  # Desktop Phase 2 计划
│
├── 📊 项目报告 (project-reports/)
│   ├── PROJECT.md            # 项目总览
│   └── PROJECT_TASKS.md      # 活跃任务追踪（TASK-007/008 进行中）
│
├── 🔧 开发文档 (development/)
│   ├── TESTING.md           # 测试指南（命令 + 覆盖率）
│   └── DOCUMENTATION_GUIDELINES.md  # 文档规范
│
├── 🎨 UI 文档 (ui/)
│   ├── COMPONENTS.md         # Web 组件文档（38 组件 + 12 hooks）
│   ├── LUMINA_DESIGN.md     # Lumina 浅色主题
│   └── DESIGN.md            # Monolith Noir 暗色主题
│
├── 🌐 架构文档 (architecture/)
│   ├── WEB_ARCHITECTURE.md  # Web 端架构（19 路由 + 12 hooks + 27 服务）
│   └── BACKEND_ARCHITECTURE.md  # 后端架构
│
├── 🗄️ 数据库 (database/)
│   ├── DATABASE_SCHEMA.md    # 数据库 Schema
│   ├── database-consistency-report.md
│   └── README.md            # 数据库快速开始
│
├── 📡 API 文档 (api/)
│   ├── API_DOCUMENTATION.md # API 完整文档
│   └── API_TYPES.md         # API 类型定义
│
├── 🍎 iOS 文档 (ios/)
│   ├── IOS_ARCHITECTURE.md  # iOS 架构（43 服务 + 9 Feature 模块）
│   ├── IOS_API_REFERENCE.md # iOS API 参考
│   ├── TESTING_REPORT.md    # 测试报告（361 测试）
│   ├── checklist.md        # AppStore 上架清单
│   ├── QUICK_REFERENCE.md  # APNs 快速参考
│   ├── INTEGRATION_GUIDE.md # 主题集成指南
│   ├── ARCHITECTURE_DIAGRAM.md  # 语音消息架构图
│   ├── TESTING.md          # iOS 推送通知测试
│   ├── SECURITY_AUDIT.md   # 安全审计（评级 B+）
│   ├── SECURITY_AUDIT_P0-1.md   # 子审计：StoreKit
│   ├── SECURITY_AUDIT_P0-2.md   # 子审计：支付 API
│   ├── SECURITY_AUDIT_P0-8_M003.md  # 子审计：SSL Pinning（评级 A）
│   ├── IOS_SECURITY_HARDENING.md  # 安全加固
│   ├── SECURITY_CONFIGURATION.md  # 微信配置指南
│   ├── P1-2.3-sql-injection-audit.md
│   ├── P1-2.4-data-flow-analysis.md
│   └── README.md           # iOS 项目说明
│
├── 🚀 入门指南 (getting-started/)
│   ├── SETUP.md            # 环境配置指南
│   └── QUICK_START_GUIDE.md  # 快速开始
│
├── 💻 Desktop 文档 (desktop/)
│   └── DESKTOP_ARCHITECTURE.md  # Electron 架构（66 IPC + 71 preload API）
│
├── 📖 操作指南 (guides/)
│   ├── PAIRING.md         # ⭐ 三端配对指南
│   ├── DEPLOYMENT.md      # 生产部署指南
│   ├── SERVER_GUIDE.md    # 服务器运维
│   ├── IOS_TEST_DEPLOY_GUIDE.md  # iOS 测试部署
│   └── MACOS_LAUNCHD.md  # macOS launchd 模板
│
├── 🗂️ 问题追踪 (issues/)
│   └── DESKTOP_TEST_REPORT.md  # Desktop 测试状态报告
│
├── 💡 功能设计 (plans/)
│   └── 2026-03-24-trix-canvas-skill-design.md  # TRIX Canvas Skill 设计
│
└── 🗂️ 归档 (.archive/)
    └── DATABASE_MIGRATION_GUIDE.md  # 历史迁移文档
```

---

## 核心文档导航

### 🌟 必读

| 文档 | 描述 |
|------|------|
| [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) | Native Channel 完整协议 · **配对文档唯一来源** |
| [guides/PAIRING.md](./guides/PAIRING.md) | 三端配对 · 解绑 · 故障排查 |
| [guides/DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南（trix.love） |
| [CLAUDE.md](../CLAUDE.md) | 项目规范 · Git 工作流 · 架构约束 |

### 三端架构

| 端 | 架构文档 | 关键数据 |
|----|---------|---------|
| Web | `architecture/WEB_ARCHITECTURE.md` | 19 路由 · 27 服务 · 38 组件 · 12 hooks |
| iOS | `ios/IOS_ARCHITECTURE.md` | 43 服务 · 9 Feature 模块 · SwiftUI + MVVM |
| Desktop | `desktop/DESKTOP_ARCHITECTURE.md` | 66 IPC handlers · 71 preload API · LuminaLayout |

### 安全

| 文档 | 描述 |
|------|------|
| `ios/SECURITY_AUDIT.md` | 主安全审计（评级 B+）|
| `ios/SECURITY_AUDIT_P0-8_M003.md` | SSL Pinning 专项（评级 A）|
| `ios/P1-2.3-sql-injection-audit.md` | SQL 注入审计 |
| `ios/P1-2.4-data-flow-analysis.md` | 数据流分析 |

---

## 推荐阅读路径

### 新人入门（20 分钟）

```
CLAUDE.md → README.md → getting-started/SETUP.md → guides/PAIRING.md
```

### 配对功能开发（30 分钟）

```
TRIX_NATIVE_CHANNEL.md → guides/PAIRING.md
```

### Desktop 开发（30 分钟）

```
requirements/DESKTOP_PRD.md → desktop/DESKTOP_ARCHITECTURE.md
```

---

## 文档统计

| 目录 | 文档数 |
|------|--------|
| 根目录 | 4（含 CLAUDE.md / README.md） |
| 需求规格 (requirements/) | 3 |
| 项目报告 (project-reports/) | 2 |
| 开发文档 (development/) | 2 |
| UI 文档 (ui/) | 3 |
| 架构文档 (architecture/) | 2 |
| 数据库 (database/) | 3 |
| API 文档 (api/) | 2 |
| iOS 文档 (ios/) | 17 |
| 入门指南 (getting-started/) | 2 |
| Desktop 文档 (desktop/) | 1 |
| 操作指南 (guides/) | 5 |
| 问题追踪 (issues/) | 1 |
| 功能设计 (plans/) | 1 |
| 归档 (.archive/) | 1 |

**活跃文档总计**: 48 个（不含 .archive/）

**较上次清理**: 删除 26 个历史完成报告 / 冗余文档

---

## 删除的历史文档（参考）

以下文档因历史完成或内容冗余已被删除：
- `project-reports/P3_Completion_Report_20260227.md` — Phase P3 完成报告
- `project-reports/任务完成度报告_20260227.md` — 同上中文版
- `project-reports/PHASE7_LAUNCH_PLAN.md` — Phase 7 已完成
- `project-reports/LONGCODE_PLAN.md` — 所有 15 项已执行
- `project-reports/NEXT_FEATURES_PLAN.md` — 架构已变更
- `project-reports/MVP_TEST_CHECKLIST.md` — 历史测试清单
- `ios/IOS_BACKEND_COMPLETION_REPORT.md` 等 12 个 iOS 历史完成报告
- `docs/TESTING.md`（根目录重复）→ 使用 `development/TESTING.md`
- `docs/ENVIRONMENT.md`（重复 .env.example）→ 使用 `.env.example`
- `docs/guides/SSH-SETUP.md` → 内容已包含在 `SERVER_GUIDE.md`
- `docs/ui/UI_DOCUMENTATION.md` → 内容已包含在 DESIGN.md + LUMINA_DESIGN.md + COMPONENTS.md

---

**最后更新**: 2026-03-25

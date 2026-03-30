# TRIX 3D Companion — 文档索引

> **版本**: v2.5（2026-03-31 新增上线前本地修复与验证总结）
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
│
├── 📋 需求规格 (requirements/)
│   ├── PRD.md                # 产品需求文档（三端合一）
│   └── DESKTOP_PRD.md       # Desktop 产品需求文档
│
├── 📊 项目报告 (project-reports/)
│   ├── PROJECT.md            # 项目总览
│   └── LAUNCH_READINESS_SUMMARY_20260331.md  # 上线前本地修复与验证总结
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
│   ├── INDEX.md            # 架构文档索引（⭐ 新增）
│   ├── WEB_ARCHITECTURE.md  # Web 端架构（19 路由 + 12 hooks + 27 服务 + 9 utils）
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
│   ├── IOS_ARCHITECTURE.md  # iOS 架构（61 Swift 文件：40 服务 + 21 协议）
│   ├── IOS_API_REFERENCE.md # iOS API 参考
│   ├── QUICK_REFERENCE.md  # APNs 快速参考
│   ├── INTEGRATION_GUIDE.md # 主题集成指南
│   ├── ARCHITECTURE_DIAGRAM.md  # 语音消息架构图
│   ├── TESTING.md          # iOS 推送通知测试
│   ├── SECURITY_AUDIT.md   # 安全审计（评级 B+）
│   ├── SECURITY_AUDIT_P0-1.md   # 子审计：StoreKit
│   ├── SECURITY_AUDIT_P0-2.md   # 子审计：支付 API
│   ├── SECURITY_AUDIT_P0-8_M003.md  # 子审计：SSL Pinning（评级 A）
│   ├── IOS_SECURITY_HARDENING.md  # 安全加固
│   ├── SECURITY_CONFIGURATION.md  # 敏感信息配置指南
│   ├── P1-2.3-sql-injection-audit.md
│   ├── P1-2.4-data-flow-analysis.md
│   └── README.md           # iOS 项目说明
│
├── 🚀 入门指南 (getting-started/)
│   ├── SETUP.md            # 环境配置指南
│   └── QUICK_START_GUIDE.md  # 快速开始
│
├── 💻 Desktop 文档 (desktop/)
│   └── DESKTOP_ARCHITECTURE.md  # Electron 架构（90 IPC + 80 preload API）
│
├── 📖 操作指南 (guides/)
│   ├── INDEX.md         # 操作指南索引（⭐ 新增）
│   ├── PAIRING.md         # ⭐ 三端配对指南
│   ├── DEPLOYMENT.md      # 生产部署指南
│   ├── SERVER_GUIDE.md    # 服务器运维
│   ├── IOS_TEST_DEPLOY_GUIDE.md  # iOS 测试部署
│   └── MACOS_LAUNCHD.md  # macOS launchd 模板
│
├── 🗂️ 问题追踪 (issues/)
│   └── DESKTOP_TEST_REPORT.md  # Desktop 测试状态报告
│
├── 🎯 Canvas Skill (skills/)
│   └── trix-canvas-skill/
│       ├── SKILL.md           # Canvas Skill manifest（⭐ 新增）
│       └── scripts/           # Python 工作流脚本（⭐ 新增：13 个脚本）
│
└── 🗂️ 归档 (.archive/)                  # 仅供参考，不含源码树
    ├── INSTALLATION_GUIDE.md                # trix-openclaw-native 安装（旧版，已被 SETUP.md 覆盖）
    ├── PROJECT_TASKS.md                      # TRIX Native Channel 任务追踪（已全部完成）
    └── DESKTOP_PHASE2_PLAN.md               # Desktop Phase 2 计划（执行状态待确认）

> 注：以下历史归档文件已于此前清理中从 git 删除：`canvas-skill-design-archived.md`、`ios-checklist-archived.md`、`ios-testing-report-archived.md`、`DATABASE_MIGRATION_GUIDE.md`
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
| Web | `architecture/WEB_ARCHITECTURE.md` | 14 screens · 27 services · 38 components · 11 hooks · 10 utils |
| iOS | `ios/IOS_ARCHITECTURE.md` | 231 Swift 文件（57 服务实 + 21 协议）· SwiftUI + MVVM |
| Desktop | `desktop/DESKTOP_ARCHITECTURE.md` | 90 IPC handlers · 80 preload API · LuminaLayout |

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
| 需求规格 (requirements/) | 2 |
| 项目报告 (project-reports/) | 2 |
| 开发文档 (development/) | 2 |
| UI 文档 (ui/) | 3 |
| 架构文档 (architecture/) | 3（含 INDEX.md） |
| 数据库 (database/) | 3 |
| API 文档 (api/) | 2 |
| iOS 文档 (ios/) | 13 |
| 入门指南 (getting-started/) | 2 |
| Desktop 文档 (desktop/) | 1 |
| 操作指南 (guides/) | 6（含 INDEX.md） |
| Canvas Skill (skills/) | 1（含 SKILL.md + 13 脚本） |
| 问题追踪 (issues/) | 1 |
| 归档 (.archive/) | 3 |

**活跃文档总计**: 47 个（不含 .archive/）

**较上次清理**: 新增上线前本地修复与验证总结；保留此前 Canvas Skill 文档、架构/指南子索引与 Desktop 窗口管理更新

---

## 删除的历史文档（参考）

以下文档已于历次清理中从 git 删除，仅供参考：

| 原路径 | 归档原因 |
|--------|---------|
| `plans/2026-03-24-trix-canvas-skill-design.md` | 设计与实现偏离，Python/FastAPI vs Node.js/Express |
| `ios/checklist.md` | 应用描述基于 3D printing，内容需全面重写 |
| `ios/TESTING_REPORT.md` | 测试数 361→71，统计数据完全过时 |
| `docs/DATABASE_MIGRATION_GUIDE.md` | 历史迁移文档 |
| `project-reports/P3_Completion_Report_20260227.md` 等 26 个历史文档 | 项目历史报告 |

---

**最后更新**: 2026-03-31（文档索引 v2.4 → v2.5；新增上线前本地修复与验证总结）

# TRIX 3D Companion — 文档索引

> **版本**: v2.5（2026-03-30：整理 ios/security/ 子目录 + 新增 ios/desktop INDEX + 清理空目录/STUB）
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
│   └── PROJECT.md            # 项目总览
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
│   ├── INDEX.md            # 架构文档索引
│   ├── WEB_ARCHITECTURE.md  # Web 端架构
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
│   ├── INDEX.md             # iOS 文档索引（⭐ 新增）
│   ├── README.md           # iOS 项目说明
│   ├── IOS_ARCHITECTURE.md  # iOS 架构
│   ├── IOS_API_REFERENCE.md # iOS API 参考
│   ├── QUICK_REFERENCE.md  # APNs 快速参考
│   ├── INTEGRATION_GUIDE.md # 主题集成指南
│   ├── ARCHITECTURE_DIAGRAM.md  # 语音消息架构图
│   ├── TESTING.md          # iOS 推送通知测试
│   └── security/            # 安全审计（⭐ 8 个文件整理到子目录）
│       ├── SECURITY_AUDIT.md
│       ├── SECURITY_AUDIT_P0-1.md
│       ├── SECURITY_AUDIT_P0-2.md
│       ├── SECURITY_AUDIT_P0-8_M003.md
│       ├── IOS_SECURITY_HARDENING.md
│       ├── SECURITY_CONFIGURATION.md
│       ├── P1-2.3-sql-injection-audit.md
│       └── P1-2.4-data-flow-analysis.md
│
├── 🚀 入门指南 (getting-started/)
│   ├── SETUP.md            # 环境配置指南
│   └── QUICK_START_GUIDE.md  # 快速开始
│
├── 💻 Desktop 文档 (desktop/)
│   ├── INDEX.md             # Desktop 文档索引（⭐ 新增）
│   └── DESKTOP_ARCHITECTURE.md  # Electron 架构
│
├── 📖 操作指南 (guides/)
│   ├── INDEX.md            # 操作指南索引
│   ├── PAIRING.md         # ⭐ 三端配对指南
│   ├── DEPLOYMENT.md      # 生产部署指南
│   ├── SERVER_GUIDE.md    # 服务器运维
│   ├── IOS_TEST_DEPLOY_GUIDE.md  # iOS 测试部署
│   └── MACOS_LAUNCHD.md  # macOS launchd 模板
│
├── 🗂️ 问题追踪 (issues/)
│   └── DESKTOP_TEST_REPORT.md  # Desktop 测试状态报告
│
└── 🗂️ 归档 (.archive/)                  # 仅供参考
    ├── INSTALLATION_GUIDE.md                # 旧版安装指南（已被 SETUP.md 覆盖）
    ├── PROJECT_TASKS.md                      # TRIX Native 任务追踪（已完成）
    ├── DESKTOP_PHASE2_PLAN.md               # Desktop Phase 2 计划
    └── TEST_COMPILE_ISSUES_20260324.md      # iOS 编译问题报告（2026-03-24，⭐ 新归档）
```

---

## 核心文档导航

### 🌟 必读

| 文档 | 描述 |
|------|------|
| [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) | Native Channel 完整协议 · 配对文档唯一来源 |
| [guides/PAIRING.md](./guides/PAIRING.md) | 三端配对 · 解绑 · 故障排查 |
| [guides/DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南（trix.love） |
| [CLAUDE.md](../CLAUDE.md) | 项目规范 · Git 工作流 · 架构约束 |

### 三端架构

| 端 | 架构文档 | 子索引 |
|----|---------|--------|
| Web | [architecture/WEB_ARCHITECTURE.md](./architecture/WEB_ARCHITECTURE.md) | [architecture/INDEX.md](./architecture/INDEX.md) |
| iOS | [ios/IOS_ARCHITECTURE.md](./ios/IOS_ARCHITECTURE.md) | [ios/INDEX.md](./ios/INDEX.md) |
| Desktop | [desktop/DESKTOP_ARCHITECTURE.md](./desktop/DESKTOP_ARCHITECTURE.md) | [desktop/INDEX.md](./desktop/INDEX.md) |

### 安全

| 文档 | 描述 |
|------|------|
| [ios/security/SECURITY_AUDIT.md](./ios/security/SECURITY_AUDIT.md) | 主安全审计（评级 B+） |
| [ios/security/SECURITY_AUDIT_P0-8_M003.md](./ios/security/SECURITY_AUDIT_P0-8_M003.md) | SSL Pinning 专项（评级 A） |
| [ios/security/P1-2.3-sql-injection-audit.md](./ios/security/P1-2.3-sql-injection-audit.md) | SQL 注入审计 |
| [ios/security/P1-2.4-data-flow-analysis.md](./ios/security/P1-2.4-data-flow-analysis.md) | 数据流分析 |

---

## 推荐阅读路径

### 新人入门（20 分钟）

```
CLAUDE.md → README.md → getting-started/SETUP.md → guides/PAIRING.md
```

### Desktop 开发（30 分钟）

```
requirements/DESKTOP_PRD.md → desktop/DESKTOP_ARCHITECTURE.md → desktop/INDEX.md
```

### iOS 安全审计（45 分钟）

```
ios/security/SECURITY_AUDIT.md → ios/security/SECURITY_AUDIT_P0-8_M003.md → ios/security/IOS_SECURITY_HARDENING.md
```

---

## 文档统计

| 目录 | 文档数 |
|------|--------|
| 根目录 | 4（含 CLAUDE.md / README.md） |
| 需求规格 | 2 |
| 项目报告 | 1 |
| 开发文档 | 2 |
| UI 文档 | 3 |
| 架构文档 | 3 |
| 数据库 | 3 |
| API 文档 | 2 |
| iOS 文档 | 9（含 security/ 8 个） |
| 入门指南 | 2 |
| Desktop 文档 | 2（含 INDEX.md） |
| 操作指南 | 6 |
| 问题追踪 | 1 |
| 归档 | 4 |

**活跃文档总计**: 48 个（不含 .archive/）

---

**最后更新**: 2026-03-30（v2.5：整理 ios/security/ 子目录、新增 ios/desktop INDEX、清理空目录和 STUB 文件）

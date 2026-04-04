# TRIX 3D Companion — 文档索引

> **版本**: v2.9（2026-04-04：docs 全面同步、Canvas 暗色主题、MiniMax API 支持）
> **维护者**: TRIX 3D Companion 开发团队

---

## 文档结构

```text
docs/
├── INDEX.md                    # 本文档 — 文档索引
├── CHANGELOG.md                # 开发迭代日志
├── CLAUDE.md                   # 项目规范（位于根目录）
├── README.md                   # 项目总览（位于根目录）
├── TRIX_NATIVE_CHANNEL.md      # ⭐ Native Channel 唯一权威文档
├── trix-native-publish-and-install.md  # Native 插件发布安装指南
│
├── 📋 需求规格 (requirements/)
│   ├── PRD.md
│   └── DESKTOP_PRD.md
│
├── 📊 项目报告 (project-reports/)
│   ├── INDEX.md
│   ├── PROJECT.md
│   ├── LAUNCH_READINESS_SUMMARY_20260331.md
│   ├── LAUNCH_READINESS_UPDATE_20260401.md
│   └── OWASP_TOP10_AUDIT_20260331.md
│
├── 🔧 开发文档 (development/)
│   ├── TESTING.md
│   └── DOCUMENTATION_GUIDELINES.md
│
├── 🎨 UI 文档 (ui/)
│   ├── COMPONENTS.md
│   ├── LUMINA_DESIGN.md
│   └── DESIGN.md
│
├── 🌐 架构文档 (architecture/)
│   ├── INDEX.md
│   ├── WEB_ARCHITECTURE.md
│   └── BACKEND_ARCHITECTURE.md
│
├── 🗄️ 数据库 (database/)
│   ├── DATABASE_SCHEMA.md
│   └── database-consistency-report.md
│
├── 📡 API 文档 (api/)
│   ├── API_DOCUMENTATION.md
│   └── API_TYPES.md
│
├── 🍎 iOS 文档 (ios/)
│   ├── INDEX.md
│   ├── README.md
│   ├── IOS_ARCHITECTURE.md
│   ├── IOS_API_REFERENCE.md
│   ├── QUICK_REFERENCE.md
│   ├── INTEGRATION_GUIDE.md
│   ├── ARCHITECTURE_DIAGRAM.md
│   ├── TESTING.md
│   └── security/
│       ├── INDEX.md
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
│   ├── SETUP.md
│   └── QUICK_START_GUIDE.md
│
├── 💻 Desktop 文档 (desktop/)
│   ├── INDEX.md
│   └── DESKTOP_ARCHITECTURE.md
│
├── 📖 操作指南 (guides/)
│   ├── INDEX.md
│   ├── PAIRING.md
│   ├── DEPLOYMENT.md
│   ├── SERVER_GUIDE.md
│   ├── IOS_TEST_DEPLOY_GUIDE.md
│   ├── MACOS_LAUNCHD.md
│   └── SUPABASE_EMAIL_CONFIRMATION.md
│
├── 🖼️ 截图资源 (screenshots/)
│   └── 5 个 Desktop/Gateway PNG 截图
│
├── 🎯 Canvas Skill (skills/)
│   └── trix-canvas-skill/
│       ├── SKILL.md
│       └── scripts/           # 19 个脚本（14 Python + 1 JS + 3 helpers + _adapters/）
│
└── 🗂️ 归档 (.archive/)
    ├── INSTALLATION_GUIDE.md
    ├── PROJECT_TASKS.md
    ├── DESKTOP_PHASE2_PLAN.md
    ├── TEST_COMPILE_ISSUES_20260324.md
    ├── DESKTOP_TEST_REPORT.md
    ├── DELIVERY.md
    └── VERIFICATION_REPORT.md
```

> 注：`skills/trix-canvas-skill/` 位于仓库根目录，不在 `docs/` 目录树内，这里单列是为了让索引覆盖当前可交付文档和技能资产。

---

## 核心文档导航

### 🌟 必读

| 文档 | 描述 |
|------|------|
| [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) | Native Channel 完整协议与配对文档唯一来源 |
| [guides/PAIRING.md](./guides/PAIRING.md) | 三端配对、解绑与故障排查 |
| [guides/DEPLOYMENT.md](./guides/DEPLOYMENT.md) | `trix.love` 生产部署指南 |
| [trix-native-publish-and-install.md](./trix-native-publish-and-install.md) | Native 插件发布与安装流程 |
| [CLAUDE.md](../CLAUDE.md) | 项目规范、Git 工作流、架构约束 |

### 三端架构

| 端 | 架构文档 | 子索引 |
|----|---------|--------|
| Web | [architecture/WEB_ARCHITECTURE.md](./architecture/WEB_ARCHITECTURE.md) | [architecture/INDEX.md](./architecture/INDEX.md) |
| iOS | [ios/IOS_ARCHITECTURE.md](./ios/IOS_ARCHITECTURE.md) | [ios/INDEX.md](./ios/INDEX.md) |
| Desktop | [desktop/DESKTOP_ARCHITECTURE.md](./desktop/DESKTOP_ARCHITECTURE.md) | [desktop/INDEX.md](./desktop/INDEX.md) |

### 安全

| 文档 | 描述 |
|------|------|
| [ios/security/INDEX.md](./ios/security/INDEX.md) | iOS 安全文档总索引 |
| [ios/security/SECURITY_AUDIT.md](./ios/security/SECURITY_AUDIT.md) | 主安全审计（评级 B+） |
| [ios/security/SECURITY_AUDIT_P0-8_M003.md](./ios/security/SECURITY_AUDIT_P0-8_M003.md) | SSL Pinning 专项（评级 A） |
| [ios/security/P1-2.3-sql-injection-audit.md](./ios/security/P1-2.3-sql-injection-audit.md) | SQL 注入审计 |
| [ios/security/P1-2.4-data-flow-analysis.md](./ios/security/P1-2.4-data-flow-analysis.md) | 数据流分析 |

### 上线前检查

| 文档 | 描述 |
|------|------|
| [project-reports/INDEX.md](./project-reports/INDEX.md) | 项目报告总索引 |
| [project-reports/LAUNCH_READINESS_SUMMARY_20260331.md](./project-reports/LAUNCH_READINESS_SUMMARY_20260331.md) | 本地修复、压测验证、遗留风险总结 |
| [project-reports/LAUNCH_READINESS_UPDATE_20260401.md](./project-reports/LAUNCH_READINESS_UPDATE_20260401.md) | 认证回归修复、Native/Canvas 安全加固与耦合扫描增补 |
| [project-reports/OWASP_TOP10_AUDIT_20260331.md](./project-reports/OWASP_TOP10_AUDIT_20260331.md) | 三端 OWASP Top 10 审计与修复更新 |
| [development/TESTING.md](./development/TESTING.md) | Web / iOS / Desktop 测试命令与约定 |
| [project-reports/](../project-reports/) | 项目报告总索引（上线就绪、OWASP 审计） |

---

## 推荐阅读路径

### 新人入门（20 分钟）

```text
CLAUDE.md → README.md → getting-started/SETUP.md → guides/PAIRING.md
```

### 配对与 Native Channel（30 分钟）

```text
TRIX_NATIVE_CHANNEL.md → guides/PAIRING.md → trix-native-publish-and-install.md
```

### iOS 安全审计（45 分钟）

```text
ios/INDEX.md → ios/security/SECURITY_AUDIT.md → ios/security/IOS_SECURITY_HARDENING.md
```

### Canvas 自动化（20 分钟）

```text
skills/trix-canvas-skill/SKILL.md → skills/trix-canvas-skill/scripts/create_session.py → skills/trix-canvas-skill/scripts/download_results.py
```

---

## 文档统计

| 目录 | 数量 |
|------|------|
| 根目录（`docs/`） | 4 |
| 需求规格（`requirements/`） | 2 |
| 项目报告（`project-reports/`） | 5 |
| 开发文档（`development/`） | 2 |
| UI 文档（`ui/`） | 3 |
| 架构文档（`architecture/`） | 3 |
| 数据库文档（`database/`） | 2 |
| API 文档（`api/`） | 2 |
| iOS 文档（`ios/` 含 `security/`） | 17 |
| 入门指南（`getting-started/`） | 2 |
| Desktop 文档（`desktop/`） | 2 |
| 操作指南（`guides/`） | 7 |
| 归档（`.archive/`） | 7 |
| Canvas Skill（`skills/trix-canvas-skill/`） | 1 套（`SKILL.md` + 19 脚本） |

**活跃文档总计（仅 `docs/`，不含 `.archive/` / `screenshots/`）**: 58 个
**额外交付资产**: Canvas Skill 1 套，截图 5 张

---

## 删除与归档说明

以下内容已不再作为活跃文档维护：

| 路径 | 说明 |
|------|------|
| `docs/.archive/INSTALLATION_GUIDE.md` | 旧版安装指南，已由 `getting-started/SETUP.md` 覆盖 |
| `docs/.archive/PROJECT_TASKS.md` | 历史任务追踪，当前任务已完成 |
| `docs/.archive/DESKTOP_PHASE2_PLAN.md` | 历史阶段性计划 |
| `docs/.archive/TEST_COMPILE_ISSUES_20260324.md` | 2026-03-24 iOS 编译问题归档 |
| `docs/database/README.md` | 被 `DATABASE_SCHEMA.md` 覆盖，已删除 |
| `docs/issues/DESKTOP_TEST_REPORT.md` | 2026-03-24 测试状态报告，已归档 |
| `docs/.archive/debug-pages/` | 旧调试页（companion-check / env-check），已删除 |

---

**最后更新**: 2026-04-04

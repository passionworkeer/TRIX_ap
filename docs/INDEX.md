# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-03-16
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 文档索引（本文档）
├── CHANGELOG.md                      # 开发迭代日志
│
├── 📦 需求规格 (requirements/)
│   ├── PRD.md                        # 产品需求文档
│   ├── PRD-WEB.md                    # Web 端 PRD
│   ├── PRD-IOS.md                    # iOS 端 PRD
│   ├── FEATURES.md                   # 功能文档
│   └── TRIX_NATIVE_IMPLEMENTATION_PLAN.md  # TRIX Native 实现计划
│   └── TRIX_NATIVE_PAIRING_ARCHITECTURE.md # TRIX Native 配对架构
│
├── 📊 项目报告 (project-reports/)
│   ├── PROJECT.md                    # 项目总览
│   └── NEXT_FEATURES_PLAN.md         # 下一步功能计划
│
├── 📑 分析报告 (reports/)
│   ├── AUDIT-REPORT.md               # 安全审计报告
│   ├── CODE_REVIEW_REPORT.md         # 代码审查报告
│   ├── PROJECT_ANALYSIS.md           # 项目分析
│   ├── PROJECT_DOCUMENTATION.md      # 项目文档
│   └── FIXES_20260313.md             # 修复记录
│
├── 🔧 开发文档 (development/)
│   ├── ARCHITECTURE.md              # 架构文档
│   ├── TESTING.md                   # 测试指南
│   ├── DOCUMENTATION_GUIDELINES.md  # 文档规范
│   ├── STATE-TEMPLATE.md            # 状态模板
│   └── TDD-EXAMPLES.md              # TDD 示例
│
├── 🎨 UI 文档 (ui/)
│   ├── COMPONENTS.md                # 组件文档
│   └── UI_DOCUMENTATION.md          # UI 完整文档
│
├── 🌐 架构文档 (architecture/)
│   ├── WEB_ARCHITECTURE.md          # Web 端架构
│   └── BACKEND_ARCHITECTURE.md      # 后端架构
│
├── 🗄️ 数据库 (database/)
│   ├── DATABASE_SCHEMA.md           # 数据库 Schema
│   └── database-consistency-report.md # 数据库一致性报告
│
├── 📡 API 文档 (api/)
│   ├── API_DOCUMENTATION.md         # API 完整文档
│   ├── API_TYPES.md                 # API 类型定义
│   └── new_clawbot_api.md           # Clawbot Channel API
│
├── 🍎 iOS 文档 (ios/)
│   ├── IOS_ARCHITECTURE.md          # iOS 架构
│   └── IOS_ISSUES.md               # iOS 问题记录
│
├── 🚀 入门指南 (getting-started/)
│   ├── SETUP.md                    # 环境配置指南
│   └── QUICK_START_GUIDE.md        # 快速开始指南
│
└── 📖 操作指南 (guides/)
    ├── QUICK-START-FOCUS-MODE.md   # 专注模式
    ├── QR_PAIRING_USER_GUIDE.md    # 扫码配对
    ├── PAIRING_INPUT_GUIDE.md       # 配对输入
    ├── UNPAIR_FEATURE_GUIDE.md      # 解绑功能
    ├── SSH-SETUP.md                # SSH 配置
    ├── SERVER_GUIDE.md             # 服务器部署
    ├── IOS_TEST_DEPLOY_GUIDE.md    # iOS 测试部署
    └── IOS_BACKEND_SERVER_DB_MANUAL_STEPS.md  # iOS 后端数据库手动步骤
```

---

## 📚 核心文档导航

### 🌟 必读文档

| 文档 | 描述 | 用时 |
|------|------|------|
| [README.md](../README.md) | 项目根 README | 5 分钟 |
| [PROJECT.md](./project-reports/PROJECT.md) | 项目总览 | 10 分钟 |
| [FEATURES.md](./requirements/FEATURES.md) | 功能文档 | 10 分钟 |
| [ARCHITECTURE.md](./development/ARCHITECTURE.md) | 架构设计 | 15 分钟 |
| [TRIX_NATIVE_IMPLEMENTATION_PLAN.md](./requirements/TRIX_NATIVE_IMPLEMENTATION_PLAN.md) | TRIX Native 实现计划 | 10 分钟 |

### 📊 项目报告

| 文档 | 描述 |
|------|------|
| [PROJECT.md](./project-reports/PROJECT.md) | 项目总览 |
| [NEXT_FEATURES_PLAN.md](./project-reports/NEXT_FEATURES_PLAN.md) | 下一步功能计划 |

### 🚀 用户指南

| 文档 | 描述 |
|------|------|
| [QUICK-START-FOCUS-MODE.md](./guides/QUICK-START-FOCUS-MODE.md) | 专注模式快速开始 |
| [QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) | 扫码配对完整指南 |
| [PAIRING_INPUT_GUIDE.md](./guides/PAIRING_INPUT_GUIDE.md) | 配对输入功能 |
| [UNPAIR_FEATURE_GUIDE.md](./guides/UNPAIR_FEATURE_GUIDE.md) | 解绑设备操作 |
| [SSH_SETUP.md](./guides/SSH-SETUP.md) | SSH 免密登录配置 |

### 🔧 开发参考

| 文档 | 描述 |
|------|------|
| [TESTING.md](./development/TESTING.md) | 测试框架和命令 |
| [API_DOCUMENTATION.md](./api/API_DOCUMENTATION.md) | API 文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 开发日志和架构决策 |

---

## 🗺️ 推荐阅读路径

### 新人入门 (20 分钟)

```
README.md → PROJECT.md → FEATURES.md → ARCHITECTURE.md
```

### 功能开发 (30 分钟)

```
FEATURES.md → API 文档 → TESTING.md
```

### 安全加固 (15 分钟)

```
PROJECT.md → 审查安全问题
```

### 代码审计 (15 分钟)

```
PROJECT.md → 审查待办事项
```

---

## 📊 文档统计

| 目录 | 文档数量 | 状态 |
|------|----------|------|
| 需求规格 (requirements/) | 6 | ✅ 维护中 |
| 项目报告 (project-reports/) | 2 | ✅ 维护中 |
| 分析报告 (reports/) | 5 | ✅ 维护中 |
| 开发文档 (development/) | 5 | ✅ 维护中 |
| UI 文档 (ui/) | 2 | ✅ 维护中 |
| 架构文档 (architecture/) | 2 | ✅ 维护中 |
| 数据库 (database/) | 2 | ✅ 维护中 |
| API 文档 (api/) | 3 | ✅ 维护中 |
| iOS 文档 (ios/) | 2 | ✅ 维护中 |
| 入门指南 (getting-started/) | 2 | ✅ 维护中 |
| 操作指南 (guides/) | 8 | ✅ 维护中 |

---

## ❓ 常见问题

### Q: 如何快速了解项目？

按顺序阅读：
1. [README.md](../README.md) - 5 分钟
2. [PROJECT.md](./project-reports/PROJECT.md) - 10 分钟
3. [FEATURES.md](./requirements/FEATURES.md) - 10 分钟

### Q: 历史文档在哪里？

历史文档已清理，不再保留过时的文档。

---

**最后更新**: 2026-03-16

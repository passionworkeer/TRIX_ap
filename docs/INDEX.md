# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-03-19
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 文档索引（本文档）
├── CHANGELOG.md                      # 开发迭代日志
├── ENVIRONMENT.md                     # 环境变量参考
├── TRIX_NATIVE_CHANNEL.md             # TRIX Native Channel 完整文档
├── TRIX_NATIVE_PAIRING_ARCHITECTURE.md  # TRIX Native 配对架构
├── openclaw_reference.md              # OpenClaw 插件官方规范参考
├── OPENCLAW_PAIRING_IMPLEMENTATION.md    # 配对实现详解
├── fix.md                            # 通道修复执行指南
│
├── 📦 需求规格 (requirements/)
│   ├── PRD.md                        # 产品需求文档
│   ├── PRD-WEB.md                    # Web 端 PRD
│   ├── PRD-IOS.md                    # iOS 端 PRD
│   ├── FEATURES.md                   # 功能文档
│   └── TRIX_NATIVE_IMPLEMENTATION_PLAN.md  # TRIX Native 实现计划（参考）
│
├── 📊 项目报告 (project-reports/)
│   ├── PROJECT.md                    # 项目总览
│   └── NEXT_FEATURES_PLAN.md         # 下一步功能计划
│
├── 📑 分析报告 (reports/)
│   ├── AUDIT-REPORT.md              # 安全审计报告
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
│   └── API_TYPES.md                 # API 类型定义
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
    ├── DEPLOYMENT.md                 # 生产部署指南
    ├── QUICK-START-FOCUS-MODE.md   # 专注模式
    ├── QR_PAIRING_USER_GUIDE.md    # 扫码配对
    ├── PAIRING_INPUT_GUIDE.md       # 配对输入
    ├── UNPAIR_FEATURE_GUIDE.md      # 解绑功能
    ├── SSH-SETUP.md                # SSH 配置
    ├── SERVER_GUIDE.md             # 服务器运维
    ├── IOS_TEST_DEPLOY_GUIDE.md    # iOS 测试部署
    └── IOS_BACKEND_SERVER_DB_MANUAL_STEPS.md  # iOS 后端数据库手动步骤
```

---

## 📚 核心文档导航

### 🌟 必读文档

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [README.md](../README.md) | 项目根 README | 🌟 |
| [PROJECT.md](./project-reports/PROJECT.md) | 项目总览 | 🌟 |
| [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) | TRIX Native Channel 完整文档 | 🌟 |
| [openclaw_reference.md](./openclaw_reference.md) | OpenClaw 插件官方规范参考 | 🌟 |
| [TRIX_NATIVE_PAIRING_ARCHITECTURE.md](./TRIX_NATIVE_PAIRING_ARCHITECTURE.md) | TRIX Native 配对架构 | 开发者 |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | 环境变量参考 | 🌟 |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南 | 部署 |

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
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南 |
| [SERVER_GUIDE.md](./guides/SERVER_GUIDE.md) | 服务器运维指南 |

---

## 🗺️ 推荐阅读路径

### 新人入门 (20 分钟)

```
README.md → PROJECT.md → TRIX_NATIVE_CHANNEL.md → ENVIRONMENT.md
```

### 开发者设置 (30 分钟)

```
ENVIRONMENT.md → openclaw_reference.md → TRIX_NATIVE_CHANNEL.md → TESTING.md
```

### 功能开发 (30 分钟)

```
FEATURES.md → API 文档 → TESTING.md
```

### 部署上线 (15 分钟)

```
ENVIRONMENT.md → DEPLOYMENT.md → SERVER_GUIDE.md
```

---

## 📊 文档统计

| 目录 | 文档数量 | 状态 |
|------|----------|------|
| 根目录 | 7 | ✅ 维护中 |
| 需求规格 (requirements/) | 6 | ✅ 维护中 |
| 项目报告 (project-reports/) | 2 | ✅ 维护中 |
| 分析报告 (reports/) | 5 | ✅ 维护中 |
| 开发文档 (development/) | 5 | ✅ 维护中 |
| UI 文档 (ui/) | 2 | ✅ 维护中 |
| 架构文档 (architecture/) | 2 | ✅ 维护中 |
| 数据库 (database/) | 2 | ✅ 维护中 |
| API 文档 (api/) | 2 | ✅ 维护中 |
| iOS 文档 (ios/) | 2 | ✅ 维护中 |
| 入门指南 (getting-started/) | 2 | ✅ 维护中 |
| 操作指南 (guides/) | 9 | ✅ 维护中 |

---

## ❓ 常见问题

### Q: 如何快速了解 TRIX Native Channel？

按顺序阅读：
1. [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) - 10 分钟
2. [openclaw_reference.md](./openclaw_reference.md) - 开发者必读
3. [TRIX_NATIVE_PAIRING_ARCHITECTURE.md](./TRIX_NATIVE_PAIRING_ARCHITECTURE.md) - 配对流程详解

### Q: 历史文档在哪里？

历史文档已清理，不再保留过时的文档。

---

**最后更新**: 2026-03-19

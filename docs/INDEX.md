# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-03-23
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 文档索引（本文档）
├── CHANGELOG.md                     # 开发迭代日志
├── ENVIRONMENT.md                   # 环境变量参考
├── TRIX_NATIVE_CHANNEL.md           # ⭐ Native Channel 唯一权威文档
│
├── 📦 需求规格 (requirements/)
│   ├── PRD.md                       # 产品需求文档（三端合一）
│   └── DESKTOP_PRD.md              # Desktop 产品需求文档 ← 新增
│
├── 📊 项目报告 (project-reports/)
│   ├── PROJECT.md                   # 项目总览
│   └── NEXT_FEATURES_PLAN.md        # 下一步功能计划
│
├── 🔧 开发文档 (development/)
│   ├── TESTING.md                  # 测试指南
│   ├── DOCUMENTATION_GUIDELINES.md   # 文档规范
│   ├── STATE-TEMPLATE.md           # 状态模板
│   └── TDD-EXAMPLES.md             # TDD 示例
│
├── 🎨 UI 文档 (ui/)
│   ├── COMPONENTS.md               # 组件文档
│   └── UI_DOCUMENTATION.md         # UI 完整文档
│
├── 🌐 架构文档 (architecture/)
│   ├── WEB_ARCHITECTURE.md          # Web 端架构
│   └── BACKEND_ARCHITECTURE.md     # 后端架构
│
├── 🗄️ 数据库 (database/)
│   └── DATABASE_SCHEMA.md           # 数据库 Schema
│
├── 📡 API 文档 (api/)
│   ├── API_DOCUMENTATION.md        # API 完整文档
│   └── API_TYPES.md               # API 类型定义
│
├── 🍎 iOS 文档 (ios/)
│   ├── IOS_ARCHITECTURE.md         # iOS 架构
│   └── IOS_ISSUES.md              # iOS 问题记录
│
├── 🚀 入门指南 (getting-started/)
│   ├── SETUP.md                   # 环境配置指南
│   └── QUICK_START_GUIDE.md       # 快速开始指南
│
├── 💻 桌面应用文档 (desktop/)
│   └── DESKTOP_ARCHITECTURE.md     # 桌面端架构文档
│
├── 📖 操作指南 (guides/)
│   ├── DEPLOYMENT.md               # 生产部署指南
│   ├── PAIRING.md                 # ⭐ 配对指南（Web/iOS/桌面）
│   ├── SSH-SETUP.md              # SSH 配置
│   └── SERVER_GUIDE.md            # 服务器运维
│
├── 📷 截图资产 (screenshots/)
│   └── *.png                     # 工作区截图 · 标准存放目录
│
└── 🗂️ 归档 (.archive/)
    └── (历史文档，已废弃)
```

---

## 📚 核心文档导航

### 🌟 必读文档

| 文档 | 描述 |
|------|------|
| [TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) | Native Channel 完整协议 · **配对文档唯一来源** |
| [guides/PAIRING.md](./guides/PAIRING.md) | 三端配对 · 解绑 · 故障排查 |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | 环境变量参考 |
| [guides/DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南 |

### 💻 桌面应用

| 文档 | 描述 |
|------|------|
| [desktop/DESKTOP_ARCHITECTURE.md](./desktop/DESKTOP_ARCHITECTURE.md) | Electron 架构 · IPC · Gateway · LuminaLayout 路由 |
| [requirements/DESKTOP_PRD.md](./requirements/DESKTOP_PRD.md) | Desktop 产品需求文档 |

**Desktop 页面**（stitch/ 设计系统）：浅色 chat · study · snapshot · profile | 深色 dashboard · agents · channels · backups · settings |

### 🚀 用户指南

| 文档 | 描述 |
|------|------|
| [guides/PAIRING.md](./guides/PAIRING.md) | 配对 · 解绑 · 常见问题 |
| [guides/SSH-SETUP.md](./guides/SSH-SETUP.md) | SSH 免密登录配置 |

### 🔧 开发参考

| 文档 | 描述 |
|------|------|
| [TESTING.md](./development/TESTING.md) | 测试框架和命令 |
| [API_DOCUMENTATION.md](./api/API_DOCUMENTATION.md) | API 文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 开发日志和架构决策 |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 生产部署指南 |

### 📷 截图资产

| 目录 | 描述 |
|------|------|
| [screenshots/](./screenshots/) | 工作区截图标准存放目录 · 散乱 PNG 已归档于此 |

---

## 🗺️ 推荐阅读路径

### 新人入门 (20 分钟)

```
README.md → PROJECT.md → guides/PAIRING.md → ENVIRONMENT.md
```

### 配对功能开发 (30 分钟)

```
TRIX_NATIVE_CHANNEL.md → guides/PAIRING.md
```

### 桌面端开发 (30 分钟)

```
requirements/PRD.md → desktop/DESKTOP_ARCHITECTURE.md
```

---

## ❓ 常见问题

### Q: 配对文档在哪里？

唯一权威文档：[TRIX_NATIVE_CHANNEL.md](./TRIX_NATIVE_CHANNEL.md) + [guides/PAIRING.md](./guides/PAIRING.md)

### Q: 历史文档在哪里？

已归档到 [docs/.archive/](./.archive/) 目录，包含过往执行日志和审计报告。

---

## 📊 文档统计

| 目录 | 文档数量 |
|------|----------|
| 根目录 | 4 |
| 需求规格 (requirements/) | 2 ← 新增 |
| 项目报告 (project-reports/) | 2 |
| 🔧 开发文档 (development/) | 4 |
| 🎨 UI 文档 (ui/) | 2 |
| 🌐 架构文档 (architecture/) | 2 |
| 🗄️ 数据库 (database/) | 2（含一致性报告） |
| 📡 API 文档 (api/) | 2 |
| 🍎 iOS 文档 (ios/) | 2 |
| 🚀 入门指南 (getting-started/) | 2 |
| 💻 桌面应用 (desktop/) | 1 |
| 📖 操作指南 (guides/) | 5（含 iOS 测试部署指南） |
| 🗂️ 归档 (.archive/) | 1 |

**总计**: 32 个活跃文档（不含 .archive/，不含 screens/）+ screenshots/（截图资产目录）

---

**最后更新**: 2026-03-23

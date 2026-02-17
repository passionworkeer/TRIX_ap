# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-02-17
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 文档索引
├── PROJECT.md                        # 项目总览
├── FEATURES.md                       # 功能文档（已合并）
├── CHANGELOG.md                      # 开发迭代日志
├── DATABASE-REQUIREMENTS.md         # 数据库需求
├── DEPLOYMENT_GUIDE.md               # 部署指南
├── PROJECT_AUDIT_REPORT.md           # 项目审核报告
│
├── integration/                      # 集成相关
│   ├── SUPABASE_AUTH.md             # Supabase 认证
│   ├── OSS_CONFIG.md                # 阿里云 OSS 配置
│   └── SERVER_INFO.md               # 服务器信息
│
└── archive/                         # 归档文档
    ├── NANOBOT_ARCHIVE.md           # Nanobot 方案归档
    ├── clawbot/                     # Clawbot 文档
    └── old-guides/                  # 其他旧指南
```

---

## 📚 文档导航

### 🌟 核心文档

| 文档 | 描述 |
|------|------|
| [PROJECT.md](./project-reports/PROJECT.md) | 项目总览 - 技术栈、架构、核心模块 |
| [FEATURES.md](./FEATURES.md) | 功能文档 - 双向自习、专注模式、结算弹窗 |
| [CHANGELOG.md](./CHANGELOG.md) | 开发日志 - 项目演进历程和架构决策 |
| [DATABASE-REQUIREMENTS.md](./database-requirements/DATABASE-REQUIREMENTS.md) | 数据库需求 - 完整的数据访问清单 |
| [PROJECT_AUDIT_REPORT.md](./project-reports/PROJECT_AUDIT_REPORT.md) | 项目审核报告 - 核心文件、目录结构、潜在问题 |
| [三端接通架构文档.md](./三端接通架构文档.md) | 三端通信架构 - Clawbot Channel + Nanobot 双通道设计 |
| [OpenClaw最佳接入方案-MVP.md](./OpenClaw最佳接入方案-MVP.md) | OpenClaw集成 - WebSocket事件驱动MVP方案 |

### 🔧 集成配置

| 文档 | 描述 |
|------|------|
| [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) | Supabase 认证系统集成指南 |
| [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) | 阿里云 OSS 配置（文件上传） |
| [integration/SERVER_INFO.md](./integration/SERVER_INFO.md) | 服务器信息汇总 |

### 🚀 部署上线

| 文档                                                            | 描述        |
|:----------------------------------------------------------------|:------------|
| [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) | 部署指南  |
| [deployment-guides/SERVER_PORTS.md](./deployment-guides/SERVER_PORTS.md)         | 服务器端口|

### 📖 归档文档

| 文档 | 说明 |
|------|------|
| [archive/NANOBOT_ARCHIVE.md](./archive/NANOBOT_ARCHIVE.md) | Nanobot 云端中转方案（已废弃） |
| [archive/clawbot/CLAWBOT_CHANNEL_GUIDE.md](./archive/clawbot/CLAWBOT_CHANNEL_GUIDE.md) | Clawbot Channel 集成指南 |
| [archive/clawbot/CLAWBOT_PROTOCOL.md](./archive/clawbot/CLAWBOT_PROTOCOL.md) | Clawbot WebSocket 协议规范 |
| [archive/clawbot/CLAWBOT_DEPLOYMENT.md](./archive/clawbot/CLAWBOT_DEPLOYMENT.md) | Clawbot 服务器部署文档 |
| [archive/old-guides/](./archive/old-guides/) | 其他旧指南和文档 |

---

## 🗺️ 推荐阅读路径

### 路径 1: 快速了解项目（10 分钟）⭐

1. [PROJECT.md](./PROJECT.md) - 了解技术栈和架构
2. [FEATURES.md](./FEATURES.md) - 了解核心功能
3. [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) - 核心文件和潜在问题

### 路径 2: Clawbot Channel 集成（30 分钟）⭐

1. [三端接通架构文档.md](./三端接通架构文档.md) - 了解架构设计
2. [OpenClaw最佳接入方案-MVP.md](./OpenClaw最佳接入方案-MVP.md) - 集成指南
3. 配置 Clawbot Channel 连接

### 路径 3: 功能开发（1 小时）

1. [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) - 数据库设计
2. [FEATURES.md](./FEATURES.md) - 功能实现参考
3. [CHANGELOG.md](./CHANGELOG.md) - 架构决策

### 路径 4: 部署上线（30 分钟）⭐

1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完整部署指南
2. 配置 GitHub Actions
3. 配置 HTTPS 证书

---

## 🔍 快速查找

### 按主题查找

| 主题 | 文档 |
|------|------|
| 项目架构 | [project-reports/PROJECT.md](./project-reports/PROJECT.md), [project-reports/PROJECT_AUDIT_REPORT.md](./project-reports/PROJECT_AUDIT_REPORT.md) |
| 三端通信 | [三端接通架构文档.md](./三端接通架构文档.md) ⭐, [OpenClaw最佳接入方案-MVP.md](./OpenClaw最佳接入方案-MVP.md) |
| Clawbot 集成 | [archive/clawbot/](./archive/clawbot/) |
| Supabase 认证 | [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) |
| OSS 配置 | [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) |
| 数据库设计 | [database-requirements/DATABASE-REQUIREMENTS.md](./database-requirements/DATABASE-REQUIREMENTS.md) |
| 功能实现 | [FEATURES.md](./FEATURES.md), [feature-implementation/](./feature-implementation/) |
| 项目演进 | [CHANGELOG.md](./CHANGELOG.md) |
| 修复报告 | [fix-reports/](./fix-reports/) |
| 部署 | [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) ⭐ |

### 按文档类型查找

| 类型 | 文档 |
|------|------|
| 集成指南 | [guides/](./guides/) |
| 架构文档 | [三端接通架构文档.md](./三端接通架构文档.md) |
| 集成方案 | [OpenClaw最佳接入方案-MVP.md](./OpenClaw最佳接入方案-MVP.md) |
| 配置文档 | [integration/](./integration/) |
| 功能说明 | [FEATURES.md](./FEATURES.md) |
| 审核报告 | [project-reports/PROJECT_AUDIT_REPORT.md](./project-reports/PROJECT_AUDIT_REPORT.md) |

---

## 📊 文档统计

| 目录 | 文档数量 | 说明 |
|------|----------|------|
| `docs/` (根) | 9 | 核心文档 |
| `docs/integration/` | 3 | 集成配置 |
| `docs/guides/` | 3 | 用户指南 |
| `docs/feature-implementation/` | 4 | 功能实现文档 |
| `docs/fix-reports/` | 3 | 修复报告 |
| `docs/deployment-guides/` | 2 | 部署指南 |
| `docs/project-reports/` | 2 | 项目报告 |
| `docs/api/` | 1 | API 文档 |
| `docs/archive/` | 14+ | 归档文档（含 Nanobot、Clawbot） |
| `src/database/` | 2 | 数据库文档 |
| **总计** | **43+** | - |

---

## 📝 文档规范

### 新建文档

1. 根据内容类型放入对应目录：
   - `guides/` - 用户指南
   - `integration/` - 集成配置
   - 根目录 - 核心文档
2. 使用清晰的标题层级（##, ###）
3. 添加代码示例和图表
4. 更新本文档索引

### 更新文档

1. 在文档顶部添加版本号和更新日期
2. 使用 `---` 分隔主要章节
3. 保持格式一致性
4. 同步更新 [../README.md](../README.md) 和本文档

---

## ❓ 常见问题

### Q: Clawbot 和 Nanobot 有什么区别？

**A**:
- **Clawbot Channel**: 当前使用的方案，通过本地 WebSocket 直连 OpenClaw
- **Nanobot**: 旧方案（已归档），通过云端服务器中转实现三端通信

Nanobot 文档已归档到 [archive/NANOBOT_ARCHIVE.md](./archive/NANOBOT_ARCHIVE.md)。

### Q: 如何快速开始？

**A**: 建议按以下顺序阅读：
1. [PROJECT.md](./project-reports/PROJECT.md) - 了解项目
2. [三端接通架构文档.md](./三端接通架构文档.md) - 了解架构
3. [DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) - 部署上线（可选）

### Q: 我应该使用哪个文档？

**A**:
- **新手**: 从路径 1 开始
- **需要集成 Clawbot**: 路径 2
- **开发新功能**: 路径 3
- **准备上线**: 路径 4

---

**最后更新**: 2026-02-17

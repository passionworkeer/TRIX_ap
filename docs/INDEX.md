# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-02-22
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 文档索引（本文档）
├── development/
│   └── ARCHITECTURE.md               # 架构文档
├── project-reports/
│   ├── PROJECT.md                    # 项目总览
│   ├── PROJECT_AUDIT_P0123_2026-02-22.md  # 最新审计报告
│   └── PROJECT_COMPREHENSIVE_GUIDE.md # 综合指南
├── FEATURES.md                       # 功能文档
├── CHANGELOG.md                      # 开发迭代日志
│
├── database-requirements/
│   └── DATABASE-REQUIREMENTS.md     # 数据库需求
│
├── integration/                      # 集成配置
│   ├── SUPABASE_AUTH.md             # Supabase 认证
│   ├── OSS_CONFIG.md                # 阿里云 OSS 配置
│   └── SERVER_INFO.md               # 服务器信息
│
├── guides/                          # 用户指南
│   ├── QUICK-START-FOCUS-MODE.md    # 专注模式
│   ├── QR_PAIRING_USER_GUIDE.md     # 扫码配对
│   ├── PAIRING_INPUT_GUIDE.md       # 配对输入
│   └── UNPAIR_FEATURE_GUIDE.md      # 解绑功能
│
├── deployment-guides/               # 部署指南
│   ├── DEPLOYMENT_GUIDE.md          # 部署指南
│   └── SERVER_PORTS.md              # 服务器端口
│
├── feature-implementation/          # 功能实现
│   ├── CLAWBOT_PERSISTENT_CONNECTION.md
│   ├── CLAWBOT_REPLY_IMPLEMENTATION.md
│   └── CLAWBOT_REPLY_NOTIFICATION.md
│
├── api/                             # API 文档
│   └── new_clawbot_api.md
│
└── archive/                         # 归档文档（不再维护）
    ├── clawbot/                     # Clawbot 旧文档
    ├── fix-reports/                 # 历史修复报告
    ├── test-reports/                # 历史测试报告
    ├── deployment-logs/             # 历史部署日志
    └── NANOBOT_ARCHIVE.md           # Nanobot 方案归档
```

---

## 📚 文档导航

### 🌟 核心文档（必读）

| 文档 | 描述 |
|------|------|
| [README.md](../README.md) | 项目根 README - 快速开始 |
| [development/ARCHITECTURE.md](./development/ARCHITECTURE.md) | 架构文档 - 技术选型、系统设计 |
| [project-reports/PROJECT.md](./project-reports/PROJECT.md) | 项目总览 - 技术栈、架构、核心模块 |
| [FEATURES.md](./FEATURES.md) | 功能文档 - 双向自习、专注模式、结算弹窗 |
| [CHANGELOG.md](./CHANGELOG.md) | 开发日志 - 项目演进历程和架构决策 |
| [project-reports/PROJECT_AUDIT_P0123_2026-02-22.md](./project-reports/PROJECT_AUDIT_P0123_2026-02-22.md) | 最新审计报告 - P0/P1/P2 问题清单 |

### 🔧 集成配置

| 文档 | 描述 |
|------|------|
| [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) | Supabase 认证系统集成指南 |
| [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) | 阿里云 OSS 配置（文件上传） |
| [integration/SERVER_INFO.md](./integration/SERVER_INFO.md) | 服务器信息汇总 |
| [database-requirements/DATABASE-REQUIREMENTS.md](./database-requirements/DATABASE-REQUIREMENTS.md) | 数据库需求 - 完整的数据访问清单 |

### 🚀 部署上线

| 文档 | 描述 |
|------|------|
| [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) | 完整部署指南 |
| [deployment-guides/SERVER_PORTS.md](./deployment-guides/SERVER_PORTS.md) | 服务器端口配置 |

### 📖 用户指南

| 文档 | 描述 |
|------|------|
| [guides/QUICK-START-FOCUS-MODE.md](./guides/QUICK-START-FOCUS-MODE.md) | 专注模式快速开始 |
| [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) | 扫码配对完整指南 |
| [guides/PAIRING_INPUT_GUIDE.md](./guides/PAIRING_INPUT_GUIDE.md) | 配对输入功能说明 |
| [guides/UNPAIR_FEATURE_GUIDE.md](./guides/UNPAIR_FEATURE_GUIDE.md) | 解绑配对设备操作指南 |

### 📦 功能实现

| 文档 | 描述 |
|------|------|
| [feature-implementation/CLAWBOT_PERSISTENT_CONNECTION.md](./feature-implementation/CLAWBOT_PERSISTENT_CONNECTION.md) | Clawbot 持久连接实现 |
| [feature-implementation/CLAWBOT_REPLY_IMPLEMENTATION.md](./feature-implementation/CLAWBOT_REPLY_IMPLEMENTATION.md) | Clawbot 回复功能实现 |
| [feature-implementation/CLAWBOT_REPLY_NOTIFICATION.md](./feature-implementation/CLAWBOT_REPLY_NOTIFICATION.md) | 回复通知系统实现 |

### 📋 归档文档（不再维护）

| 文档 | 说明 |
|------|------|
| [archive/NANOBOT_ARCHIVE.md](./archive/NANOBOT_ARCHIVE.md) | Nanobot 云端中转方案（已废弃） |
| [archive/clawbot/](./archive/clawbot/) | Clawbot 早期集成文档 |
| [archive/fix-reports/](./archive/fix-reports/) | 历史修复报告 |
| [archive/test-reports/](./archive/test-reports/) | 历史测试报告 |
| [archive/deployment-logs/](./archive/deployment-logs/) | 历史部署日志 |

---

## 🗺️ 推荐阅读路径

### 路径 1: 快速了解项目（15 分钟）⭐

1. [README.md](../README.md) - 快速开始
2. [project-reports/PROJECT.md](./project-reports/PROJECT.md) - 了解技术栈和架构
3. [FEATURES.md](./FEATURES.md) - 了解核心功能
4. [project-reports/PROJECT_AUDIT_P0123_2026-02-22.md](./project-reports/PROJECT_AUDIT_P0123_2026-02-22.md) - 当前问题清单

### 路径 2: 深入架构理解（30 分钟）⭐

1. [development/ARCHITECTURE.md](./development/ARCHITECTURE.md) - 系统架构设计
2. [CHANGELOG.md](./CHANGELOG.md) - 架构决策记录
3. [database-requirements/DATABASE-REQUIREMENTS.md](./database-requirements/DATABASE-REQUIREMENTS.md) - 数据库设计

### 路径 3: 功能开发（1 小时）

1. [FEATURES.md](./FEATURES.md) - 功能实现参考
2. [feature-implementation/](./feature-implementation/) - 具体功能实现
3. [api/new_clawbot_api.md](./api/new_clawbot_api.md) - API 使用指南

### 路径 4: 部署上线（30 分钟）⭐

1. [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) - 完整部署指南
2. [integration/SERVER_INFO.md](./integration/SERVER_INFO.md) - 服务器配置
3. 部署并验证

---

## 🔍 快速查找

### 按主题查找

| 主题 | 文档 |
|------|------|
| 项目架构 | [development/ARCHITECTURE.md](./development/ARCHITECTURE.md) |
| 项目总览 | [project-reports/PROJECT.md](./project-reports/PROJECT.md) |
| 当前问题 | [project-reports/PROJECT_AUDIT_P0123_2026-02-22.md](./project-reports/PROJECT_AUDIT_P0123_2026-02-22.md) |
| 数据库设计 | [database-requirements/DATABASE-REQUIREMENTS.md](./database-requirements/DATABASE-REQUIREMENTS.md) |
| Supabase 认证 | [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) |
| OSS 配置 | [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) |
| 功能实现 | [FEATURES.md](./FEATURES.md) |
| 项目演进 | [CHANGELOG.md](./CHANGELOG.md) |
| 部署 | [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) |

---

## 📊 文档统计

| 目录 | 文档数量 | 状态 |
|------|----------|------|
| `docs/` (根) | 6 | ✅ 维护中 |
| `docs/development/` | 1 | ✅ 维护中 |
| `docs/project-reports/` | 3 | ✅ 维护中 |
| `docs/integration/` | 3 | ✅ 维护中 |
| `docs/guides/` | 5 | ✅ 维护中 |
| `docs/deployment-guides/` | 2 | ✅ 维护中 |
| `docs/feature-implementation/` | 3 | ✅ 维护中 |
| `docs/api/` | 1 | ✅ 维护中 |
| `docs/archive/` | 20+ | 📦 归档（不再维护） |
| **总计** | **44+** | - |

---

## 📝 文档规范

### 新建文档

1. 根据内容类型放入对应目录
2. 使用清晰的标题层级（##, ###）
3. 添加代码示例和图表
4. 在文档顶部注明最后更新日期

### 更新文档

1. 更新文档顶部的日期
2. 保持格式一致性
3. 同步更新 INDEX.md 索引

---

## ❓ 常见问题

### Q: Clawbot 和 Nanobot 有什么区别？

**A**:
- **Clawbot Channel**: 当前使用的方案，通过 WebSocket 直连 OpenClaw
- **Nanobot**: 旧方案（已归档），通过云端服务器中转

Nanobot 文档已归档到 [archive/NANOBOT_ARCHIVE.md](./archive/NANOBOT_ARCHIVE.md)。

### Q: 如何快速开始？

**A**: 建议按以下顺序阅读：
1. [README.md](../README.md) - 快速开始
2. [project-reports/PROJECT.md](./project-reports/PROJECT.md) - 了解项目
3. [deployment-guides/DEPLOYMENT_GUIDE.md](./deployment-guides/DEPLOYMENT_GUIDE.md) - 部署上线（可选）

---

**最后更新**: 2026-02-22

# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-02-15
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
├── nanobot/                         # Nanobot 三端通信 ⭐
│   ├── INTEGRATION_GUIDE.md          # 集成指南
│   ├── IMPLEMENTATION_SUMMARY.md     # 实现总结
│   └── QR_CODE_MODIFICATION.md       # QR 码修改指南
│
├── integration/                      # 集成相关
│   ├── SUPABASE_AUTH.md             # Supabase 认证
│   ├── OSS_CONFIG.md                # 阿里云 OSS 配置
│   └── SERVER_INFO.md               # 服务器信息
│
└── archive/                         # 归档文档
    ├── clawbot/                     # Clawbot 旧文档（已废弃）
    └── old-guides/                  # 其他旧指南
```

---

## 📚 文档导航

### 🌟 核心文档

| 文档 | 描述 |
|------|------|
| [PROJECT.md](./PROJECT.md) | 项目总览 - 技术栈、架构、核心模块 |
| [FEATURES.md](./FEATURES.md) | 功能文档 - 双向自习、专注模式、结算弹窗 |
| [CHANGELOG.md](./CHANGELOG.md) | 开发日志 - 项目演进历程和架构决策 |
| [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) | 数据库需求 - 完整的数据访问清单 |
| [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) | 项目审核报告 - 核心文件、目录结构、潜在问题 |

### 🚀 Nanobot 三端通信 ⭐

| 文档 | 描述 | 适用人群 |
|------|------|----------|
| [nanobot/INTEGRATION_GUIDE.md](./nanobot/INTEGRATION_GUIDE.md) | 完整集成指南 - 云端服务器 + App + 本地 Nanobot 三端连通 | 所有用户 |
| [nanobot/IMPLEMENTATION_SUMMARY.md](./nanobot/IMPLEMENTATION_SUMMARY.md) | 实现总结 - 架构设计、关键实现 | 开发者 |
| [nanobot/QR_CODE_MODIFICATION.md](./nanobot/QR_CODE_MODIFICATION.md) | QR 码修改指南 - 配对码功能定制 | 高级用户 |

### 🔧 集成配置

| 文档 | 描述 |
|------|------|
| [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) | Supabase 认证系统集成指南 |
| [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) | 阿里云 OSS 配置（文件上传） |
| [integration/SERVER_INFO.md](./integration/SERVER_INFO.md) | 服务器信息汇总 |

### 🚀 部署上线

| 文档 | 描述 |
|------|------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 部署指南 - GitHub Actions 自动部署 + 手动部署 + HTTPS |
| - GitHub Actions | 自动部署配置 |
| - 服务器配置 | Nginx、目录、权限 |
| - HTTPS 证书 | Let's Encrypt SSL |

### 📖 归档文档

| 目录              | 说明                           |
|-------------------|--------------------------------|
| archive/clawbot/   | Clawbot 旧文档（已废弃）          |
| archive/old-guides/ | 其他旧指南和文档                |

---

## 🗺️ 推荐阅读路径

### 路径 1: 快速了解项目（10 分钟）⭐

1. [PROJECT.md](./PROJECT.md) - 了解技术栈和架构
2. [FEATURES.md](./FEATURES.md) - 了解核心功能
3. [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) - 核心文件和潜在问题

### 路径 2: Nanobot 三端集成（30 分钟）⭐

1. [nanobot/INTEGRATION_GUIDE.md](./nanobot/INTEGRATION_GUIDE.md) - 三端连通指南
2. 启动云端服务器、本地 Nanobot、App 三端
3. 测试配对和消息收发

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
| 项目架构 | [PROJECT.md](./PROJECT.md), [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) |
| Nanobot 三端 | [nanobot/INTEGRATION_GUIDE.md](./nanobot/INTEGRATION_GUIDE.md) ⭐ |
| Supabase 认证 | [integration/SUPABASE_AUTH.md](./integration/SUPABASE_AUTH.md) |
| OSS 配置 | [integration/OSS_CONFIG.md](./integration/OSS_CONFIG.md) |
| 数据库设计 | [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) |
| 功能实现 | [FEATURES.md](./FEATURES.md) |
| 项目演进 | [CHANGELOG.md](./CHANGELOG.md) |
| 部署 | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) ⭐ |

### 按文档类型查找

| 类型 | 文档 |
|------|------|
| 集成指南 | [nanobot/INTEGRATION_GUIDE.md](./nanobot/INTEGRATION_GUIDE.md) |
| 实现总结 | [nanobot/IMPLEMENTATION_SUMMARY.md](./nanobot/IMPLEMENTATION_SUMMARY.md) |
| 配置文档 | [integration/](./integration/) |
| 功能说明 | [FEATURES.md](./FEATURES.md) |
| 审核报告 | [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) ⭐ |

---

## 📊 文档统计

| 目录 | 文档数量 | 说明 |
|------|----------|------|
| `docs/` (根) | 7 | 核心文档 |
| `docs/nanobot/` | 3 | Nanobot 三端通信 ⭐ |
| `docs/integration/` | 3 | 集成配置 |
| `docs/archive/` | 12+ | 归档文档 |
| `src/database/` | 2 | 数据库文档 |
| **总计** | **27+** | - |

---

## 📝 文档规范

### 新建文档

1. 根据内容类型放入对应目录：
   - `nanobot/` - Nanobot 相关
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

**A**: Clawbot 是旧的本地 WebSocket 方案，Nanobot 是新的云端中转方案。项目已切换到 Nanobot 架构，Clawbot 文档已归档到 [archive/clawbot/](./archive/clawbot/)。

### Q: 如何快速开始？

**A**: 建议按以下顺序阅读：
1. [PROJECT.md](./PROJECT.md) - 了解项目
2. [nanobot/INTEGRATION_GUIDE.md](./nanobot/INTEGRATION_GUIDE.md) - 启动三端
3. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 部署上线（可选）

### Q: 我应该使用哪个文档？

**A**:
- **新手**: 从路径 1 开始
- **需要集成 Nanobot**: 路径 2
- **开发新功能**: 路径 3
- **准备上线**: 路径 4

---

**最后更新**: 2026-02-15

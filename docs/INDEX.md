# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-02-14
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                               # 文档索引
├── PROJECT.md                             # 项目概览
├── CHANGELOG.md                           # 开发迭代日志
├── DATABASE-REQUIREMENTS.md               # 数据库需求
├── PROJECT_AUDIT_REPORT.md                # 项目审核报告 ⭐ 新增
├── TECH_STACK_AND_HIGHLIGHTS.md          # 技术栈与核心亮点 ⭐ 新增
├── NANOBOT_INTEGRATION_GUIDE.md         # Nanobot 集成指南 ⭐ 整合
├── DEPLOYMENT_GUIDE.md                      # 部署完整指南 ⭐ 整合
├── SUPABASE_AUTH_INTEGRATION_GUIDE.md  # Supabase 认证集成
├── NANOBOT_IMPLEMENTATION_SUMMARY.md    # Nanobot 实现总结
│
├── config/                                # 配置文档
│   ├── OSS_CONFIG.md                   # OSS 配置
│   └── SERVER_INFO.md                  # 服务器信息
│
├── guides/                                # 用户指南 (6 个)
│   ├── CLAWBOT_QUICK_START.md          # 快速开始
│   ├── CLAWBOT_SIMPLE_IMPLEMENTATION.md # 简化实现
│   ├── CLAWBOT_INTEGRATION_GUIDE.md   # 完整实现
│   ├── QR_PAIRING_USER_GUIDE.md         # 扫码配对
│   ├── QUICK-START-FOCUS-MODE.md        # 专注模式
│   └── PAIRING_INPUT_GUIDE.md           # 配对输入
│
├── api/                                   # API 文档 (3 个)
│   ├── CLAWBOT_GATEWAY_INTEGRATION.md   # WebSocket 协议
│   ├── CLAWBOT_PAIRING_FIELDS_SPEC.md   # 配对字段
│   └── new_clawbot_api.md               # Clawbot API
│
├── deployment/                            # 部署目录 (已整合)
│
├── features/                              # 功能文档 (3 个)
│   ├── FEATURES-STUDY-BUDDIES.md     # 学习伙伴
│   ├── FOCUS-TIME-AND-COMPANION-MODE.md  # 专注模式
│   └── STUDY-SUMMARY-MODAL.md         # 学习总结
│
└── archive/                               # 归档文档 (4 个)
    ├── guide-old.md                    # 旧指南
    ├── MEDIA_URL_DEBUG.md               # 调试记录
    ├── QR_PAIRING_IMPLEMENTATION.md   # 配对实现
    └── TRIX_INTEGRATION_GUIDE.md      # 集成指南

src/database/
├── README.md                              # 数据库配置
└── SCHEMA.md                              # 数据库架构
```

---

## 📚 文档导航

### 🆕 新增文档

| 文档 | 描述 |
|------|------|
| [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) | 项目审核报告 - 核心文件、目录结构、潜在问题 |
| [TECH_STACK_AND_HIGHLIGHTS.md](./TECH_STACK_AND_HIGHLIGHTS.md) | 技术栈与核心亮点 - 技术选型、架构设计、关键技术实现 |
| [NANOBOT_INTEGRATION_GUIDE.md](./NANOBOT_INTEGRATION_GUIDE.md) | Nanobot 集成指南 - 云端服务器 + App + 本地 Nanobot 三端连通 |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 部署完整指南 - GitHub Actions 自动部署 + 手动部署 + HTTPS |

### 新手入门

1. **[../README.md](../README.md)** - 项目介绍和快速开始
2. **[PROJECT.md](./PROJECT.md)** - 项目结构和技术栈
3. **[PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md)** - 了解项目核心文件和潜在问题 ⭐ 推荐

### Clawbot 集成

| 文档 | 描述 | 适用场景 |
|------|------|----------|
| [CLAWBOT_README.md](./CLAWBOT_README.md) | 文档索引和导航 | 快速查找 |
| [guides/CLAWBOT_QUICK_START.md](./guides/CLAWBOT_QUICK_START.md) | 5 分钟上手 | 初次集成 |
| [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) | 简化版实现（~150 行） | 开发测试 |
| [guides/CLAWBOT_INTEGRATION_GUIDE.md](./guides/CLAWBOT_INTEGRATION_GUIDE.md) | 完整版实现（~500 行） | 生产环境 |
| [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) | 协议规范 | 深度定制 |
| [api/CLAWBOT_PAIRING_FIELDS_SPEC.md](./api/CLAWBOT_PAIRING_FIELDS_SPEC.md) | 配对字段规范 | 数据对接 |

### Nanobot 三端连通 ⭐

| 文档 | 描述 | 适用人群 |
|------|------|----------|
| [NANOBOT_INTEGRATION_GUIDE.md](./NANOBOT_INTEGRATION_GUIDE.md) | 完整集成指南 | 所有用户 |
| - 架构概览 | 三端通信架构图 | 了解系统 |
| - 快速启动 | 三端启动命令 | 快速开始 |
| - 云端配置 | 服务器安装和启动 | 运维人员 |
| - 本地配置 | Nanobot 和 App 配置 | 开发者 |
| - 消息协议 | WebSocket 消息格式 | 集成开发 |

### Supabase 集成

| 文档 | 描述 |
|------|------|
| [SUPABASE_AUTH_INTEGRATION_GUIDE.md](./SUPABASE_AUTH_INTEGRATION_GUIDE.md) | Supabase 认证系统集成指南 |
| [config/OSS_CONFIG.md](./config/OSS_CONFIG.md) | 阿里云 OSS 配置 |
| [config/SERVER_INFO.md](./config/SERVER_INFO.md) | 服务器信息汇总 |

### 部署上线 ⭐

| 文档 | 描述 |
|------|------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 完整部署指南 |
| - GitHub Actions | 自动部署配置 |
| - 服务器配置 | Nginx、目录、权限 |
| - HTTPS 证书 | Let's Encrypt SSL |
| - 手动部署 | 本地构建、上传、解压 |
| - 故障排查 | 常见问题解决 |

### 功能开发

| 文档 | 描述 |
|------|------|
| [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) | 双向自习功能 |
| [features/FOCUS-TIME-AND-COMPANION-MODE.md](./features/FOCUS-TIME-AND-COMPANION-MODE.md) | 专注与陪伴模式 |
| [features/STUDY-SUMMARY-MODAL.md](./features/STUDY-SUMMARY-MODAL.md) | 学习总结弹窗 |

### 数据库

| 文档 | 描述 |
|------|------|
| [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) | 完整数据访问清单 |
| [src/database/README.md](../src/database/README.md) | 数据库配置指南 |
| [src/database/SCHEMA.md](../src/database/SCHEMA.md) | 数据库架构文档 |

### 开发记录

| 文档 | 描述 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | 项目演进历程和架构决策 |
| [NANOBOT_IMPLEMENTATION_SUMMARY.md](./NANOBOT_IMPLEMENTATION_SUMMARY.md) | Nanobot 实现总结 |

---

## 📖 推荐阅读路径

### 路径 1: 快速了解项目（5 分钟）

1. [../README.md](../README.md) - 了解项目
2. [PROJECT.md](./PROJECT.md) - 技术栈和结构
3. [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) - 核心文件和问题 ⭐

### 路径 2: Nanobot 集成（20 分钟）⭐

1. [NANOBOT_INTEGRATION_GUIDE.md](./NANOBOT_INTEGRATION_GUIDE.md) - 三端连通指南
2. 快速启动三端
3. 测试配对和消息

### 路径 3: Clawbot 集成（15 分钟）

1. [guides/CLAWBOT_QUICK_START.md](./guides/CLAWBOT_QUICK_START.md) - 快速上手
2. [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) - 代码示例
3. [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) - 协议详情

### 路径 4: 功能开发（30 分钟）

1. [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) - 数据库设计
2. [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) - 功能实现参考
3. [CHANGELOG.md](./CHANGELOG.md) - 架构决策

### 路径 5: 部署上线（20 分钟）⭐

1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完整部署指南
2. 配置 GitHub Actions
3. 配置 HTTPS 证书

### 路径 6: 深入学习技术（1 小时）⭐

1. [TECH_STACK_AND_HIGHLIGHTS.md](./TECH_STACK_AND_HIGHLIGHTS.md) - 技术栈详解
2. [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) - 架构分析
3. [CHANGELOG.md](./CHANGELOG.md) - 技术决策

---

## 🔍 快速查找

### 按主题查找

| 主题 | 文档 |
|------|------|
| 项目架构 | [PROJECT.md](./PROJECT.md), [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) |
| WebSocket / Clawbot | [CLAWBOT_README.md](./CLAWBOT_README.md) |
| Nanobot 三端 | [NANOBOT_INTEGRATION_GUIDE.md](./NANOBOT_INTEGRATION_GUIDE.md) ⭐ |
| Supabase 认证 | [SUPABASE_AUTH_INTEGRATION_GUIDE.md](./SUPABASE_AUTH_INTEGRATION_GUIDE.md) |
| OSS 配置 | [config/OSS_CONFIG.md](./config/OSS_CONFIG.md) |
| 扫码配对 | [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) |
| 数据库设计 | [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) |
| 学习伙伴功能 | [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) |
| 项目演进 | [CHANGELOG.md](./CHANGELOG.md) |
| 部署 | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) ⭐ |
| 技术栈 | [TECH_STACK_AND_HIGHLIGHTS.md](./TECH_STACK_AND_HIGHLIGHTS.md) ⭐ |

### 按文档类型查找

| 类型 | 文档 |
|------|------|
| 协议规范 | [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) |
| 代码示例 | [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) |
| 用户指南 | [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) |
| 问题排查 | [api/CLAWBOT_GATEWAY_INTEGRATION.md#故障排查](./api/CLAWBOT_GATEWAY_INTEGRATION.md) |
| 审核报告 | [PROJECT_AUDIT_REPORT.md](./PROJECT_AUDIT_REPORT.md) ⭐ |

---

## 📊 文档统计

| 目录 | 文档数量 | 说明 |
|------|----------|------|
| `docs/` (根) | 10 | 核心文档 |
| `docs/config/` | 2 | 配置文档 |
| `docs/guides/` | 6 | 用户指南 |
| `docs/api/` | 3 | API 规范 |
| `docs/features/` | 3 | 功能说明 |
| `docs/archive/` | 4 | 归档文档 |
| `docs/deployment/` | 0 | 已整合 |
| `src/database/` | 2 | 数据库文档 |
| **总计** | **30** | - |

---

## 📝 文档规范

### 新建文档

1. 根据内容类型放入对应目录：
   - `guides/` - 用户指南、快速开始
   - `api/` - 协议规范、API 文档
   - `features/` - 功能说明
   - `config/` - 配置文档
2. 使用清晰的标题层级
3. 添加代码示例
4. 更新本文档索引

### 更新文档

1. 在文档顶部添加版本号和更新日期
2. 使用 `---` 分隔主要章节
3. 保持格式一致性
4. 同步更新 [../README.md](../README.md) 和本文档

---

**最后更新**: 2026-02-14

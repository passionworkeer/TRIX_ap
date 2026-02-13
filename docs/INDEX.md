# TRIX 3D Companion - 文档索引

> **最后更新**: 2026-02-13
> **维护者**: TRIX 3D Companion 开发团队

---

## 📁 文档结构

```
docs/
├── INDEX.md                          # 本文档 - 文档索引
├── PROJECT.md                        # 项目概览
├── CHANGELOG.md                      # 开发迭代日志
├── DATABASE-REQUIREMENTS.md          # 数据库需求
├── CLAWBOT_README.md                 # Clawbot 文档索引
│
├── guides/                           # 用户指南和快速开始
│   ├── CLAWBOT_QUICK_START.md        # 快速开始（5 分钟上手）
│   ├── CLAWBOT_SIMPLE_IMPLEMENTATION.md  # 简化版实现（~150 行）
│   ├── CLAWBOT_INTEGRATION_GUIDE.md  # 完整版实现（~500 行）
│   ├── QR_PAIRING_USER_GUIDE.md      # 扫码配对用户指南
│   ├── QUICK-START-FOCUS-MODE.md     # 专注模式快速开始
│   └── PAIRING_INPUT_GUIDE.md        # 配对输入指南
│
├── api/                              # API 文档和协议规范
│   ├── CLAWBOT_GATEWAY_INTEGRATION.md    # WebSocket 协议规范
│   ├── CLAWBOT_PAIRING_FIELDS_SPEC.md    # 配对字段规范
│   └── new_clawbot_api.md            # Clawbot API 文档
│
├── deployment/                       # 部署相关文档
│   ├── DEPLOY.md                     # 服务器部署指南
│   ├── AUTO_DEPLOY.md                # 自动部署脚本
│   └── HTTPS_SETUP_GUIDE.md          # HTTPS 设置指南
│
├── features/                         # 功能说明文档
│   ├── FEATURES-STUDY-BUDDIES.md     # 学习伙伴功能
│   ├── FOCUS-TIME-AND-COMPANION-MODE.md  # 专注与陪伴模式
│   └── STUDY_SUMMARY_MODAL.md        # 学习总结弹窗
│
└── archive/                          # 归档文档（已过时或重复）
    ├── QR_PAIRING_IMPLEMENTATION.md  # 配对实现（已整合）
    ├── MEDIA_URL_DEBUG.md            # 调试文档（已过时）
    └── TRIX_INTEGRATION_GUIDE.md     # 外部集成指南（重复）

src/database/
├── README.md                         # 数据库配置指南
└── SCHEMA.md                         # 数据库架构文档
```

---

## 📚 文档导航

### 新手入门

1. **[../README.md](../README.md)** - 项目介绍和快速开始
2. **[PROJECT.md](./PROJECT.md)** - 项目结构和技术栈
3. **[guides/CLAWBOT_QUICK_START.md](./guides/CLAWBOT_QUICK_START.md)** - Clawbot 集成快速指南

### Clawbot 集成

| 文档 | 描述 | 适用场景 |
|------|------|----------|
| [CLAWBOT_README.md](./CLAWBOT_README.md) | 文档索引和导航 | 快速查找 |
| [guides/CLAWBOT_QUICK_START.md](./guides/CLAWBOT_QUICK_START.md) | 5 分钟上手 | 初次集成 |
| [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) | 简化版实现（~150 行） | 开发测试 |
| [guides/CLAWBOT_INTEGRATION_GUIDE.md](./guides/CLAWBOT_INTEGRATION_GUIDE.md) | 完整版实现（~500 行） | 生产环境 |
| [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) | 协议规范 | 深度定制 |
| [api/CLAWBOT_PAIRING_FIELDS_SPEC.md](./api/CLAWBOT_PAIRING_FIELDS_SPEC.md) | 配对字段规范 | 数据对接 |

### 用户指南

| 文档 | 描述 |
|------|------|
| [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) | 扫码配对完整指南 |
| [guides/QUICK-START-FOCUS-MODE.md](./guides/QUICK-START-FOCUS-MODE.md) | 专注模式快速开始 |
| [guides/PAIRING_INPUT_GUIDE.md](./guides/PAIRING_INPUT_GUIDE.md) | 配对输入指南 |

### 功能开发

| 文档 | 描述 |
|------|------|
| [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) | 双向自习功能 |
| [features/FOCUS-TIME-AND-COMPANION-MODE.md](./features/FOCUS-TIME-AND-COMPANION-MODE.md) | 专注与陪伴模式 |
| [features/STUDY_SUMMARY_MODAL.md](./features/STUDY_SUMMARY_MODAL.md) | 学习总结弹窗 |

### 部署运维

| 文档 | 描述 |
|------|------|
| [deployment/DEPLOY.md](./deployment/DEPLOY.md) | 服务器部署指南 |
| [deployment/AUTO_DEPLOY.md](./deployment/AUTO_DEPLOY.md) | 自动部署脚本 |
| [deployment/HTTPS_SETUP_GUIDE.md](./deployment/HTTPS_SETUP_GUIDE.md) | HTTPS 证书配置 |

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

---

## 📖 推荐阅读路径

### 路径 1: 快速了解项目（5 分钟）

1. [../README.md](../README.md) - 了解项目
2. [PROJECT.md](./PROJECT.md) - 技术栈和结构

### 路径 2: Clawbot 集成（15 分钟）

1. [guides/CLAWBOT_QUICK_START.md](./guides/CLAWBOT_QUICK_START.md) - 快速上手
2. [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) - 代码示例
3. [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) - 协议详情

### 路径 3: 功能开发（30 分钟）

1. [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) - 数据库设计
2. [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) - 功能实现参考
3. [CHANGELOG.md](./CHANGELOG.md) - 架构决策

### 路径 4: 部署上线（20 分钟）

1. [deployment/DEPLOY.md](./deployment/DEPLOY.md) - 基础部署
2. [deployment/HTTPS_SETUP_GUIDE.md](./deployment/HTTPS_SETUP_GUIDE.md) - 安全配置
3. [deployment/AUTO_DEPLOY.md](./deployment/AUTO_DEPLOY.md) - 自动化

---

## 🔍 快速查找

### 按主题查找

| 主题 | 文档 |
|------|------|
| **WebSocket / Clawbot** | [CLAWBOT_README.md](./CLAWBOT_README.md) |
| **扫码配对** | [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) |
| **数据库设计** | [DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md) |
| **学习伙伴功能** | [features/FEATURES-STUDY-BUDDIES.md](./features/FEATURES-STUDY-BUDDIES.md) |
| **项目演进** | [CHANGELOG.md](./CHANGELOG.md) |
| **部署** | [deployment/DEPLOY.md](./deployment/DEPLOY.md) |

### 按文档类型查找

| 类型 | 文档 |
|------|------|
| **协议规范** | [api/CLAWBOT_GATEWAY_INTEGRATION.md](./api/CLAWBOT_GATEWAY_INTEGRATION.md) |
| **代码示例** | [guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) |
| **用户指南** | [guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) |
| **问题排查** | [api/CLAWBOT_GATEWAY_INTEGRATION.md#故障排查](./api/CLAWBOT_GATEWAY_INTEGRATION.md) |

---

## 🗂️ 归档文档说明

以下文档已归档到 `archive/` 目录：

| 文档 | 说明 | 状态 |
|------|------|------|
| [archive/QR_PAIRING_IMPLEMENTATION.md](./archive/QR_PAIRING_IMPLEMENTATION.md) | 配对功能实现细节 | 已整合到 guides/QR_PAIRING_USER_GUIDE.md |
| [archive/MEDIA_URL_DEBUG.md](./archive/MEDIA_URL_DEBUG.md) | 媒体 URL 调试记录 | 已过时 |
| [archive/TRIX_INTEGRATION_GUIDE.md](./archive/TRIX_INTEGRATION_GUIDE.md) | 外部集成指南 | 内容与 Clawbot 文档重复 |

> 💡 **提示**: 归档文档仅供参考，不建议在新开发中使用。

---

## 📝 文档规范

### 新建文档

1. 根据内容类型放入对应目录：
   - `guides/` - 用户指南、快速开始
   - `api/` - 协议规范、API 文档
   - `deployment/` - 部署相关
   - `features/` - 功能说明
2. 使用清晰的标题层级
3. 添加代码示例
4. 更新本文档索引

### 更新文档

1. 在文档顶部添加版本号和更新日期
2. 使用 `---` 分隔主要章节
3. 保持格式一致性
4. 同步更新 [../README.md](../README.md) 和本文档

---

## 📊 文档统计

| 目录 | 文档数量 | 说明 |
|------|----------|------|
| `docs/` (根) | 5 | 核心索引文档 |
| `docs/guides/` | 6 | 用户指南 |
| `docs/api/` | 3 | API 规范 |
| `docs/deployment/` | 3 | 部署文档 |
| `docs/features/` | 3 | 功能说明 |
| `docs/archive/` | 3 | 归档文档 |
| `src/database/` | 2 | 数据库文档 |
| **总计** | **25** | - |

---

**最后更新**: 2026-02-13

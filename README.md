# TRIX 3D Companion

> 一款面向移动端的 AI 伴侣应用，采用 **Zero UI** 设计理念

[![React](https://img.shields.io/badge/React-19.2.4-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

---

## ✨ 特性

- 🎭 **Zero UI 设计** - 首页仅展示全屏 3D 角色，点击后显示功能面板
- 🤖 **AI 对话** - 通过 WebSocket 连接本地 Clawbot Gateway，实现流式 AI 响应
- 👥 **社交功能** - 好友聊天、实时消息、未读提醒
- ⏱️ **学习计时** - 番茄钟学习工具，支持状态同步和虚拟自习室
- 📍 **实时位置** - 基于 Leaflet 的地图共享
- 🗣️ **语音交互** - 集成 Web Speech API 语音识别
- 📧 **通知系统** - 系统通知和邮件中心
- 📱 **扫码配对** - 手机端与电脑端 Gateway 通过二维码配对

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装

```bash
git clone https://github.com/your-repo/trix-3d-companion.git
cd trix-3d-companion
npm install
```

### 配置

创建 `.env` 文件：

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
VITE_PC_AUTH_TOKEN=<your-gateway-token>
```

### 启动

```bash
npm run dev
```

访问 http://localhost:5173

---

## 📚 文档

### 快速导航

| 文档 | 说明 |
|------|------|
| **[docs/PROJECT.md](./docs/PROJECT.md)** | 项目结构、技术栈、核心模块 |
| **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** | 开发迭代日志和架构决策 |
| **[docs/INDEX.md](./docs/INDEX.md)** | 完整文档索引 |

### 用户指南

位于 `docs/guides/` 目录：

| 文档 | 说明 |
|------|------|
| [Clawbot 快速开始](./docs/guides/CLAWBOT_QUICK_START.md) | 5 分钟上手 Clawbot 集成 |
| [扫码配对指南](./docs/guides/QR_PAIRING_USER_GUIDE.md) | 手机与电脑配对完整指南 |
| [专注模式快速开始](./docs/guides/QUICK-START-FOCUS-MODE.md) | 学习计时功能使用指南 |
| [简化版实现](./docs/guides/CLAWBOT_SIMPLE_IMPLEMENTATION.md) | ~150 行代码的最小实现 |
| [完整版实现](./docs/guides/CLAWBOT_INTEGRATION_GUIDE.md) | ~500 行的生产级实现 |

### API 文档

位于 `docs/api/` 目录：

| 文档 | 说明 |
|------|------|
| [WebSocket 协议规范](./docs/api/CLAWBOT_GATEWAY_INTEGRATION.md) | Clawbot Gateway 通信协议 |
| [配对字段规范](./docs/api/CLAWBOT_PAIRING_FIELDS_SPEC.md) | 配对系统数据字段定义 |
| [Clawbot API 文档](./docs/api/new_clawbot_api.md) | Clawbot API 使用指南 |

### 部署文档

位于 `docs/deployment/` 目录：

| 文档 | 说明 |
|------|------|
| [服务器部署指南](./docs/deployment/DEPLOY.md) | 2GB 内存服务器部署方案 |
| [自动部署](./docs/deployment/AUTO_DEPLOY.md) | 自动化部署脚本 |
| [HTTPS 设置](./docs/deployment/HTTPS_SETUP_GUIDE.md) | HTTPS 证书配置指南 |

### 功能文档

位于 `docs/features/` 目录：

| 文档 | 说明 |
|------|------|
| [学习伙伴功能](./docs/features/FEATURES-STUDY-BUDDIES.md) | 双向自习室功能说明 |
| [专注与陪伴模式](./docs/features/FOCUS-TIME-AND-COMPANION-MODE.md) | 专注时间和陪伴模式 |
| [学习总结弹窗](./docs/features/STUDY_SUMMARY_MODAL.md) | 学习总结功能 |

### 数据库文档

| 文档 | 说明 |
|------|------|
| [src/database/SCHEMA.md](./src/database/SCHEMA.md) | 数据库架构详细文档 |
| [src/database/README.md](./src/database/README.md) | 数据库配置指南 |
| [docs/DATABASE-REQUIREMENTS.md](./docs/DATABASE-REQUIREMENTS.md) | 数据访问清单 |

---

## 🏗️ 项目结构

```
src/
├── components/           # UI 组件
│   ├── GlassDock.tsx    # 底部导航栏（毛玻璃效果）
│   ├── HeroBackground.tsx # 首页全屏背景
│   └── ...
├── screens/             # 页面组件
│   ├── Home.tsx         # 首页（3D 角色展示）
│   ├── Chat.tsx         # 聊天列表
│   ├── ChatDetail.tsx   # 聊天详情（支持 Bot/好友）
│   ├── Study.tsx        # 学习计时器
│   └── ...
├── contexts/            # React Context
│   ├── AuthContext.tsx  # 认证状态
│   ├── WebSocketContext.tsx # Bot 连接管理
│   └── QRCodePairingContext.tsx # 配对管理
├── services/            # 业务服务
│   ├── clawbotPairingService.ts # 配对服务
│   ├── databaseService.ts # 数据库操作
│   └── projectService.ts  # 项目管理
├── types/
│   └── clawbot.ts       # Clawbot 类型定义
└── database/            # 数据库脚本
    ├── init.sql         # 初始化脚本
    └── SCHEMA.md        # 架构文档
```

---

## 🎨 核心架构

### 三层布局

```
┌─────────────────────────────────────┐
│  HeroBackground (固定全屏)          │  ← 背景层
├─────────────────────────────────────┤
│  Routes (可滚动内容)                │  ← 内容层
├─────────────────────────────────────┤
│  GlassDock (悬浮导航)               │  ← 悬浮层
└─────────────────────────────────────┘
```

### WebSocket 流程

```
┌───────────┐       WebSocket        ┌──────────────┐
│  Mobile   │ ──────────────────────> │   Clawbot    │
│    App    │      流式 AI 响应       │   Gateway    │
└───────────┘                        └──────────────┘
```

### 数据流

```
┌───────────┐   Supabase   ┌──────────┐
│  Mobile   │ <───────────> │Database  │
│    App    │   Realtime   │ (Postgres)│
└───────────┘              └──────────┘
```

---

## 🔧 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 路由 | React Router v7 |
| 数据库 | Supabase (PostgreSQL) |
| 实时通信 | WebSocket + Supabase Realtime |
| 动画 | Framer Motion 12 |
| 地图 | Leaflet |
| 样式 | Tailwind CSS (CDN) |

---

## 📦 构建

```bash
npm run build
```

输出目录：`dist/`

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## 👥 作者

TRIX 3D Companion 开发团队

---

**最后更新**: 2026-02-13

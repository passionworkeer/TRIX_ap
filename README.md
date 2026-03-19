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
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
```

> **说明**：`VITE_TRIX_NATIVE_SERVER_URL` 推荐使用 TRIX Native Channel。
> 旧的 `VITE_CLAWBOT_CHANNEL_URL`、`VITE_GATEWAY_WS_URL`、`VITE_GATEWAY_AUTH_TOKEN` 已废弃。

### 启动

```bash
npm run dev
```

访问 http://localhost:5173

---

## 📚 文档

> 📚 完整文档索引请参考：**[docs/INDEX.md](./docs/INDEX.md)**

### 核心文档

| 文档 | 说明 |
|------|------|
| **[docs/INDEX.md](./docs/INDEX.md)** | 📚 完整文档索引 |
| **[docs/development/ARCHITECTURE.md](./docs/development/ARCHITECTURE.md)** | 🏗️ 系统架构文档 |
| **[docs/project-reports/PROJECT.md](./docs/project-reports/PROJECT.md)** | 📊 项目总览 |
| **[docs/project-reports/PROJECT_AUDIT_P0123_2026-02-22.md](./docs/project-reports/PROJECT_AUDIT_P0123_2026-02-22.md)** | 🔍 最新审计报告 |
| **[docs/FEATURES.md](./docs/FEATURES.md)** | ✨ 功能文档 |
| **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** | 📝 开发迭代日志 |

### 快速指南

| 文档 | 说明 |
|------|------|
| [扫码配对指南](./docs/guides/QR_PAIRING_USER_GUIDE.md) | 手机与电脑配对完整指南 |
| [专注模式快速开始](./docs/guides/QUICK-START-FOCUS-MODE.md) | 学习计时功能使用指南 |
| [解绑功能指南](./docs/guides/UNPAIR_FEATURE_GUIDE.md) | 解绑配对设备操作指南 |

### 部署文档

| 文档 | 说明 |
|------|------|
| [服务器部署指南](./docs/deployment-guides/DEPLOYMENT_GUIDE.md) | 完整部署方案 |
| [服务器端口说明](./docs/deployment-guides/SERVER_PORTS.md) | 端口配置和说明 |

### 数据库文档

| 文档 | 说明 |
|------|------|
| [database/docs/SCHEMA.md](./database/docs/SCHEMA.md) | 数据库架构详细文档 |
| [数据库需求文档](./docs/database-requirements/DATABASE-REQUIREMENTS.md) | 数据访问清单 |

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
| 样式 | Tailwind CSS (Vite build pipeline) |

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

**最后更新**: 2026-03-19

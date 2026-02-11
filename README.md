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

### 项目文档

- **[项目概览](./docs/PROJECT.md)** - 项目结构、技术栈、核心模块说明
- **[开发迭代日志](./docs/CHANGELOG.md)** - 项目演进历程和架构决策
- **[数据库需求](./docs/DATABASE-REQUIREMENTS.md)** - 完整的数据访问清单

### Clawbot 集成

> 📖 **新手推荐**: 从[快速开始指南](./docs/CLAWBOT_QUICK_START.md)入手

- **[快速开始](./docs/CLAWBOT_QUICK_START.md)** - 5分钟上手
- **[简化版实现](./docs/CLAWBOT_SIMPLE_IMPLEMENTATION.md)** - 最小化代码示例（~150行）
- **[完整实现方案](./docs/CLAWBOT_INTEGRATION_GUIDE.md)** - 生产级实现（~500行）
- **[协议规范](./docs/CLAWBOT_GATEWAY_INTEGRATION.md)** - WebSocket 协议详细说明
- **[文档索引](./docs/CLAWBOT_README.md)** - 所有 Clawbot 文档导航

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
│   └── WebSocketContext.tsx # Bot 连接管理
├── services/            # 业务服务
│   ├── databaseService.ts # 数据库操作
│   └── projectService.ts  # 项目管理
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

## 🧪 测试

```bash
npm run test
```

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

## 🙏 致谢

- [Clawbot](https://molt.bot) - AI Agent 框架
- [Supabase](https://supabase.com) - 开源 Firebase 替代
- [Framer Motion](https://www.framer.com/motion/) - React 动画库
- [Leaflet](https://leafletjs.com/) - 开源地图库

---

**最后更新**: 2026-02-11

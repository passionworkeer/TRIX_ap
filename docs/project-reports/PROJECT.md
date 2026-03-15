# TRIX 3D Companion - 项目总览

> **最后更新**: 2026-03-15
> **版本**: v1.0
> **技术栈**: React 19 + TypeScript + Vite 6 + Supabase + SwiftUI

---

## 📋 项目简介

**TRIX 3D Companion** 是一款面向移动端的 AI 伴侣应用，核心理念为 **"Zero UI" 沉浸式交互**。

### 核心特性

- 🎭 **Zero UI 设计** - 首页仅展示全屏 3D 角色，点击后显示功能面板
- 🤖 **AI 对话** - 通过 WebSocket 连接 Clawbot Gateway，实现流式 AI 响应
- 📱 **TRIX Native** - 通过 OpenClaw 平台实现 iOS 与 Web 双向消息同步
- 👥 **社交功能** - 好友聊天、实时消息、未读提醒
- ⏱️ **学习计时** - 番茄钟学习工具，支持状态同步和虚拟自习室
- 🗣️ **语音交互** - TTS 语音合成（豆包集成）、语音识别
- 📱 **扫码配对** - 手机端与电脑端 Gateway 通过二维码配对

---

## 🏗️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React + TypeScript | 19.2.4 / 5.8.2 |
| 构建 | Vite | 6.2.0 |
| 路由 | React Router | v7 (HashRouter) |
| 数据库 | Supabase (PostgreSQL) | - |
| 实时通信 | WebSocket + Supabase Realtime | - |
| 动画 | Framer Motion | 12.33.0 |
| 地图 | Leaflet + React Leaflet | - |
| 样式 | Tailwind CSS | - |
| 国际化 | i18next | - |

---

## 📁 项目结构

```
trix-3d-companion/
├── src/                          # 前端源代码
│   ├── components/               # UI 组件 (60+)
│   │   ├── common/               # 通用组件
│   │   ├── layout/               # 布局组件
│   │   ├── modals/               # 模态框
│   │   ├── chat/                 # 聊天相关
│   │   ├── study/                # 学习相关
│   │   └── map/                  # 地图相关
│   │
│   ├── screens/                  # 页面组件 (12个)
│   │   ├── Home.tsx              # 首页
│   │   ├── Chat.tsx              # 聊天列表
│   │   ├── ChatDetail.tsx        # 聊天详情
│   │   ├── Study.tsx             # 学习计时器
│   │   ├── Profile.tsx           # 个人中心
│   │   ├── Map.tsx               # 地图
│   │   ├── Auth.tsx              # 登录/注册
│   │   ├── Pairing.tsx           # PC 配对
│   │   ├── QRCodePairing.tsx     # 二维码配对
│   │   ├── Snapshot.tsx          # 拍照截图
│   │   └── Diagnostic.tsx        # 诊断工具
│   │
│   ├── features/                 # 功能模块
│   │   ├── chat/                 # 聊天功能
│   │   │   ├── components/       # 聊天组件
│   │   │   ├── hooks/            # 聊天 Hooks
│   │   │   └── utils/            # 聊天工具
│   │   └── study/                # 学习功能
│   │       └── components/       # 学习组件
│   │
│   ├── contexts/                 # React Context (6个)
│   │   ├── AuthContext.tsx       # 认证状态
│   │   ├── ThemeContext.tsx      # 主题状态
│   │   ├── ClawbotChannelContext.tsx  # Bot 连接管理
│   │   ├── QRCodePairingContext.tsx   # 配对管理
│   │   └── VoiceSettingsContext.tsx   # 语音设置
│   │
│   ├── services/                 # 业务服务层 (12个)
│   │   ├── databaseService.ts    # 数据库操作
│   │   ├── ClawbotChannelBridge.ts    # Bot 通信桥
│   │   ├── clawbotPairingService.ts   # 配对服务
│   │   ├── ttsService.ts         # TTS 服务
│   │   ├── voicePlaybackService.ts    # 语音播放
│   │   ├── pointsService.ts      # 积分服务
│   │   ├── userStatsService.ts   # 用户统计
│   │   ├── OSSService.ts         # OSS 上传
│   │   └── uploadService.ts      # 文件上传
│   │
│   ├── hooks/                    # 自定义 Hooks (6个)
│   │   ├── useImmersiveVoice.ts  # 沉浸式语音
│   │   ├── useSpeechToText.ts    # 语音识别
│   │   ├── useCamera.ts          # 相机
│   │   ├── useNotification.ts    # 通知
│   │   └── useConfirmModal.tsx   # 确认弹窗
│   │
│   ├── config/                   # 配置文件
│   │   ├── supabase.ts           # Supabase 客户端
│   │   └── clawbotEndpoints.ts   # Bot 端点配置
│   │
│   ├── types/                    # TypeScript 类型
│   │   ├── types.ts              # 通用类型
│   │   └── clawbot.ts            # Bot 类型
│   │
│   ├── utils/                    # 工具函数
│   │   ├── dateFormat.ts         # 日期格式化
│   │   ├── errorHandler.ts       # 错误处理
│   │   ├── logger.ts             # 日志
│   │   └── env.ts                # 环境变量
│   │
│   ├── i18n/                     # 国际化
│   │   └── index.ts              # i18n 配置
│   │
│   └── App.tsx                   # 主应用组件
│
├── server/                       # 后端服务器
│   └── clawbot-channel/          # Clawbot Channel 服务 (端口 8765)
│       ├── server.js             # 主服务入口
│       ├── config/               # 配置
│       │   └── database.js       # 数据库配置
│       ├── services/             # 服务层
│       │   ├── pairingService.js # 配对服务
│       │   ├── messageService.js # 消息服务
│       │   ├── ossService.js     # OSS 服务
│       │   └── ttsService.js     # TTS 服务
│       └── tests/                # 测试
│
├── trix-native/                  # TRIX Native (OpenClaw 集成)
│   ├── packages/
│   │   ├── trix-native-server/  # Node.js 服务器 (端口 8788)
│   │   │   ├── src/
│   │   │   │   ├── index.ts    # 入口
│   │   │   │   ├── app.ts      # Express 应用
│   │   │   │   ├── routes/     # API 路由
│   │   │   │   ├── services/   # 服务层 (SQLiteStore, MessageService, PairingService)
│   │   │   │   └── websocket/  # WebSocket 处理
│   │   │   └── data/           # SQLite 数据库
│   │   └── trix-native-plugin/ # OpenClaw 插件
│   │       ├── src/
│   │       │   ├── index.ts    # 插件入口
│   │       │   └── setup.ts    # 配对设置
│   │       └── package.json    # 已发布到 npm
│
├── database/                     # 数据库脚本
│   ├── INIT_ALL.sql              # 统一初始化脚本
│   ├── docs/                     # 数据库文档
│   │   ├── README.md
│   │   └── SCHEMA.md
│   └── *.sql                     # 迁移脚本
│
├── docs/                         # 项目文档
│   ├── INDEX.md                  # 文档索引
│   ├── development/              # 开发文档
│   ├── project-reports/          # 项目报告
│   ├── guides/                   # 用户指南
│   ├── api/                      # API 文档
│   ├── development/              # 开发文档
│   └── getting-started/          # 快速开始
│
├── tests/                        # 测试文件
│   └── smoke/                    # Smoke 测试
│       └── mvp-smoke.test.mjs

├── scripts/                      # 工具脚本
│   └── database/                 # 数据库脚本

├── public/                       # 静态资源
├── .claude/                      # Claude 配置
├── CLAUDE.md                     # Claude 协作配置
├── README.md                     # 项目 README
└── package.json                  # 项目配置
```

---

## 🗃️ 数据库架构

### 核心表 (9个)

| 表名 | 用途 |
|------|------|
| `profiles` | 用户配置 (Supabase Auth 扩展) |
| `friends` | 好友关系 |
| `chat_messages` | 聊天消息 |
| `unread_counts` | 未读计数 |
| `notifications` | 系统通知 |
| `mails` | 邮件消息 |
| `study_sessions` | 学习记录 |
| `study_rooms` | 自习室 |
| `study_room_members` | 自习室成员 |

### 扩展表 (4个)

| 表名 | 用途 |
|------|------|
| `pairing_requests` | 配对请求 |
| `user_points` | 用户积分 |
| `point_transactions` | 积分交易记录 |
| `user_settings` | 用户隐私设置 |

详细文档: [database/docs/SCHEMA.md](../../database/docs/SCHEMA.md)

---

## 🔌 API 架构

### 前端 API

- **Supabase Client** - 数据库 CRUD 操作
- **ClawbotChannelBridge** - Bot WebSocket 通信
- **TTS Service** - 语音合成

### 后端 API

- **HTTP API** - 文件上传、TTS、健康检查
- **WebSocket API** - 配对、消息转发、心跳

详细文档: [docs/api/new_clawbot_api.md](../api/new_clawbot_api.md)

---

## 🎨 UI 组件

### 布局组件

| 组件 | 说明 |
|------|------|
| `GlassPanel` | 毛玻璃容器 |
| `GlassDock` | 底部导航栏 |
| `HeroBackground` | 首页全屏背景 |

### 模态框

| 组件 | 说明 |
|------|------|
| `Modal` | 通用模态框 |
| `ConfirmModal` | 确认对话框 |
| `AddFriendModal` | 添加好友 |
| `SnapshotModal` | 拍照预览 |
| `AIActionModal` | AI 动作选择 |

### 功能组件

| 组件 | 说明 |
|------|------|
| `StudyRoom` | 虚拟自习室 |
| `StudyBuddiesList` | 学习伙伴列表 |
| `NotificationPanel` | 通知面板 |
| `MailPanel` | 邮件面板 |
| `HomeBotBubble` | 首页机器人气泡 |
| `QRScanner` | 二维码扫描器 |

---

## 🔐 认证流程

```
用户注册/登录
    ↓
Supabase Auth
    ↓
获取 Session Token
    ↓
存储到 AuthContext
    ↓
访问受保护资源
```

---

## 🔄 实时通信

### Supabase Realtime

```typescript
// 订阅新消息
supabase.channel('chat')
  .on('postgres_changes', { event: 'INSERT', ... }, handler)
  .subscribe();
```

### Clawbot WebSocket

```typescript
// 发送消息
socket.emit('app_message', { content, userId });

// 接收消息
socket.on('bot_message', (data) => { ... });
```

---

## 📊 状态管理

### Context 结构

```
AuthContext          - 用户认证状态
ThemeContext         - 主题/暗色模式
ClawbotChannelContext - Bot 连接和消息状态
QRCodePairingContext  - 配对流程状态
VoiceSettingsContext  - 语音设置
```

### Bot 状态机

```
IDLE ──────→ THINKING ──────→ SPEAKING
  ↑              │                │
  └──────────────┴────────────────┘
```

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
VITE_CLAWBOT_CHANNEL_URL=ws://localhost:8765
VITE_GATEWAY_WS_URL=ws://localhost:18789
VITE_GATEWAY_AUTH_TOKEN=<your-gateway-token>
```

### 启动

```bash
# 前端开发服务器
npm run dev

# 后端服务器
cd server/clawbot-channel
npm install
npm start
```

---

## 📈 统计

| 类别 | 数量 |
|------|------|
| 前端 TypeScript 文件 | 29 |
| 前端 TSX 组件文件 | 62 |
| 后端 JavaScript 文件 | 12 |
| 数据库表 | 13 |
| 核心文档 | 15+ |
| **总代码文件** | **~117** |

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [INDEX.md](../INDEX.md) | 完整文档索引 |
| [ARCHITECTURE.md](./development/ARCHITECTURE.md) | 架构文档 |
| [FEATURES.md](../FEATURES.md) | 功能文档 |
| [CHANGELOG.md](../CHANGELOG.md) | 变更日志 |
| [PROJECT_AUDIT_P0123_2026-02-22.md](./project-reports/PROJECT_AUDIT_P0123_2026-02-22.md) | 最新审计报告 |

---

**最后更新**: 2026-02-22
**维护者**: TRIX 3D Companion 开发团队

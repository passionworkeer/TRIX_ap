# TRIX 3D Companion - 项目全貌分析文档

> **文档版本**: 1.0.0
> **生成日期**: 2026-02-17
> **项目分支**: feature/nanobot-integration
> **最新提交**: 0e98da0

---

## 目录

1. [项目概览](#一项目概览)
2. [技术栈深度分析](#二技术栈深度分析)
3. [项目架构分析](#三项目架构分析)
4. [功能模块详解](#四功能模块详解)
5. [数据库设计分析](#五数据库设计分析)
6. [关键代码文件清单](#六关键代码文件清单)
7. [API 接口梳理](#七api-接口梳理)
8. [环境配置说明](#八环境配置说明)
9. [开发工作流](#九开发工作流)
10. [已知问题和待办事项](#十已知问题和待办事项)
11. [设计规范](#十一设计规范)

---

## 一、项目概览

### 1.1 项目定位

**TRIX 3D Companion** 是一款面向移动端的 AI 伴侣应用，采用 **Zero UI** 设计理念。这是一个基于 Web 技术构建的 Progressive Web App (PWA)，主要面向学生群体和年轻用户，提供 AI 对话、社交互动、学习计时等核心功能。

### 1.2 核心价值主张

- **Zero UI 体验**：首页仅展示全屏 3D 角色，点击后显示功能面板，沉浸式体验
- **AI 伴侣对话**：通过 WebSocket 连接本地 AI Gateway，实现流式 AI 响应
- **社交学习结合**：将学习计时与社交功能结合，支持双人陪伴自习
- **跨端配对**：支持手机端与电脑端 Gateway 通过二维码/配对码连接

### 1.3 目标用户群体

- **主要用户**：18-25 岁的大学生和年轻职场人士
- **使用场景**：学习专注、AI 对话、社交互动、位置共享
- **核心需求**：学习激励、AI 陪伴、好友互动

### 1.4 设计理念

**Zero UI** 设计理念的核心原则：
- 首页完全沉浸式，无 UI 元素干扰
- 点击触发功能面板，保持视觉纯净
- 毛玻璃效果 (Glassmorphism) 提升视觉层次
- 流畅动画过渡，提升用户体验

---

## 二、技术栈深度分析

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19.2.4 | 核心框架，使用最新的 React 19 特性 |
| **TypeScript** | 5.8.2 | 类型安全，提升开发效率 |
| **Vite** | 6.2.0 | 构建工具，快速 HMR |
| **React Router** | 7.13.0 | 路由管理 (使用 HashRouter) |
| **Framer Motion** | 12.33.0 | 动画库，处理页面过渡和交互动画 |
| **Tailwind CSS** | CDN | 样式框架（通过 CDN 引入） |
| **i18next** | 25.8.9 | 国际化，支持中文/英文/日文 |
| **React Hot Toast** | 2.6.0 | Toast 通知组件 |

### 2.2 数据库与后端服务

| 技术 | 版本 | 用途 |
|------|------|------|
| **Supabase** | 2.94.0 | 后端即服务 (BaaS)，提供 PostgreSQL + Auth + Realtime |
| **PostgreSQL** | 15+ | 主数据库，存储用户、聊天、学习记录等数据 |
| **Socket.IO Client** | 4.8.3 | Clawbot Channel 通信 (Socket.IO 协议) |
| **WebSocket** | 8.19.0 | Nanobot 通信 (原生 WebSocket 协议) |

### 2.3 第三方集成

| 服务 | 用途 |
|------|------|
| **Leaflet** | 1.9.4 | 地图功能，位置共享 |
| **React Leaflet** | 5.0.0 | Leaflet 的 React 封装 |
| **阿里云 OSS** | 文件存储（图片/视频上传） |
| **html5-qrcode** | 2.3.8 | 二维码扫描 |
| **browser-image-compression** | 2.0.2 | 图片压缩 |
| **Lucide React** | 0.563.0 | 图标库 |
| **React Virtuoso** | 4.18.1 | 虚拟滚动列表 |

### 2.4 服务端架构

**Python Flask** (可选，用于本地 Nanobot Gateway)
- 提供本地 AI 服务接口
- WebSocket 通信支持

**云端服务器**
- **Clawbot Channel Server**: `wss://m.jmtrick.com` (Socket.IO)
- **Nanobot Server**: `ws://47.243.55.130:8766` (WebSocket)

### 2.5 基础设施

| 类别 | 技术 |
|------|------|
| **版本控制** | Git |
| **部署方式** | 静态文件部署 (支持 Nginx/Vercel) |
| **云服务** | 阿里云 OSS (文件存储) |
| **开发环境** | Node.js >= 18 |

---

## 三、项目架构分析

### 3.1 目录结构详解

```
trix-3d-companion/
├── src/                          # 源代码目录
│   ├── assets/                   # 静态资源
│   │   └── roles/                # 3D 角色资源
│   │       ├── role1/            # 角色模型和贴图
│   │       └── role2/
│   ├── clawbot/                  # Clawbot 相关模块（已废弃部分）
│   ├── components/               # UI 组件库 (22个组件)
│   │   ├── AboutDialog.tsx       # 关于我们对话框
│   │   ├── AddFriendModal.tsx    # 添加好友弹窗
│   │   ├── AIActionModal.tsx     # AI 操作选择器
│   │   ├── Avatar.tsx            # 头像组件
│   │   ├── ConfirmDialog.tsx     # 确认对话框
│   │   ├── ErrorBoundary.tsx     # 错误边界
│   │   ├── FilePicker.tsx        # 文件选择器
│   │   ├── GlassDock.tsx         # 底部导航栏（毛玻璃）
│   │   ├── GlassPanel.tsx        # 毛玻璃面板
│   │   ├── HeroBackground.tsx    # 首页全屏背景
│   │   ├── LoadingSpinner.tsx    # 加载动画
│   │   ├── MailPanel.tsx         # 邮件面板
│   │   ├── map/                  # 地图相关组件
│   │   ├── MediaMessage.tsx      # 媒体消息组件
│   │   ├── NotificationPanel.tsx # 通知面板
│   │   ├── PointsHistory.tsx     # 积分历史记录
│   │   ├── PrivacySettings.tsx   # 隐私设置
│   │   ├── ProjectProgress.tsx   # 项目进度组件
│   │   ├── QRScanner.tsx         # 二维码扫描器
│   │   ├── SnapshotModal.tsx     # 快拍模态框
│   │   ├── StatsDetailDialog.tsx # 统计详情弹窗
│   │   ├── StudyBuddiesList.tsx  # 学习伙伴列表
│   │   ├── StudyRoom.tsx         # 自习室组件
│   │   └── UserSwitcher.tsx      # 用户切换器
│   ├── config/                   # 配置文件
│   │   ├── metadata.json         # 元数据配置
│   │   └── supabase.ts           # Supabase 客户端配置
│   ├── constants.ts              # 常量定义（图片资源等）
│   ├── contexts/                 # React Context 状态管理 (5个)
│   │   ├── AuthContext.tsx       # 认证状态管理
│   │   ├── ClawbotChannelContext.tsx  # Clawbot Channel 状态
│   │   ├── NanobotContext.tsx    # Nanobot 状态管理
│   │   ├── QRCodePairingContext.tsx   # 二维码配对状态
│   │   └── ThemeContext.tsx      # 主题管理
│   ├── database/                 # 数据库文档
│   │   ├── README.md             # 数据库说明
│   │   ├── SCHEMA.md             # 数据库架构文档
│   │   ├── init.sql              # 初始化脚本
│   │   └── complete-init.sql     # 完整初始化脚本
│   ├── features/                 # 功能模块（按特性组织）
│   │   ├── chat/                 # 聊天功能
│   │   │   ├── components/       # 聊天相关组件
│   │   │   └── hooks/            # 聊天相关 Hooks
│   │   └── study/                # 学习功能
│   │       ├── components/       # 学习相关组件
│   │       └── hooks/            # 学习相关 Hooks
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useNotification.ts    # 通知 Hook
│   │   └── ...其他 Hooks
│   ├── i18n/                     # 国际化配置
│   │   └── locales/              # 语言文件
│   │       ├── en.json           # 英文
│   │       ├── ja.json           # 日文
│   │       └── zh.json           # 中文
│   ├── screens/                  # 页面组件 (14个)
│   │   ├── Auth.tsx              # 认证页面（登录/注册）
│   │   ├── Chat.tsx              # 聊天列表页
│   │   ├── ChatDetail.tsx        # 聊天详情页
│   │   ├── Diagnostic.tsx        # 诊断页面
│   │   ├── DiagnosticAdvanced.tsx # 高级诊断
│   │   ├── Home.tsx              # 首页（3D角色）
│   │   ├── Map.tsx               # 地图页
│   │   ├── NanobotPairing.tsx    # Nanobot 配对页
│   │   ├── Pairing.tsx           # Clawbot 配对页
│   │   ├── Profile.tsx           # 个人中心
│   │   ├── QRCodePairing.tsx     # 二维码配对页
│   │   ├── SnapMapScreen.tsx     # 快拍地图页
│   │   ├── Snapshot.tsx          # 快拍页
│   │   └── Study.tsx             # 学习计时页
│   ├── services/                 # 业务服务层 (11个)
│   │   ├── ClawbotChannelBridge.ts   # Clawbot Channel 通信桥接
│   │   ├── NanobotBridge.ts      # Nanobot 通信桥接
│   │   ├── clawbotPairingService.ts  # Clawbot 配对服务
│   │   ├── ConnectionManager.ts  # 连接管理器
│   │   ├── databaseService.ts    # 数据库操作服务
│   │   ├── OSSService.ts         # 阿里云 OSS 服务
│   │   ├── StorageService.ts     # 本地存储服务
│   │   ├── uploadService.ts      # 上传服务
│   │   ├── pointsService.ts      # 积分服务
│   │   ├── userStatsService.ts   # 用户统计服务
│   │   └── projectService.ts     # 项目管理服务
│   ├── types/                    # TypeScript 类型定义
│   │   ├── clawbot.ts            # Clawbot 类型
│   │   └── types.ts              # 通用类型
│   ├── utils/                    # 工具函数
│   ├── App.tsx                   # 应用主组件
│   ├── constants.ts              # 常量
│   ├── index.css                 # 全局样式
│   ├── index.tsx                 # 应用入口
│   ├── types.ts                  # 路由类型定义
│   └── vite-env.d.ts             # Vite 环境类型
├── database/                     # 数据库迁移脚本
│   ├── add-chat-attachments-storage.sql
│   ├── add-companion-to-profiles.sql
│   ├── add-is-studying-to-profiles.sql
│   ├── add-media-support-to-chat-messages.sql
│   ├── add-pairing-requests-table.sql
│   ├── add-points-system.sql     # 积分系统
│   ├── add-study-time-to-profiles.sql
│   ├── add-user-settings.sql     # 用户设置
│   └── migration-2026-02-17-user-settings.sql
├── deploy/                       # 部署相关
│   ├── deploy-frontend.sh        # 前端部署脚本
│   └── DEPLOYMENT.md             # 部署文档
├── docs/                         # 项目文档 (详见 docs/INDEX.md)
│   ├── INDEX.md                  # 文档索引
│   ├── FEATURES.md               # 功能文档
│   ├── CHANGELOG.md              # 开发日志
│   ├── deployment-guides/        # 部署指南
│   ├── feature-implementation/   # 功能实现文档
│   ├── fix-reports/              # 修复报告
│   ├── guides/                   # 用户指南
│   ├── nanobot/                  # Nanobot 文档
│   └── ...更多文档
├── server/                       # 服务端代码（可选）
│   ├── clawbot-channel/          # Clawbot Channel 服务器
│   ├── cloud_server.py           # 云端 WebSocket 服务器
│   ├── cloud_server_advanced.py  # 高级版服务器
│   ├── deploy.sh                 # 服务器部署脚本
│   ├── nginx.conf                # Nginx 配置
│   └── README.md                 # 服务器说明
├── public/                       # 公共静态资源
├── scripts/                      # 构建和工具脚本
├── .env.example                  # 环境变量模板
├── .gitignore                    # Git 忽略配置
├── DEPLOYMENT_SUMMARY.md         # 部署总结
├── index.html                    # HTML 入口
├── package.json                  # 项目依赖
├── README.md                     # 项目说明
├── tailwind.config.js            # Tailwind 配置
├── tsconfig.json                 # TypeScript 配置
├── TESTING_REPORT.md             # 测试报告
└── vite.config.ts                # Vite 配置
```

### 3.2 核心架构模式

#### 3.2.1 三层布局架构

```
┌──────────────────────────────────────────────────────────┐
│  Layer 0: 背景层 (z-index: 0)                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  HeroBackground (仅首页显示)                      │ │
│  │  - 全屏 3D 角色展示                               │ │
│  │  - CSS 动画效果                                   │ │
│  └────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Layer 10: 内容层 (z-index: 10)                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Routes (可滚动内容)                              │ │
│  │  - 所有页面组件                                   │ │
│  │  - 首页透明，其他页面有背景色                     │ │
│  └────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Layer 50: 悬浮层 (z-index: 50)                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  GlassDock (底部导航栏)                           │ │
│  │  - 毛玻璃效果                                     │ │
│  │  - 首页点击后显示                                 │ │
│  │  - 聊天详情/计时器页面隐藏                        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### 3.2.2 WebSocket 双通道架构

```
┌──────────────────────────────────────────────────────────────┐
│                      TRIX Web App                            │
│                  (React + TypeScript)                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │
│  │  ClawbotChannelBridge    │  │    NanobotBridge         │ │
│  │  (Socket.IO Client)      │  │  (WebSocket Client)      │ │
│  │                          │  │                          │ │
│  │  - 配对管理              │  │  - AI 对话              │ │
│  │  - 消息转发              │  │  - 聊天响应              │ │
│  │  - 设备状态同步          │  │  - 智能回复              │ │
│  └──────────┬───────────────┘  └──────────┬───────────────┘ │
│             │                              │                  │
└─────────────┼──────────────────────────────┼──────────────────┘
              │ Socket.IO                    │ WebSocket
              │                              │
┌─────────────▼──────────────────────────────▼──────────────────┐
│                      Cloud Servers                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Clawbot Channel Server                                │  │
│  │  wss://m.jmtrick.com                                   │  │
│  │  - 配对码生成和验证                                    │  │
│  │  - App 与 Clawbot 之间的消息中转                       │  │
│  │  - 维护设备在线状态                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Nanobot Server                                        │  │
│  │  ws://47.243.55.130:8766                               │  │
│  │  - AI 对话响应                                         │  │
│  │  - 聊天消息处理                                        │  │
│  │  - 智能回复生成                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### 3.2.3 状态管理架构

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│                     (应用根组件)                            │
└─────────────────────────────────────────────────────────────┘
         │
         ├─── AuthProvider (认证状态)
         │    ├── user: User | null
         │    ├── profile: Profile | null
         │    ├── signIn()
         │    ├── signUp()
         │    └── signOut()
         │
         ├─── ClawbotChannelProvider (Clawbot 状态)
         │    ├── status: ConnectionStatus
         │    ├── isConnected: boolean
         │    ├── isPaired: boolean
         │    ├── messages: Message[]
         │    ├── connect()
         │    ├── pairWithCode()
         │    └── sendMessage()
         │
         ├─── QRCodePairingProvider (配对状态)
         │    ├── isPairing: boolean
         │    ├── pairingRequest: PairingRequest | null
         │    ├── pairingStatus: string
         │    └── startPairing()
         │
         └─── NanobotProvider (Nanobot 状态)
              ├── status: ConnectionStatus
              ├── connected: boolean
              ├── messages: NanobotMessage[]
              └── sendMessage()
```

#### 3.2.4 路由结构

```typescript
// 路由定义 (src/types.ts)
export enum AppRoutes {
  HOME = '/',                    // 首页 (3D角色)
  LOGIN = '/login',              // 登录
  REGISTER = '/register',        // 注册
  SNAPSHOT = '/snapshot',        // 快拍
  SNAPSHOT_RESULT = '/snapshot/result',
  STUDY = '/study',              // 学习计时
  CHAT = '/chat',                // 聊天列表
  CHAT_DETAIL = '/chat/detail',  // 聊天详情
  CHAT_WITH_FRIEND = '/chat/:friendId',  // 与好友聊天
  PROFILE = '/profile',          // 个人中心
  PROFILE_VIEW = '/profile/:userId',  // 查看他人主页
  SETTINGS = '/profile/settings', // 设置
  PAIRING = '/pairing',          // 配对输入
  QR_PAIRING = '/qr-pairing',    // 二维码配对
  DIAGNOSTIC = '/diagnostic',    // 诊断
  DIAGNOSTIC_ADV = '/diagnostic-advanced',
  MAP = '/map'                   // 地图
}

// 路由保护
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (!loading && !user) {
    return <Navigate to={AppRoutes.LOGIN} replace />;
  }
  return children;
};
```

### 3.3 数据流架构

#### 3.3.1 认证流程

```
┌──────────────┐     signIn(email, password)      ┌──────────────┐
│   用户界面   │ ────────────────────────────────> │  AuthContext │
└──────────────┘                                     └──────┬───────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  Supabase    │
                                                    │   Auth API   │
                                                    └──────┬───────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  Session     │
                                                    │  Token       │
                                                    └──────┬───────┘
                                                           │
                                        ┌──────────────────┴──────────────────┐
                                        ▼                                     ▼
                                  ┌──────────┐                          ┌──────────┐
                                  │ profile  │                          │   user   │
                                  │  数据    │                          │   数据   │
                                  └──────────┘                          └──────────┘
```

#### 3.3.2 消息发送流程

```
┌──────────────┐     sendMessage(content)      ┌──────────────┐
│  ChatDetail  │ ─────────────────────────────>│   Context    │
└──────────────┘                                  │  (Nanobot/  │
                                                 │  Clawbot)   │
                                                 └──────┬───────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │   Bridge     │
                                                 │  (Service)   │
                                                 └──────┬───────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │  WebSocket/  │
                                                 │  Socket.IO   │
                                                 └──────┬───────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │  Cloud Server│
                                                 └──────────────┘
```

---

## 四、功能模块详解

### 4.1 用户认证系统

#### 核心文件
- **Context**: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- **Screen**: [src/screens/Auth.tsx](src/screens/Auth.tsx)

#### 功能特性
1. **邮箱密码登录/注册**
   - 使用 Supabase Auth
   - 自动错误类型映射（`AuthErrorType` 枚举）
   - 友好的错误提示

2. **会话管理**
   - 自动刷新 Token
   - 持久化存储
   - Realtime 监听认证状态变化

3. **用户资料**
   - 自动获取用户 Profile
   - 支持更新用户信息
   - 头像上传支持

#### 错误类型
```typescript
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

### 4.2 Clawbot Channel 通信

#### 核心文件
- **Bridge**: [src/services/ClawbotChannelBridge.ts](src/services/ClawbotChannelBridge.ts)
- **Context**: [src/contexts/ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx)
- **配对服务**: [src/services/clawbotPairingService.ts](src/services/clawbotPairingService.ts)

#### 功能特性
1. **设备配对**
   - 配对码配对 (`pairWithCode`)
   - Token 配对 (`pairWithToken`)
   - 二维码配对支持

2. **消息收发**
   - 支持文本、图片、视频、文件消息
   - Promise-based 发送（带确认机制）
   - 自动重连和心跳保活

3. **状态管理**
   ```typescript
   export type ConnectionStatus =
     | 'DISCONNECTED'
     | 'CONNECTING'
     | 'CONNECTED'
     | 'RECONNECTING'
     | 'ERROR'
     | 'PAIRED';
   ```

#### 关键事件
| 事件名称 | 触发时机 | 数据格式 |
|---------|---------|----------|
| `connecting` | 开始连接 | - |
| `connected` | 连接成功 | - |
| `paired` | 配对成功 | `{ deviceId, deviceName }` |
| `message` | 收到消息 | `ClawbotChannelMessage` |
| `bot_offline` | Bot 离线 | `{ message, timestamp }` |
| `bot_online` | Bot 上线 | `{ message, timestamp }` |
| `unpaired` | 解除配对 | - |
| `error` | 发生错误 | `{ message }` |

### 4.3 Nanobot 通信

#### 核心文件
- **Bridge**: [src/services/NanobotBridge.ts](src/services/NanobotBridge.ts)
- **Context**: [src/contexts/NanobotContext.tsx](src/contexts/NanobotContext.tsx)
- **配对页面**: [src/screens/NanobotPairing.tsx](src/screens/NanobotPairing.tsx)

#### 功能特性
1. **配对码绑定**
   - 8 位配对码输入
   - 自动连接云端服务器
   - 持久化配对状态

2. **AI 对话**
   - 文本消息发送
   - 媒体消息支持
   - 实时响应流式接收

3. **连接管理**
   - 自动重连（最多 10 次）
   - 心跳保活（30秒间隔）
   - 浏览器兼容性处理

#### 消息协议
```typescript
// App → Server
{
  type: 'chat_message',
  device_id: string,
  msg_id: string,
  message: string,
  message_type: 'text' | 'image' | 'video' | 'file',
  media_url?: string
}

// Server → App
{
  type: 'chat_response',
  msg_id: string,
  response: string,
  timestamp: string
}
```

### 4.4 社交聊天系统

#### 核心文件
- **聊天列表**: [src/screens/Chat.tsx](src/screens/Chat.tsx)
- **聊天详情**: [src/screens/ChatDetail.tsx](src/screens/ChatDetail.tsx)
- **数据库服务**: [src/services/databaseService.ts](src/services/databaseService.ts)

#### 功能特性
1. **聊天列表**
   - 显示所有好友
   - 未读消息计数
   - 最后一条消息预览
   - 在线状态显示

2. **聊天详情**
   - 消息气泡展示
   - 媒体消息支持
   - 自动滚动到底部
   - 消息已读状态

3. **好友管理**
   - 添加好友（通过搜索或 ID）
   - 好友请求处理
   - 好友列表管理

#### 数据结构
```typescript
export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  name: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'busy' | 'away';
  bio: string | null;
  study_time: number;
  is_studying: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  friend_id: string;
  sender: 'user' | 'friend' | 'bot';
  text: string;
  created_at: string;
  message_type?: 'text' | 'image' | 'video' | 'mixed';
  media_uri?: string;
  media_type?: string;
  media_size?: number;
}
```

### 4.5 学习计时器（专注模式）

#### 核心文件
- **学习页面**: [src/screens/Study.tsx](src/screens/Study.tsx)
- **自习室组件**: [src/components/StudyRoom.tsx](src/components/StudyRoom.tsx)
- **伙伴列表**: [src/components/StudyBuddiesList.tsx](src/components/StudyBuddiesList.tsx)

#### 功能特性
1. **番茄钟计时**
   - 自定义专注时长
   - 实时计时显示
   - 暂停/恢复功能
   - 完成结算弹窗

2. **双人陪伴模式**
   - 选择好友陪伴
   - 双人头像展示
   - 连接线动画
   - 实时状态同步

3. **积分奖励**
   - 完成专注获得积分
   - 每分钟 2 积分
   - 积分历史记录

4. **虚拟自习室**
   - 创建/加入自习室
   - 实时查看学习伙伴
   - 学习状态同步

#### 结算弹窗
- 撒花动画效果
- 显示本次专注时长
- 显示获得的积分
- 显示完成率
- 温馨鼓励文案

### 4.6 位置共享

#### 核心文件
- **地图页面**: [src/screens/Map.tsx](src/screens/Map.tsx)
- **快拍地图**: [src/screens/SnapMapScreen.tsx](src/screens/SnapMapScreen.tsx)
- **地图组件**: [src/components/map/](src/components/map/)

#### 功能特性
1. **地图展示**
   - 使用 Leaflet 地图
   - 标记好友位置
   - 自定义头像标记

2. **位置更新**
   - 实时位置共享
   - 权限控制
   - 隐私设置

### 4.7 二维码配对

#### 核心文件
- **配对页面**: [src/screens/QRCodePairing.tsx](src/screens/QRCodePairing.tsx)
- **Context**: [src/contexts/QRCodePairingContext.tsx](src/contexts/QRCodePairingContext.tsx)
- **配对服务**: [src/services/clawbotPairingService.ts](src/services/clawbotPairingService.ts)

#### 配对流程
1. **生成配对请求**
   - App 端发起配对请求
   - 生成配对 ID
   - 创建二维码内容

2. **扫描确认**
   - Clawbot 端扫描二维码
   - 确认配对请求
   - 生成 Device Token

3. **完成配对**
   - App 端收到 Token
   - 保存到 localStorage
   - 建立持久连接

### 4.8 用户资料系统

#### 核心文件
- **个人中心**: [src/screens/Profile.tsx](src/screens/Profile.tsx)
- **统计服务**: [src/services/userStatsService.ts](src/services/userStatsService.ts)
- **积分历史**: [src/components/PointsHistory.tsx](src/components/PointsHistory.tsx)
- **隐私设置**: [src/components/PrivacySettings.tsx](src/components/PrivacySettings.tsx)

#### 功能特性
1. **个人信息管理**
   - 编辑昵称、简介
   - 头像上传
   - 装备系统（MVP 版本）

2. **积分等级系统**
   - 积分进度条显示
   - 等级徽章展示
   - 积分历史记录
   - 分页加载

3. **数据统计**
   - 学习时长统计
   - 社交互动统计
   - 成就展示
   - 统计详情弹窗

4. **隐私设置**
   - 允许陌生人搜索
   - 显示在线状态
   - 允许学习邀请

### 4.9 通知系统

#### 核心文件
- **通知面板**: [src/components/NotificationPanel.tsx](src/components/NotificationPanel.tsx)
- **邮件面板**: [src/components/MailPanel.tsx](src/components/MailPanel.tsx)

#### 功能特性
1. **系统通知**
   - 消息通知
   - 好友请求
   - 系统消息
   - 学习提醒

2. **邮件中心**
   - 系统邮件
   - 活动通知
   - 未读标记

### 4.10 语音交互

#### 功能特性
1. **语音识别**
   - 集成 Web Speech API
   - 支持多种语言
   - 实时转文字

2. **语音指令**
   - 自定义指令处理
   - 语音快捷操作

---

## 五、数据库设计分析

### 5.1 数据库技术栈
- **数据库**: PostgreSQL 15+
- **BaaS**: Supabase (提供 Auth + Realtime + Storage)
- **RLS**: Row Level Security（行级安全策略）

### 5.2 核心数据表

#### 5.2.1 用户表 (auth.users + profiles)

**auth.users** (Supabase Auth 内置表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| email | TEXT | 邮箱 |
| encrypted_password | TEXT | 加密密码 |
| created_at | TIMESTAMPTZ | 创建时间 |

**profiles** (用户扩展信息)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键（关联 auth.users） |
| username | TEXT | 用户名 |
| full_name | TEXT | 全名 |
| avatar_url | TEXT | 头像URL |
| bio | TEXT | 个人简介 |
| total_study_time | INTEGER | 累计学习时长（分钟） |
| is_studying | BOOLEAN | 是否正在学习 |
| companion_id | UUID | 陪伴好友 ID |
| days_active | INTEGER | 活跃天数 |
| interaction_count | INTEGER | 互动次数 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### 5.2.2 好友表 (friends)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| friend_id | UUID | 好友 ID |
| name | TEXT | 好友名称 |
| avatar_url | TEXT | 头像URL |
| status | TEXT | 在线状态 (online/offline/busy/away) |
| bio | TEXT | 简介 |
| study_time | INTEGER | 学习时长（分钟） |
| is_studying | BOOLEAN | 是否学习中 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### 5.2.3 聊天消息表 (chat_messages)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| conversation_id | UUID | 会话 ID |
| sender_id | UUID | 发送者 ID |
| receiver_id | UUID | 接收者 ID |
| text | TEXT | 消息内容 |
| message_type | TEXT | 消息类型 (text/image/video/mixed) |
| media_uri | TEXT | 媒体文件 URI |
| media_type | TEXT | 媒体类型 |
| media_size | INTEGER | 媒体大小 |
| media_metadata | JSONB | 媒体元数据 |
| is_read | BOOLEAN | 是否已读 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### 5.2.4 未读计数表 (unread_counts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| friend_id | UUID | 好友 ID |
| unread_count | INTEGER | 未读数量 |
| last_message | TEXT | 最后一条消息 |
| last_message_time | TIMESTAMPTZ | 最后消息时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### 5.2.5 学习记录表 (study_sessions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| subject | TEXT | 学习科目 |
| duration | INTEGER | 时长（分钟） |
| started_at | TIMESTAMPTZ | 开始时间 |
| ended_at | TIMESTAMPTZ | 结束时间 |
| notes | TEXT | 笔记 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### 5.2.6 积分系统表

**user_points** (用户积分)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| total_points | INTEGER | 总积分 |
| level | INTEGER | 等级（1-10） |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**point_transactions** (积分交易记录)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| points_change | INTEGER | 积分变化（正/负） |
| transaction_type | TEXT | 交易类型 |
| description | TEXT | 描述 |
| metadata | JSONB | 额外信息 |
| balance_after | INTEGER | 交易后余额 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### 5.2.7 通知表 (notifications)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| type | TEXT | 通知类型 |
| title | TEXT | 标题 |
| content | TEXT | 内容 |
| avatar_url | TEXT | 头像 URL |
| is_read | BOOLEAN | 是否已读 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### 5.2.8 邮件表 (mails)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| from_name | TEXT | 发件人 |
| from_avatar | TEXT | 发件人头像 |
| subject | TEXT | 主题 |
| preview | TEXT | 预览 |
| content | TEXT | 内容 |
| is_read | BOOLEAN | 是否已读 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### 5.2.9 用户设置表 (user_settings)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| allow_stranger_search | BOOLEAN | 允许陌生人搜索 |
| show_online_status | BOOLEAN | 显示在线状态 |
| allow_study_invites | BOOLEAN | 允许学习邀请 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### 5.2.10 配对请求表 (pairing_requests)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| request_id | TEXT | 请求 ID |
| device_name | TEXT | 设备名称 |
| status | TEXT | 状态 (pending/approved/denied/cancelled/expired) |
| expires_at | TIMESTAMPTZ | 过期时间 |
| created_at | TIMESTAMPTZ | 创建时间 |

### 5.3 数据库函数

#### 5.3.1 积分系统函数

**add_user_points** - 添加积分
```sql
CREATE OR REPLACE FUNCTION add_user_points(
  p_user_id UUID,
  p_points INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
```

**calculate_user_level** - 计算用户等级
```sql
CREATE OR REPLACE FUNCTION calculate_user_level(total_points INTEGER)
RETURNS INTEGER
```

**get_user_points_stats** - 获取积分统计
```sql
CREATE OR REPLACE FUNCTION get_user_points_stats(p_user_id UUID)
RETURNS TABLE (
  total_points INTEGER,
  level INTEGER,
  today_earned INTEGER,
  week_earned INTEGER,
  total_transactions BIGINT
)
```

### 5.4 视图

**user_points_overview** - 积分排行榜视图
```sql
CREATE OR REPLACE VIEW user_points_overview AS
SELECT
  u.id AS user_id,
  u.username,
  u.avatar_url,
  COALESCE(up.total_points, 0) AS total_points,
  COALESCE(up.level, 1) AS level
FROM profiles u
LEFT JOIN user_points up ON u.id = up.user_id
ORDER BY up.total_points DESC NULLS LAST;
```

### 5.5 RLS 策略

开发模式配置（允许所有操作）：
```sql
CREATE POLICY "Allow all user_points operations" ON user_points
  FOR ALL USING (true) WITH CHECK (true);
```

生产环境应配置严格策略：
```sql
CREATE POLICY "Users can view own data" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON user_points
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## 六、关键代码文件清单

### 6.1 入口文件

| 文件路径 | 职责 | 关键内容 |
|---------|------|----------|
| [src/index.tsx](src/index.tsx) | React 应用入口 | ReactDOM.createRoot |
| [src/App.tsx](src/App.tsx) | 应用根组件 | 路由配置、Provider 包裹 |
| [index.html](index.html) | HTML 模板 | #root 挂载点 |

### 6.2 核心配置文件

| 文件路径 | 职责 | 关键配置 |
|---------|------|----------|
| [vite.config.ts](vite.config.ts) | Vite 构建 | 插件、别名、构建优化 |
| [tsconfig.json](tsconfig.json) | TypeScript | 路径别名、编译选项 |
| [tailwind.config.js](tailwind.config.js) | Tailwind CSS | 主题配置 |
| [.env.example](.env.example) | 环境变量模板 | Supabase、Gateway 配置 |

### 6.3 Context 文件

| 文件路径 | 状态管理 | 关键状态/方法 |
|---------|----------|--------------|
| [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | 认证状态 | user, profile, signIn, signUp, signOut |
| [src/contexts/ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx) | Clawbot 状态 | status, messages, connect, sendMessage |
| [src/contexts/NanobotContext.tsx](src/contexts/NanobotContext.tsx) | Nanobot 状态 | status, messages, connect, sendMessage |
| [src/contexts/QRCodePairingContext.tsx](src/contexts/QRCodePairingContext.tsx) | 二维码配对 | isPairing, pairingStatus, startPairing |
| [src/contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx) | 主题管理 | theme, toggleTheme |

### 6.4 Service 文件

| 文件路径 | 职责 | 关键方法 |
|---------|------|----------|
| [src/services/databaseService.ts](src/services/databaseService.ts) | 数据库操作 | fetchFriends, sendMessage, fetchMessages |
| [src/services/ClawbotChannelBridge.ts](src/services/ClawbotChannelBridge.ts) | Clawbot 通信 | connect, pairWithCode, sendMessage |
| [src/services/NanobotBridge.ts](src/services/NanobotBridge.ts) | Nanobot 通信 | connect, bindPairingCode, sendMessage |
| [src/services/clawbotPairingService.ts](src/services/clawbotPairingService.ts) | 配对服务 | generatePairingRequest, pollPairingStatus |
| [src/services/OSSService.ts](src/services/OSSService.ts) | 阿里云 OSS | uploadFile |
| [src/services/uploadService.ts](src/services/uploadService.ts) | 文件上传 | uploadImage, uploadVideo |
| [src/services/pointsService.ts](src/services/pointsService.ts) | 积分服务 | addPoints, getPointsStats |
| [src/services/userStatsService.ts](src/services/userStatsService.ts) | 用户统计 | getUserStats, getStudyStats |

### 6.5 Screen 文件

| 文件路径 | 页面功能 | 路由 |
|---------|----------|------|
| [src/screens/Home.tsx](src/screens/Home.tsx) | 首页（3D角色） | / |
| [src/screens/Auth.tsx](src/screens/Auth.tsx) | 登录/注册 | /login, /register |
| [src/screens/Chat.tsx](src/screens/Chat.tsx) | 聊天列表 | /chat |
| [src/screens/ChatDetail.tsx](src/screens/ChatDetail.tsx) | 聊天详情 | /chat/detail, /chat/:friendId |
| [src/screens/Study.tsx](src/screens/Study.tsx) | 学习计时 | /study |
| [src/screens/Profile.tsx](src/screens/Profile.tsx) | 个人中心 | /profile |
| [src/screens/Pairing.tsx](src/screens/Pairing.tsx) | 配对输入 | /pairing |
| [src/screens/QRCodePairing.tsx](src/screens/QRCodePairing.tsx) | 二维码配对 | /qr-pairing |
| [src/screens/Map.tsx](src/screens/Map.tsx) | 地图 | /map |
| [src/screens/Snapshot.tsx](src/screens/Snapshot.tsx) | 快拍 | /snapshot |

### 6.6 Component 文件

| 文件路径 | 组件功能 | 使用场景 |
|---------|----------|----------|
| [src/components/GlassDock.tsx](src/components/GlassDock.tsx) | 底部导航栏 | 主导航 |
| [src/components/HeroBackground.tsx](src/screens/Home.tsx) | 首页背景 | 首页 |
| [src/components/StudyRoom.tsx](src/components/StudyRoom.tsx) | 自习室 | 学习页面 |
| [src/components/MediaMessage.tsx](src/components/MediaMessage.tsx) | 媒体消息 | 聊天详情 |
| [src/components/PrivacySettings.tsx](src/components/PrivacySettings.tsx) | 隐私设置 | 个人中心 |

---

## 七、API 接口梳理

### 7.1 Supabase API 调用

#### 认证 API
```typescript
// 登录
const { error } = await supabase.auth.signInWithPassword({
  email, password
});

// 注册
const { error } = await supabase.auth.signUp({
  email, password,
  options: {
    data: { username },
    emailRedirectTo: undefined
  }
});

// 登出
await supabase.auth.signOut();

// 获取会话
const { data: { session } } = await supabase.auth.getSession();
```

#### 数据库 API
```typescript
// 查询
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// 插入
const { data, error } = await supabase
  .from('friends')
  .insert({ user_id, friend_id, name })
  .select();

// 更新
const { error } = await supabase
  .from('profiles')
  .update({ avatar_url: newUrl })
  .eq('id', userId);

// 删除
const { error } = await supabase
  .from('notifications')
  .delete()
  .eq('id', notificationId);
```

#### Realtime 订阅
```typescript
const channel = supabase
  .channel('custom-channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'friends',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Change received!', payload);
  })
  .subscribe();
```

#### Storage API
```typescript
// 上传文件
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/${fileName}`, file);

// 获取公开 URL
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(filePath);

// 删除文件
const { error } = await supabase.storage
  .from('avatars')
  .remove([filePath]);
```

### 7.2 Clawbot Channel API (Socket.IO)

#### 客户端事件（App → Server）
```typescript
// 注册设备
socket.emit('app_register', { userId });

// 配对码配对
socket.emit('pair_with_code', {
  code: 'AB12CD34',
  userId
}, (response) => {
  console.log(response);
});

// Token 配对
socket.emit('pair_with_token', {
  token: 'xxx',
  userId
}, (response) => {
  console.log(response);
});

// 发送消息
socket.emit('app_message', {
  content: 'Hello',
  contentType: 'text',
  mediaUrl: undefined,
  messageId: '12345'
});

// 心跳
socket.emit('ping');

// 解绑
socket.emit('unpair');
```

#### 服务器事件（Server → App）
```typescript
// 连接成功
socket.on('connect', () => {});

// 配对成功
socket.on('pairing_success', (data) => {
  // { deviceId, deviceName }
});

// 收到 Bot 消息
socket.on('bot_message', (msg) => {
  // { content, contentType, mediaUrl, timestamp }
});

// Bot 离线
socket.on('bot_offline', (data) => {
  // { deviceId, message, timestamp }
});

// Bot 上线
socket.on('bot_online', (data) => {
  // { deviceId, message, timestamp }
});

// 被解绑
socket.on('unpaired', () => {});

// 心跳响应
socket.on('pong', () => {});

// 消息发送确认
socket.on('message_sent', (response) => {
  // { success, messageId, error }
});
```

### 7.3 Nanobot API (WebSocket)

#### 客户端消息（App → Server）
```json
// 注册设备
{
  "type": "register",
  "device_id": "app_xxx",
  "device_type": "mobile_app"
}

// 配对请求
{
  "type": "app_pairing",
  "code": "AB12CD34",
  "device_id": "app_xxx",
  "client_info": {
    "device_name": "iPhone",
    "platform": "mobile"
  },
  "user_id": "optional-uuid"
}

// 聊天消息
{
  "type": "chat_message",
  "device_id": "app_xxx",
  "msg_id": "1234567890",
  "message": "你好",
  "message_type": "text",
  "media_url": "optional-url"
}

// 心跳
{
  "type": "ping"
}
```

#### 服务器消息（Server → App）
```json
// 注册成功
{
  "type": "register_success"
}

// 配对成功
{
  "type": "pairing_success",
  "device_name": "My Nanobot"
}

// 配对失败
{
  "type": "pairing_failed",
  "message": "Invalid code"
}

// AI 响应
{
  "type": "chat_response",
  "msg_id": "1234567890",
  "response": "你好！有什么可以帮助你？",
  "timestamp": "2026-02-17T10:30:00Z"
}

// 错误
{
  "type": "error",
  "message": "Error message"
}

// 心跳响应
{
  "type": "pong"
}
```

### 7.4 阿里云 OSS API

```typescript
// OSSService.uploadFile
async uploadFile(file: File | Blob): Promise<{
  url: string;
  name: string;
}> {
  // 使用 ali-oss SDK 上传
  // 返回公共 URL
}
```

---

## 八、环境配置说明

### 8.1 必需环境变量

#### Supabase 配置
```bash
# Supabase 项目 URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase 匿名公钥（anon key）
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取方式**：
1. 访问 https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
2. 复制 "Project URL"
3. 复制 "anon public" 密钥（以 `eyJ` 开头的长 JWT token）

#### Clawbot Gateway 配置
```bash
# Gateway WebSocket 地址
# 模式1: Tailscale 内网（推荐）
VITE_PC_WEBSOCKET_URL=ws://100.110.229.48:18789

# 模式2: ngrok 公网
VITE_PC_WEBSOCKET_URL=wss://devyn-physicochemical-halina.ngrok-free.dev

# 模式3: 局域网
VITE_PC_WEBSOCKET_URL=ws://192.168.1.100:18789

# Gateway 认证 Token
VITE_PC_AUTH_TOKEN=f5a90456ca2531d1d227c95bba997726c5f139bcb5b798d6
```

#### Nanobot 配置
```bash
# Nanobot 云端服务器地址
VITE_NANOBOT_SERVER_URL=ws://47.243.55.130:8766

# OSS 文件上传端点
VITE_OSS_ENDPOINT=https://your-oss-endpoint.com/upload
```

#### Clawbot Channel 配置
```bash
# Clawbot Channel 云端服务器地址
VITE_CLAWBOT_CHANNEL_URL=wss://m.jmtrick.com
```

### 8.2 环境变量使用

```typescript
// 读取环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const gatewayUrl = import.meta.env.VITE_PC_WEBSOCKET_URL;
const authToken = import.meta.env.VITE_PC_AUTH_TOKEN;
```

**注意**：所有环境变量必须以 `VITE_` 开头才能在 Vite 中使用。

### 8.3 配置文件

#### src/config/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

## 九、开发工作流

### 9.1 本地开发

#### 安装依赖
```bash
npm install
```

#### 启动开发服务器
```bash
npm run dev
```
访问: http://localhost:5173

#### 开发模式特性
- 热模块替换 (HMR)
- 源码映射
- TypeScript 类型检查
- 自动刷新

### 9.2 生产构建

#### 构建
```bash
npm run build
```

#### 构建输出
- 目录: `dist/`
- 文件哈希: 启用
- 代码分割: 启用
- 压缩: Terser
- Console: 移除

#### 预览构建
```bash
npm run preview
```

### 9.3 部署

#### 方式 A：Nginx 部署

**1. 构建项目**
```bash
npm run build
```

**2. 上传到服务器**
```bash
scp -r dist/* user@server:/var/www/trix-3d-companion/
```

**3. 配置 Nginx**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/trix-3d-companion;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|mp4)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

**4. 重启 Nginx**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 方式 B：Vercel 部署

**1. 安装 Vercel CLI**
```bash
npm i -g vercel
```

**2. 登录并部署**
```bash
vercel login
vercel --prod
```

**3. 配置环境变量**
在 Vercel Dashboard → Settings → Environment Variables 添加：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLAWBOT_CHANNEL_URL`
- `VITE_NANOBOT_SERVER_URL`

#### 方式 C：一键脚本部署

```bash
cd deploy
./deploy-frontend.sh
```

脚本会自动：
- 构建项目
- 备份现有部署
- 上传文件到服务器
- 配置 Nginx
- 重启服务

### 9.4 数据库迁移

#### 执行 SQL 脚本

**1. 登录 Supabase Dashboard**
- 访问 https://supabase.com/dashboard
- 选择你的项目
- 点击 "SQL Editor"
- 点击 "New Query"

**2. 执行脚本**
复制 SQL 脚本（如 `database/add-points-system.sql`）并执行。

**3. 验证**
```sql
-- 检查表是否创建成功
SELECT COUNT(*) FROM user_points;
```

### 9.5 Git 工作流

#### 分支策略
- `main` - 生产分支
- `feature/*` - 功能分支
- `fix/*` - 修复分支

#### 提交规范
```bash
# 功能
git commit -m "feat: 添加积分系统"

# 修复
git commit -m "fix: 修复登录错误"

# 文档
git commit -m "docs: 更新部署文档"

# 样式
git commit -m "style: 格式化代码"

# 重构
git commit -m "refactor: 优化认证流程"
```

---

## 十、已知问题和待办事项

### 10.1 已知问题

#### 高优先级
- [ ] Clawbot Channel 连接偶尔断开，需优化重连机制
- [ ] 积分系统在快速操作时可能出现并发问题
- [ ] 大文件上传时进度显示不准确

#### 中优先级
- [ ] 部分组件在移动端 Safari 上渲染异常
- [ ] WebSocket 在某些网络环境下连接不稳定
- [ ] i18n 翻译不完整

#### 低优先级
- [ ] 部分图标在不同分辨率下显示模糊
- [ ] 某些动画在低端设备上卡顿

### 10.2 待办事项

#### 功能开发
- [ ] 装备购买系统
- [ ] 成就系统
- [ ] 排行榜功能
- [ ] 社交分享功能
- [ ] 深色模式完善

#### 性能优化
- [ ] 实现图片懒加载
- [ ] 添加 Service Worker
- [ ] 启用 CDN
- [ ] 优化包体积

#### 用户体验
- [ ] 添加骨架屏
- [ ] 优化加载动画
- [ ] 添加手势操作
- [ ] 改善错误提示

#### 测试
- [ ] 添加单元测试
- [ ] 添加 E2E 测试
- [ ] 性能测试
- [ ] 兼容性测试

### 10.3 技术债务

- [ ] 统一错误处理机制
- [ ] 重构 WebSocket 连接管理
- [ ] 优化状态管理（考虑 Zustand/Jotai）
- [ ] 添加日志系统
- [ ] 完善 TypeScript 类型定义

---

## 十一、设计规范

### 11.1 UI 设计规范

#### 颜色系统
```css
/* 主色调 */
--primary: #6366f1;        /* Indigo 500 */
--primary-hover: #4f46e5;  /* Indigo 600 */

/* 背景色 */
--bg-primary: #f0f9ff;     /* 浅蓝背景 */
--bg-secondary: #ffffff;   /* 白色背景 */
--bg-tertiary: #f1f5f9;    /* 灰色背景 */

/* 文本色 */
--text-primary: #1e293b;   /* 深色文本 */
--text-secondary: #64748b; /* 次要文本 */
--text-muted: #94a3b8;     /* 弱化文本 */

/* 状态色 */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;
```

#### 字体系统
```css
/* 字体大小 */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### 间距系统
```css
/* Tailwind Spacing */
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
```

#### 圆角
```css
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-2xl: 1rem;     /* 16px */
--radius-full: 9999px;
```

#### 阴影
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

#### 毛玻璃效果
```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### 11.2 组件命名规范

#### 文件命名
- **组件**: PascalCase (如 `UserProfile.tsx`)
- **Hook**: camelCase with `use` prefix (如 `useAuth.ts`)
- **Service**: camelCase (如 `databaseService.ts`)
- **Context**: PascalCase with `Context` suffix (如 `AuthContext.tsx`)
- **Type**: PascalCase (如 `UserProfile.ts`)

#### 组件内部命名
```typescript
// 组件名：PascalCase
function UserProfile() {}

// Props 接口：组件名 + Props
interface UserProfileProps {}

// 状态：驼峰命名，set 前缀
const [userName, setUserName] = useState('');
const [isLoading, setIsLoading] = useState(false);

// 事件处理器：handle + 动作
const handleClick = () => {};
const handleSubmit = () => {};

// 布尔值：is/has/show 前缀
const isActive = true;
const hasError = false;
const showModal = true;
```

### 11.3 代码组织规范

#### 文件结构
```typescript
// 1. 导入
import React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

// 2. 类型定义
interface Props {
  // ...
}

// 3. 常量
const CONSTANT_VALUE = 'value';

// 4. 组件定义
function Component({ prop1, prop2 }: Props) {
  // 4.1 Hooks
  const [state, setState] = useState();
  const { data } = useCustomHook();

  // 4.2 事件处理器
  const handleClick = () => {};

  // 4.3 副作用
  useEffect(() => {
    // ...
  }, []);

  // 4.4 渲染
  return <div>...</div>;
}

// 5. 导出
export default Component;
export { Component };
```

#### 导入顺序
```typescript
// 1. React 核心
import React, { useState, useEffect } from 'react';

// 2. 第三方库
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// 3. 绝对导入（@/ 别名）
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 4. 相对导入
import { HelperComponent } from './HelperComponent';
import { localUtility } from '../utils/localUtility';

// 5. 类型导入
import type { User } from '../types';
```

### 11.4 国际化规范

#### 语言文件结构
```json
{
  "common": {
    "confirm": "Confirm",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "logout": "Logout"
  },
  "chat": {
    "sendMessage": "Send",
    "typeMessage": "Type a message..."
  }
}
```

#### 使用方式
```typescript
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation();

  return <button>{t('common.confirm')}</button>;
}
```

### 11.5 Git 提交规范

#### 提交消息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建或辅助工具变动

#### 示例
```bash
feat(chat): 添加图片消息支持

- 实现图片选择功能
- 添加图片预览组件
- 支持图片压缩上传

Closes #123
```

---

## 附录

### A. 相关文档链接

| 文档 | 路径 |
|------|------|
| 项目 README | [README.md](README.md) |
| 部署总结 | [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) |
| 文档索引 | [docs/INDEX.md](docs/INDEX.md) |
| 功能文档 | [docs/FEATURES.md](docs/FEATURES.md) |
| 数据库架构 | [src/database/SCHEMA.md](src/database/SCHEMA.md) |
| 三端架构文档 | [docs/三端接通架构文档.md](docs/三端接通架构文档.md) |
| Nanobot 集成指南 | [docs/nanobot/INTEGRATION_GUIDE.md](docs/nanobot/INTEGRATION_GUIDE.md) |
| OpenClaw 集成方案 | [docs/OpenClaw最佳接入方案-MVP.md](docs/OpenClaw最佳接入方案-MVP.md) |

### B. 快速命令参考

```bash
# 开发
npm install              # 安装依赖
npm run dev              # 启动开发服务器
npm run build           # 生产构建
npm run preview         # 预览构建

# Git
git checkout -b feature/xxx  # 创建功能分支
git commit -m "feat: xxx"    # 提交
git push origin feature/xxx  # 推送

# 服务器
ssh user@server               # SSH 登录
systemctl restart nginx      # 重启 Nginx
journalctl -u nanobot -f     # 查看服务日志

# 数据库
# 在 Supabase SQL Editor 中执行
SELECT * FROM profiles LIMIT 10;
```

### C. 端口配置

| 服务 | 端口 | 协议 | 说明 |
|------|------|------|------|
| Vite Dev Server | 5173 | HTTP | 开发服务器 |
| Clawbot Channel | 18789 | WebSocket | 本地 Gateway |
| Nanobot Server | 8766 | WebSocket | 云端服务器 |
| Clawbot Channel Cloud | 443 | WSS | 云端 Socket.IO |
| Nginx | 80/443 | HTTP/HTTPS | Web 服务器 |

---

**文档结束**

> 如需进一步了解项目细节，请参考相关文档或查看源代码。
> **维护者**: TRIX 3D Companion 开发团队
> **最后更新**: 2026-02-17

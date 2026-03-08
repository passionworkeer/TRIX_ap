# ARCHITECTURE.md - 系统架构

> TRIX 3D Companion 系统架构概览。详细文档见 [docs/development/ARCHITECTURE.md](./docs/development/ARCHITECTURE.md)

---

## 🏗️ 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         用户设备                                  │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   Web 浏览器    │              │   iOS 设备      │          │
│  │  (React SPA)    │              │  (SwiftUI App)  │          │
│  └────────┬────────┘              └────────┬────────┘          │
└───────────┼───────────────────────────────┼────────────────────┘
            │                               │
            ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        负载均衡 / CDN                             │
└──────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│                     前端应用 (Vite + React)                        │
│                    src/ (端口 5173 开发)                          │
│                    dist/ (生产构建)                                │
└──────────────────────────────────────────────────────────────────┘
            │
            │ WebSocket / REST
            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  后端服务 (Node.js + Express)                      │
│              server/clawbot-channel/ (端口 8765)                 │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  WebSocket  │  │    REST     │  │   业务逻辑   │             │
│  │   Server    │  │    API      │  │   Services  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│   Supabase (PostgreSQL)  │   │     阿里云 OSS            │
│   - 用户数据             │   │     - 文件存储              │
│   - 聊天消息             │   │     - 头像                  │
│   - 学习记录             │   │     - 截图                  │
└─────────────────────────┘   └─────────────────────────────┘
```

---

## 📦 技术栈

### Web 前端

| 技术 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TypeScript 5.8 | 类型系统 |
| Vite 6 | 构建工具 |
| Tailwind CSS 4 | 样式框架 |
| React Context | 状态管理 |
| React Router v7 | 路由管理 |
| Supabase Client | 数据库客户端 |
| Socket.io Client | WebSocket 客户端 |
| Framer Motion 12 | 动画 |
| Leaflet | 地图 |
| React Virtuoso | 虚拟列表 |
| i18next | 国际化 |

### 后端服务

| 技术 | 用途 |
|------|------|
| Node.js | 运行时 |
| Express | Web 框架 |
| Socket.io | WebSocket |
| SQLite3 | 本地数据库 |
| Supabase Client | 云数据库 |
| 阿里云 OSS | 文件存储 |
| Express-rate-limit | 限流 |

### iOS 应用

| 技术 | 用途 |
|------|------|
| SwiftUI | UI 框架 |
| Combine | 响应式编程 |
| AVFoundation | 音视频 |
| XcodeGen | 项目生成 |

---

## 🔄 数据流

### 用户认证流程

```
1. 用户登录 → 前端调用 Supabase Auth
2. Supabase 返回 JWT token
3. 前端存储 token (localStorage)
4. 后续请求携带 token
5. 后端验证 token 有效性
```

### 实时消息流程

```
1. 前端建立 WebSocket 连接
2. 用户发送消息 → 后端
3. 后端处理 → 存储 Supabase
4. 后端广播 → 所有订阅者
5. 前端接收 → 更新 UI
```

### AI 对话流程

```
1. 用户输入 → 前端
2. 前端 WebSocket → Gateway
3. Gateway 流式响应 → 前端
4. 前端实时渲染 → UI
```

---

## 📂 核心模块

### 前端 (`src/`)

```
src/
├── screens/           # 页面组件 (18个)
│   ├── Home.tsx       # 首页 (3D 角色)
│   ├── Chat.tsx       # 聊天列表
│   ├── ChatDetail.tsx # 聊天详情
│   ├── Study.tsx      # 学习计时
│   ├── Profile.tsx    # 用户资料
│   ├── Wardrobe.tsx   # 虚拟衣柜
│   ├── PointsMall.tsx # 积分商城
│   ├── SnapMapScreen.tsx # 地图位置
│   ├── QRCodePairing.tsx # 扫码配对
│   ├── Pairing.tsx    # 配对管理
│   ├── Snapshot.tsx   # 截图功能
│   ├── Auth.tsx       # 登录注册
│   └── Diagnostic.tsx # 诊断工具
│
├── components/        # 可复用组件 (48个)
│   ├── GlassDock.tsx # 底部导航
│   ├── GlassPanel.tsx
│   ├── HeroBackground.tsx
│   ├── Avatar.tsx
│   ├── VoiceRecorder.tsx
│   ├── VoiceMessage.tsx
│   ├── MediaMessage.tsx
│   ├── LazyImage.tsx
│   ├── VirtualizedList.tsx
│   ├── QRScanner.tsx
│   ├── ui/           # UI 基础组件
│   └── map/          # 地图组件
│
├── contexts/          # React Context (6个)
│   ├── AuthContext.tsx
│   ├── ClawbotChannelContext.tsx
│   ├── QRCodePairingContext.tsx
│   ├── ThemeContext.tsx
│   └── VoiceSettingsContext.tsx
│
├── features/          # 功能模块 (按功能组织)
│   ├── chat/         # 聊天 - components/hooks/utils
│   ├── study/        # 学习 - components/hooks
│   ├── schedule/     # 日程 - components/hooks/store
│   ├── todo/         # 待办 - components/store
│   └── location/     # 位置 - components
│
├── services/         # 业务服务 (26个)
│   ├── chatService.ts
│   ├── friendService.ts
│   ├── studySessionService.ts
│   ├── studyHistoryService.ts
│   ├── scheduleService.ts
│   ├── todoService.ts
│   ├── achievementService.ts
│   ├── pointsService.ts
│   ├── mallService.ts
│   ├── wardrobeService.ts
│   ├── notificationService.ts
│   ├── locationService.ts
│   ├── placeService.ts
│   ├── OSSService.ts
│   ├── uploadService.ts
│   ├── ttsService.ts
│   ├── voicePlaybackService.ts
│   ├── ClawbotChannelBridge.ts
│   ├── ConnectionManager.ts
│   └── ...
│
├── hooks/            # 自定义 Hooks (12个)
│   ├── useAudioPlayer.ts
│   ├── useBotStateMachine.ts
│   ├── useCamera.ts
│   ├── useClawbotMessages.ts
│   ├── useImmersiveVoice.ts
│   ├── useNotification.ts
│   ├── useResourcePreloader.ts
│   ├── useSpeechToText.ts
│   ├── useTouchGestures.ts
│   └── useVoiceRecorder.ts
│
├── types/            # TypeScript 类型
├── utils/           # 工具函数
└── lib/             # 库配置
```

### 后端 (`server/clawbot-channel/`)

```
server/clawbot-channel/
├── routes/          # API 路由 (按模块拆分)
│   ├── mvp.js      # 核心 MVP 功能 (用户/好友/日程/待办/成就/商城/衣柜)
│   ├── extended.js # 扩展功能 (聊天/学习/配对/地点/积分/快照/通知)
│   └── supplement.js # 补充功能 (未读/AI对话/学习目标)
├── services/        # 业务逻辑
├── middleware/      # 中间件
├── server.js        # 入口文件
└── package.json
```

---

## 🗄️ 数据库

### ERD 关系图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   profiles  │────▶│   friends   │◀────│   profiles  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│chat_rooms   │────▶│chat_messages│◀────│chat_rooms   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│unread_counts│
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│study_sessions    │     │study_rooms │     │achievements│
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
              ┌─────────────────────┐
              │study_room_participants│
              └─────────────────────┘
```

### 核心表

| 表名 | 描述 | 关键字段 |
|------|------|---------|
| profiles | 用户配置 | user_id, username, avatar_url |
| friends | 好友关系 | user_id, friend_id, status |
| chat_messages | 聊天消息 | room_id, sender_id, content, created_at |
| chat_rooms | 聊天房间 | type, name, created_at |
| unread_counts | 未读计数 | user_id, friend_id, count |

### 学习相关

| 表名 | 描述 | 关键字段 |
|------|------|---------|
| study_sessions | 学习记录 | user_id, start_time, end_time, duration |
| study_rooms | 虚拟自习室 | name, max_members, is_active |
| study_room_participants | 房间成员 | room_id, user_id, joined_at |
| study_goals | 学习目标 | user_id, title, target_hours |
| achievements | 成就定义 | name, description, icon |
| user_achievements | 用户成就 | user_id, achievement_id, unlocked_at |

### 积分与商城

| 表名 | 描述 |
|------|------|
| user_points | 用户积分余额 |
| points_transactions | 积分变动记录 |
| mall_items | 商城商品 |
| user_purchased_items | 用户已购商品 |
| outfits | 装扮定义 |
| user_outfits | 用户装扮 |

### 其他业务表

| 表名 | 描述 |
|------|------|
| schedules | 日程 |
| todos | 待办 |
| places | 地点 |
| place_favorites | 地点收藏 |
| pairing_requests | 配对请求 |
| paired_devices | 配对设备 |
| notifications | 通知 |
| mails | 邮件 |
| device_tokens | 设备令牌 |
| clawbot_conversations | AI 对话 |
| clawbot_messages | AI 消息 |
| user_settings | 用户设置 |

详见: [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)

---

## 🔐 安全架构

- **认证**: JWT Token (Supabase Auth)
- **API 鉴权**: Bearer Token 中间件
- **限流**: Express-rate-limit
- **文件上传**: 阿里云 OSS 签名 URL
- **数据验证**: Joi/自定义验证

---

## 📈 部署架构

| 环境 | 组件 |
|------|------|
| 生产 Web | Vercel / Netlify |
| 生产后端 | 云服务器 (端口 8765) |
| 数据库 | Supabase |
| 文件存储 | 阿里云 OSS |
| 域名 | api.trix3d.com |

---

## 📚 详细文档

- 完整架构: [docs/development/ARCHITECTURE.md](./docs/development/ARCHITECTURE.md)
- Web 架构: [docs/WEB_ARCHITECTURE.md](./docs/WEB_ARCHITECTURE.md)
- iOS 架构: [docs/IOS_ARCHITECTURE.md](./docs/IOS_ARCHITECTURE.md)
- 后端架构: [docs/BACKEND_ARCHITECTURE.md](./docs/BACKEND_ARCHITECTURE.md)

---

**最后更新**: 2026-03-08

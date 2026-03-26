# Web 架构

> **最后更新**: 2026-03-26（代码扫描同步：修正 hooks 11→12（补 useBotStateMachine.ts），utils 9→10（补 coordinateUtils.ts））
> **技术栈**: React 19.2.4 + TypeScript 5.8.2 + Vite 6.2.0 + Tailwind CSS 4.2.0 + Supabase 2.94.0

---

## 1. 架构概览

```text
React App
  │
  ├─ pairing / uploads / messages
  └─ user websocket
        │
        ▼
    TrixNativeChannelClient
        │
        ▼
    TRIX Native Server (VITE_TRIX_NATIVE_SERVER_URL)
```

**关键说明**：
- Web 直连 TRIX Native Server（**非**通过 OpenClaw Gateway）
- OpenClaw 插件通过 `packages/trix-openclaw-native` 独立运行
- 使用 `HashRouter`（兼容 Electron file:// 协议）

---

## 2. 路由（19 条）

使用 `HashRouter`，所有路由以 `#/` 开头。

| 路径 | 页面 | 说明 |
|------|------|------|
| `#/login` | Login | 登录 |
| `#/register` | Register | 注册 |
| `#/` | Home | 首页/仪表盘 |
| `#/snapshot` | Snapshot | AI 快照 |
| `#/snapshot/result` | SnapshotResult | 快照结果 |
| `#/study` | Study | 自习室列表 |
| `#/study/timer` | StudyTimer | 学习计时器 |
| `#/chat` | Chat | 聊天列表 |
| `#/chat/:friendId` | ChatDetail | 聊天详情 |
| `#/profile` | Profile | 个人资料 + **AchievementsPanel 成就面板** |
| `#/profile/:userId` | ProfileOther | 查看他人资料 |
| `#/pairing` | Pairing | 设备配对 |
| `#/qr-pairing` | QrPairing | QR 码配对 |
| `#/map` | SnapMap | 地图打卡 |
| `#/diagnostic` | Diagnostic | 诊断工具 |
| `#/diagnostic-advanced` | DiagnosticAdvanced | 高级诊断 |
| `#/points-mall` | PointsMall | 积分商城 |
| `#/wardrobe` | Wardrobe | 虚拟衣柜 |
| `#/snapmap` | — | → 重定向到 `#/map` |

---

## 3. 主要模块

### 3.1 服务层（src/services/）

| 文件 | 描述 | 行数 |
|------|------|------|
| `TrixNativeChannelClient.ts` | **主要通信层** — WebSocket + REST，1347 行 | 1347 |
| `chatService.ts` | 聊天功能 | — |
| `friendService.ts` | 好友管理 | — |
| `uploadService.ts` | 文件上传 | — |
| `serverOssUploadService.ts` | 服务端 OSS 上传 | — |
| `OSSService.ts` | 阿里云 OSS | — |
| `sessionService.ts` | 会话管理 | — |
| `StorageService.ts` | 本地存储抽象 | — |
| `ConnectionManager.ts` | 连接状态管理 | — |
| `databaseService.ts` | 数据库操作 | — |
| `studySessionService.ts` | 学习记录 | — |
| `studyHistoryService.ts` | 学习历史 | — |
| `scheduleService.ts` | 日程管理 | — |
| `todoService.ts` | 待办事项 | — |
| `achievementService.ts` | 成就系统 | — |
| `pointsService.ts` | 积分系统 | — |
| `mallService.ts` | 商城功能 | — |
| `wardrobeService.ts` | 衣柜/装扮 | — |
| `locationService.ts` | 位置服务 | — |
| `baiduMapService.ts` | 百度地图 | — |
| `placeService.ts` | 地点数据 | — |
| `projectService.ts` | 项目管理 | — |
| `voicePlaybackService.ts` | 语音播放 | — |
| `ttsService.ts` | TTS 语音合成 | — |
| `notificationService.ts` | 通知管理 | — |
| `userStatsService.ts` | 用户统计 | — |
| `clawbotHistoryService.ts` | 聊天历史 | — |

共 **27 个** 服务文件。

### 3.2 Context 层

| Context | 文件 | 用途 |
|---------|------|------|
| AuthContext | `src/contexts/AuthContext.tsx` | 认证状态、用户信息、Session |
| ClawbotChannelContext | `src/contexts/ClawbotChannelContext.tsx` | TRIX Native Channel 状态 |
| VoiceSettingsContext | `src/contexts/VoiceSettingsContext.tsx` | 语音/TTS 设置 |
| ThemeContext | `src/contexts/ThemeContext.tsx` | 主题切换（亮/暗） |

**注意**：`useClawbotMessages` hook **不存在**，消息通过 `ClawbotChannelContext` 获取。

### 3.3 组件

- `src/components/` — 45 组件（含子目录 `chat/`、`map/`、`ui/`）
- `src/components/AchievementsPanel.tsx` — ★ 成就面板（集成 Profile 页面）
- `src/screens/` — 14 个页面组件
- `src/hooks/` — 12 个自定义 hooks（含 `useConfirmModal`）
- `src/three/` — Three.js 3D/WebGL 组件（使用 Zustand）

### 3.4 Feature 模块

| 模块 | 目录 | 内容 |
|------|------|------|
| chat | `src/features/chat/` | `useChatMessages` hook、`aiPrompt` 工具、MediaPreview/MessageInput/MessageList |
| location | `src/features/location/` | `LocationPicker` 组件 |
| schedule | `src/features/schedule/` | `ScheduleForm`/`ScheduleList` 组件、`scheduleStore`（Provider）、`useScheduleNotification` hook |
| study | `src/features/study/` | 9 个组件（AchievementModal、DurationSelector、FocusStartAnimation 等）、`useStudyTimer`/`useCompanionSync`/`useStudySession` hooks |
| todo | `src/features/todo/` | `TodoForm`/`TodoList` 组件、`todoStore`（Provider） |

### 3.5 错误处理系统 (`src/lib/`)

| 文件 | 描述 |
|------|------|
| `errors.ts` (724行) | `ErrorCode` 枚举(50+ codes)、`AppError` 类、`ERROR_MESSAGES`、`ApiResponse`/`ApiError` 类型 |
| `error-boundary.tsx` | `ErrorBoundary` 组件、`withErrorBoundary` HOC、`to()` safe await |
| `error-hooks.ts` | `useErrorHandler`、`useApi`、`useApiAction`、`useServiceResponse` |
| `error-interceptor.ts` | `initGlobalErrorHandler`、`safeAsync`、`withRetry`、`createErrorReporter` |
| `validation.ts` (486行) | 12 组验证规则（AUTH/CHAT/FRIEND/STUDY/TODO/SCHEDULE/LOCATION/NOTIFICATION/PAIRING/MALL/WARDROBE）、`sanitizeString`、`validateObject` |

### 3.6 国际化 (`src/i18n/`)

使用 `i18next` + `react-i18next` + `i18next-browser-languagedetector`。

| 语言 | 文件 |
|------|------|
| 中文简体（默认） | `locales/zh.json` |
| 中文繁体 | `locales/zh-TW.json` |
| 英语 | `locales/en.json` |
| 日语 | `locales/ja.json` |

检测顺序：localStorage → navigator，回退语言：`zh`

### 3.7 E2E 测试 (`src/e2e/`)

17 个 Playwright 测试文件覆盖：Auth、Chat、Diagnostic、Home、Login、Map、Pairing、PointsMall、Profile、QR Pairing、Snapshot、Social、StudyRoom、Wardrobe。

### 3.8 类型定义 (`src/types/`)

| 文件 | 内容 |
|------|------|
| `achievement.ts` | `Achievement` 接口、`ACHIEVEMENTS` 预定义列表 |
| `clawbotChannel.ts` | `ClawbotChannelMessage`、`ClawbotChannelAttachment` |
| `location.ts` | `UserLocation`、`LocationShareSettings`、`FriendLocation` |
| `mall.ts` | `MallItem`、`PointsBalance`、`PurchaseHistoryItem` |
| `place.ts` | `Place`、`PlaceSearchRequest` |
| `studyRoom.ts` | `StudyRoomState`、`StudyRoomMember`、`StudyRoomTimerState` |
| `wardrobe.ts` | `Outfit`、`OutfitCategory`（hat/cape/wand/background） |
| `workbench.ts` | `Todo`、`Schedule`、`WorkbenchItem` |

---

## 4. State Management

**主要方式：React Context + Hooks**

| State | 方案 | 说明 |
|------|------|------|
| 全局状态 | React Context | Auth、Channel、Voice、Theme |
| 3D 状态 | Zustand | 仅 `src/three/store/threeStore.ts` |

```typescript
// threeStore.ts — Zustand store
interface ThreeStore {
  botState: 'IDLE' | 'THINKING' | 'SPEAKING';
  loadProgress: number;
  isLoaded: boolean;
  webglCapable: boolean;
  enabled3D: boolean;
}
```

---

## 5. TrixNativeChannelClient

`src/services/TrixNativeChannelClient.ts`（1327 行）是主要通信层：

**功能**：
- WebSocket 连接管理（user 角色）
- 配对（QR 码 + 手动输入）
- 消息发送/接收（REST + WebSocket）
- 附件上传（签名 URL）
- 会话持久化（localStorage + 服务器）
- Study Room（创建/加入/离开/主持人操作）
- Session bind/restore

**事件驱动 API**：
```typescript
client.on('connecting', () => {})
client.on('connected', () => {})
client.on('disconnected', () => {})
client.on('message', (msg) => {})
client.on('error', (err) => {})
client.on('pairing:success', () => {})
client.on('study_room_state', (state) => {})
```

---

## 6. 环境变量

### 必需
- `VITE_SUPABASE_URL` — Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key

### 推荐
- `VITE_TRIX_NATIVE_SERVER_URL` — TRIX Native Server 地址
- `VITE_TRIX_NATIVE_PUBLIC_URL` — 对外公开 URL（生成 QR 用）

### 可选（地图）
- `VITE_BAIDU_MAP_AK` — 百度地图 API Key

### 已废弃（兼容）
- `VITE_CLAWBOT_CHANNEL_URL` — 已废弃
- `VITE_GATEWAY_WS_URL` — 已废弃
- `VITE_GATEWAY_AUTH_TOKEN` — 已废弃

---

## 7. Tailwind CSS 4.2.0

**配置**：
```typescript
// vite.config.ts
plugins: [tailwindcss(), applyDirectives()]

// index.css
@import "tailwindcss";
@source "../index.html";
@source "./**/*.{ts,tsx}";
@custom-variant dark (&:where(.dark, .dark *));
```

**CSS 变量（iOS 风格设计系统）**：
```css
:root {
  --bg-primary: ...;
  --bg-secondary: ...;
  --text-primary: ...;
  --color-primary: #8b5cf6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --shadow-ios-soft: ...;
  --glass-highlight: ...;
  --glass-border-strong: ...;
}
```

**自定义工具类**：
- `.ios-glass-surface` — 玻璃效果
- `.ios-pressable` — iOS 按压效果
- `.card`, `.card-glass`, `.card-hover` — 卡片
- `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` — 按钮
- `.input-field` — 输入框
- `.badge-*` — 徽章
- `.animate-float`, `.animate-glow-pulse`, `.animate-heartbeat` — 动画

---

## 8. 项目结构

```
src/
├── App.tsx              # 根组件，HashRouter + lazy loading
├── index.css            # Tailwind CSS 4 + CSS 变量 + 自定义工具类
├── types.ts             # AppRoutes enum + 全局类型
│
├── config/
│   ├── supabase.ts      # Supabase 客户端配置
│   ├── clawbotEndpoints.ts  # Native Server URL 解析
│   └── metadata.json    # 应用元数据
│
├── contexts/            # 4 个 React Context
│   ├── AuthContext.tsx
│   ├── ClawbotChannelContext.tsx
│   ├── VoiceSettingsContext.tsx
│   └── ThemeContext.tsx
│
├── services/            # 27 个服务文件（9,200+ 行）
│   ├── TrixNativeChannelClient.ts  # 主要通信层（1,347 行）
│   ├── chatService.ts / friendService.ts / ...
│   └── databaseService.ts          # barrel re-export
│
├── components/          # 45 组件（含 chat/, map/, ui/ 子目录）
├── screens/             # 14 个页面组件
├── hooks/               # 12 个自定义 hooks
├── features/            # 5 个 feature 模块
│   ├── chat/            # 消息功能
│   ├── location/        # 位置功能
│   ├── schedule/        # 日程功能（含 store）
│   ├── study/           # 学习功能（含 9 组件 + 3 hooks）
│   └── todo/            # 待办功能（含 store）
├── lib/                 # 错误处理系统（errors, validation, boundary）
├── types/               # 8 个类型定义文件
├── utils/               # 9 个工具文件
├── i18n/                # 4 语言国际化
├── three/               # Three.js 3D 组件（Zustand store）
├── e2e/                 # 17 个 Playwright 测试
└── index.html
```

---

**最后更新**: 2026-03-26（代码扫描同步：版本栈确认 React 19.2.4 + TS 5.8.2 + Vite 6.2 + Tailwind 4.2.0 + Supabase 2.94.0，utils 9→10（coordinateUtils.ts））

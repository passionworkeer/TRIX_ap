# TRIX 3D Companion - 技术架构文档

> **版本**: v1.0.0  
> **更新日期**: 2026-02-14  
> **项目**: TRIX 3D Companion - 移动端 AI 伴侣应用

---

## 📋 目录

1. [系统概述](#1-系统概述)
2. [技术栈](#2-技术栈)
3. [系统架构图](#3-系统架构图)
4. [状态管理](#4-状态管理)
5. [路由结构](#5-路由结构)
6. [API 文档](#6-api-文档)
7. [WebSocket 通信](#7-websocket-通信)
8. [UI 架构](#8-ui-架构)
9. [用户系统](#9-用户系统)
10. [数据库设计](#10-数据库设计)
11. [部署架构](#11-部署架构)

---

## 1. 系统概述

TRIX 3D Companion 是一款面向移动端的 AI 伴侣应用，采用 **Zero UI** 设计理念，核心特性包括：

- 🎭 **Zero UI 设计** - 首页仅展示全屏 3D 角色，点击后显示功能面板
- 🤖 **AI 对话** - 通过 WebSocket 连接本地/云端 Gateway，实现流式 AI 响应
- 👥 **社交功能** - 好友聊天、实时消息、未读提醒
- ⏱️ **学习计时** - 番茄钟学习工具，支持状态同步和虚拟自习室
- 📍 **实时位置** - 基于 Leaflet 的地图共享
- 🗣️ **语音交互** - 集成 Web Speech API 语音识别
- 📱 **扫码配对** - 手机端与电脑端 Gateway 通过二维码配对

---

## 2. 技术栈

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | 19.2.4 | UI 框架 |
| 语言 | TypeScript | 5.8.2 | 类型安全 |
| 构建工具 | Vite | 6.2.0 | 快速构建 |
| 路由 | React Router | 7.13.0 | 客户端路由 |
| 状态管理 | React Context + Hooks | - | 轻量级状态管理 |
| 动画 | Framer Motion | 12.33.0 | 流畅动画 |
| 样式 | Tailwind CSS (CDN) | - | 原子化 CSS |
| 图标 | Lucide React | 0.563.0 | 图标库 |
| 地图 | Leaflet + React-Leaflet | 1.9.4 / 5.0.0 | 地图组件 |
| 二维码 | html5-qrcode | 2.3.8 | 扫码功能 |
| 图片压缩 | browser-image-compression | 2.0.2 | 图片处理 |
| 通知 | react-hot-toast | 2.6.0 | Toast 通知 |

### 2.2 后端/服务技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 数据库 | Supabase (PostgreSQL) | 主数据库 |
| 认证 | Supabase Auth | 用户认证 |
| 实时通信 | Supabase Realtime | 数据库变更订阅 |
| AI Gateway | Clawbot Gateway | 本地 AI 服务 |
| 云配对 | Nanobot Server | 云端配对服务 |
| 文件存储 | Aliyun OSS | 媒体文件上传 |

---

## 3. 系统架构图

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRIX 3D Mobile App                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        React Frontend                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  AuthContext │  │WebSocketCtx  │  │  QRCodePairingContext    │  │   │
│  │  │  (用户认证)   │  │(Clawbot连接) │  │    (配对管理)             │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │NanobotContext│  │  Components  │  │       Services           │  │   │
│  │  │(云端配对)    │  │   (UI组件)    │  │    (业务逻辑)             │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────┐         ┌────────────────┐        ┌────────────────┐     │
│  │   Supabase   │         │ Clawbot        │        │   Nanobot      │     │
│  │   Realtime   │         │   Gateway      │        │    Server      │     │
│  │ (好友状态)   │         │  (AI 对话)     │        │  (云端配对)     │     │
│  └──────────────┘         └────────────────┘        └────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼ WebSocket
┌─────────────────────────────────────────────────────────────────────────────┐
│                      External Services                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Clawbot Gateway │  │  Nanobot Server  │  │   Aliyun OSS     │          │
│  │  (Port 18789)    │  │  (Port 8765)     │  │  (文件存储)       │          │
│  │  - WebSocket     │  │  - WebSocket     │  │  - 图片上传       │          │
│  │  - 认证机制      │  │  - 配对服务      │  │  - 视频存储       │          │
│  │  - 流式响应      │  │  - 消息转发      │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流架构

```
┌───────────┐     ┌───────────┐     ┌───────────┐
│   User    │────▶│  React UI │────▶│  Context  │
│  Action   │     │ Component │     │  State    │
└───────────┘     └───────────┘     └─────┬─────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            ┌───────────┐          ┌───────────┐          ┌───────────┐
            │ Supabase  │          │ WebSocket │          │  Local    │
            │   API     │          │  Gateway  │          │ Storage   │
            └───────────┘          └───────────┘          └───────────┘
```

---

## 4. 状态管理

### 4.1 Context 架构

项目使用 React Context 进行状态管理，采用分层架构：

```
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (根组件)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │              AuthProvider (认证层)                 │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │          WebSocketProvider (连接层)          │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │       NanobotProvider (云端层)         │  │  │  │
│  │  │  │  ┌───────────────────────────────┐    │  │  │  │
│  │  │  │  │    QRCodePairingProvider      │    │  │  │  │
│  │  │  │  │    (配对层 - 按需加载)         │    │  │  │  │
│  │  │  │  │  ┌─────────────────────────┐  │    │  │  │  │
│  │  │  │  │  │      Routes / Screens   │  │    │  │  │  │
│  │  │  │  │  └─────────────────────────┘  │    │  │  │  │
│  │  │  │  └───────────────────────────────┘    │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 AuthContext - 用户认证状态

**文件**: `src/contexts/AuthContext.tsx`

**状态接口**:
```typescript
interface AuthContextType {
  user: User | null;           // Supabase 用户对象
  profile: Profile | null;     // 用户资料
  session: Session | null;     // 会话信息
  loading: boolean;            // 加载状态
  
  // 操作方法
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}
```

**功能说明**:
- 管理用户登录/注册/登出
- 自动同步 Supabase 会话状态
- 用户资料管理
- 提供全局认证状态

### 4.3 WebSocketContext - Clawbot 连接状态

**文件**: `src/contexts/WebSocketContext.tsx`

**状态接口**:
```typescript
interface WebSocketContextValue {
  status: ConnectionStatus;        // DISCONNECTED | CONNECTING | CONNECTED | ERROR | RECONNECTING
  isConnected: boolean;            // 是否已连接
  fullResponse: string;            // Bot 完整响应（流式）
  currentStreamId: string | null;  // 当前流 ID
  lastError: string | null;        // 最后错误信息
  reconnectCount: number;          // 重连次数
  
  // 操作方法
  connect: () => void;             // 建立连接
  disconnect: () => void;          // 断开连接
  sendMessage: (text: string, media?: MediaInfo) => void;  // 发送消息
}
```

**连接流程**:
1. 从 localStorage 读取配对信息（device_token, gateway_url）
2. 建立 WebSocket 连接
3. 处理连接挑战 (connect.challenge)
4. 发送认证响应（包含 token）
5. 连接成功后启动心跳保活
6. 支持自动重连（指数退避策略）

### 4.4 NanobotContext - 云端配对状态

**文件**: `src/contexts/NanobotContext.tsx`

**状态接口**:
```typescript
interface NanobotContextType {
  status: ConnectionStatus;        // 连接状态
  connected: boolean;              // 是否已连接
  pairingCode: string | null;      // 配对码
  deviceId: string;                // 设备 ID
  messages: NanobotMessage[];      // 消息列表
  lastError: string | null;        // 错误信息
  
  // 操作方法
  connect: (code?: string) => void;
  disconnect: () => void;
  sendMessage: (message: string, messageType?: 'text' | 'image' | 'video' | 'file', mediaUrl?: string) => void;
  clearMessages: () => void;
  clearPairing: () => void;
}
```

### 4.5 QRCodePairingContext - 配对状态管理

**文件**: `src/contexts/QRCodePairingContext.tsx`

**状态接口**:
```typescript
interface QRCodePairingContextType {
  isPairing: boolean;              // 是否正在配对
  pairingRequest: PairingRequest | null;
  pairingStatus: PairingResponse['status'] | null;
  deviceToken: string | null;      // 配对成功后的设备 Token
  errorMessage: string | null;
  qrCodeContent: string | null;    // 二维码内容
  
  // 操作方法
  startPairing: (deviceName?: string) => Promise<void>;
  cancelPairing: () => Promise<void>;
  resetPairing: () => void;
}
```

---

## 5. 路由结构

### 5.1 路由配置

**文件**: `src/App.tsx` + `src/types.ts`

```typescript
enum AppRoutes {
  HOME = '/',                    // 首页（3D 角色）
  LOGIN = '/login',              // 登录
  REGISTER = '/register',        // 注册
  SNAPSHOT = '/snapshot',        // 快拍
  SNAPSHOT_RESULT = '/snapshot/result',  // 快拍结果
  STUDY = '/study',              // 学习
  TIMER = '/study/timer',        // 番茄钟计时器
  CHAT = '/chat',                // 聊天列表
  CHAT_DETAIL = '/chat/detail',  // 聊天详情
  PROFILE = '/profile',          // 个人资料
  SETTINGS = '/profile/settings', // 设置
  PAIRING = '/pairing',          // 配对页面
  QR_PAIRING = '/qr-pairing',    // 二维码配对
  DIAGNOSTIC = '/diagnostic',    // 诊断页面
  DIAGNOSTIC_ADV = '/diagnostic-advanced', // 高级诊断
  MAP = '/map',                  // 地图
}
```

### 5.2 路由层级

```
App (HashRouter)
├── AuthProvider
│   └── WebSocketProvider
│       └── NanobotProvider
│           └── Routes
│               ├── /login (公开)
│               ├── /register (公开)
│               └── /* (ProtectedRoute)
│                   ├── / (Home)
│                   ├── /snapshot
│                   ├── /study
│                   ├── /study/timer
│                   ├── /chat
│                   ├── /chat/detail
│                   ├── /profile
│                   ├── /pairing
│                   ├── /qr-pairing
│                   ├── /map
│                   └── /diagnostic
```

### 5.3 路由守卫

```typescript
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={AppRoutes.LOGIN} replace />;
  
  return children;
};
```

---

## 6. API 文档

### 6.1 Supabase API

#### 6.1.1 认证 API

| 操作 | 方法 | 说明 |
|------|------|------|
| 登录 | `supabase.auth.signInWithPassword()` | 邮箱+密码登录 |
| 注册 | `supabase.auth.signUp()` | 新用户注册 |
| 登出 | `supabase.auth.signOut()` | 退出登录 |
| 获取会话 | `supabase.auth.getSession()` | 获取当前会话 |
| 监听状态 | `supabase.auth.onAuthStateChange()` | 订阅认证状态变化 |

#### 6.1.2 数据库 API

**好友管理**:
```typescript
// 获取好友列表
getFriends(): Promise<FriendLatestMessage[]>

// 更新好友状态
updateFriendStatus(friendId: string, status: 'online' | 'offline' | 'busy' | 'away'): Promise<void>

// 更新好友学习状态
updateFriendStudyStatus(friendId: string, isStudying: boolean, studyTime?: number): Promise<void>
```

**聊天消息**:
```typescript
// 获取聊天历史
getChatHistory(friendId: string): Promise<ChatMessage[]>

// 发送消息
sendMessage(friendId: string, sender: 'user' | 'friend' | 'bot', text: string): Promise<string | null>

// 发送媒体消息
sendMessageWithMedia(friendId: string, sender: 'user' | 'friend' | 'bot', text: string, mediaData: {...}, messageType: 'image' | 'video' | 'mixed'): Promise<string | null>

// 标记消息已读
markMessagesAsRead(friendId: string): Promise<void>
```

**通知邮件**:
```typescript
// 获取通知
getNotifications(): Promise<Notification[]>

// 获取邮件
getMails(): Promise<Mail[]>

// 标记已读
markNotificationAsRead(notificationId: string): Promise<void>
markMailAsRead(mailId: string): Promise<void>
```

**学习记录**:
```typescript
// 获取学习记录
getStudySessions(limit?: number): Promise<StudySession[]>

// 创建学习记录
createStudySession(subject: string, duration: number, startedAt: string, endedAt?: string, notes?: string): Promise<string | null>

// 获取今日学习时长
getTodayStudyTime(): Promise<number>
```

#### 6.1.3 实时订阅 API

```typescript
// 订阅聊天消息
subscribeToChatMessages(friendId: string, callback: (message: ChatMessage) => void)

// 订阅未读计数
subscribeToUnreadCounts(callback: (unreadCount: UnreadCount) => void)

// 订阅通知
subscribeToNotifications(callback: (notification: Notification) => void)
```

### 6.2 WebSocket API (Clawbot Gateway)

#### 6.2.1 连接流程

```
1. Client ──WebSocket──▶ Gateway: ws://host:port?auth_token=xxx
2. Gateway ──JSON──▶ Client: { event: "connect.challenge", payload: { nonce, timestamp } }
3. Client ──JSON──▶ Gateway: { type: "req", method: "connect", params: {...} }
4. Gateway ──JSON──▶ Client: { type: "res", payload: { type: "hello-ok" } }
```

#### 6.2.2 消息格式

**连接请求**:
```json
{
  "type": "req",
  "id": "nonce-value",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "client": {
      "id": "clawdbot-ios",
      "mode": "webchat",
      "platform": "ios",
      "displayName": "TRIX App",
      "version": "1.0.0",
      "instanceId": "random-id"
    },
    "caps": [],
    "auth": { "token": "auth-token" }
  }
}
```

**发送消息**:
```json
{
  "type": "req",
  "id": "timestamp",
  "method": "agent",
  "params": {
    "message": "用户输入的消息",
    "to": "self",
    "idempotencyKey": "timestamp",
    "media": {
      "uri": "media-url",
      "type": "image/jpeg",
      "size": 12345,
      "metadata": { "width": 800, "height": 600 }
    }
  }
}
```

**流式响应**:
```json
{
  "type": "res",
  "id": "message-id",
  "payload": {
    "type": "stream",
    "stream": "assistant",
    "data": {
      "delta": "增量文本",
      "done": false
    }
  }
}
```

#### 6.2.3 Nanobot WebSocket API

**连接地址**: `ws://47.243.55.130:8765`

**注册设备**:
```json
{
  "type": "register",
  "device_id": "app_xxx",
  "device_type": "mobile_app"
}
```

**配对请求**:
```json
{
  "type": "app_pairing",
  "code": "PAIRING_CODE",
  "device_id": "app_xxx",
  "user_id": "supabase-user-id",
  "client_info": {
    "device_name": "Mobile",
    "platform": "mobile",
    "user_agent": "..."
  }
}
```

**聊天消息**:
```json
{
  "type": "chat_message",
  "device_id": "app_xxx",
  "msg_id": "timestamp",
  "message": "用户消息",
  "message_type": "text",
  "media_url": "optional-media-url"
}
```

### 6.3 REST API

#### 6.3.1 Gateway HTTP API

**发送配对请求**:
```http
POST /pairing/request
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_id": "device-id",
  "device_name": "TRIX Mobile",
  "device_type": "mobile",
  "auto_approve": true,
  "metadata": { "platform": "iOS", "userAgent": "..." }
}
```

**查询配对状态**:
```http
GET /pairing/status/{requestId}
Authorization: Bearer {token}
```

#### 6.3.2 OSS 上传 API

```typescript
// 上传文件到 OSS
uploadFile(file: File | Blob): Promise<string>

// 生成预签名 URL
getSignedUrl(key: string): Promise<string>
```

---

## 7. WebSocket 通信

### 7.1 Clawbot Gateway 通信协议

#### 7.1.1 连接状态机

```
                    ┌─────────────┐
         ┌─────────▶│ DISCONNECTED│◀────────┐
         │          └─────────────┘         │
         │ connect()         disconnect()   │
         ▼                                    │
   ┌─────────────┐    认证失败    ┌─────────┐
   │  CONNECTING │───────────────▶│  ERROR  │
   └─────────────┘                └────┬────┘
         │                             │
         │ 认证成功                     │
         ▼                             │
   ┌─────────────┐    连接断开         │
   │  CONNECTED  │─────────────────────┘
   └─────────────┘
         │
         │ 连接异常
         ▼
   ┌─────────────┐    重连成功
   │ RECONNECTING│────────────────▶ CONNECTED
   └─────────────┘
```

#### 7.1.2 心跳机制

```typescript
// 心跳间隔: 30 秒
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// 发送心跳
ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));

// 接收响应
{ type: "pong", timestamp: 1234567890 }
```

#### 7.1.3 自动重连策略

```typescript
// 重连配置
const RECONNECT_INITIAL_DELAY_MS = 2 * 1000;  // 初始延迟 2 秒
const RECONNECT_MAX_DELAY_MS = 60 * 1000;     // 最大延迟 60 秒
const RECONNECT_BACKOFF_FACTOR = 1.5;         // 指数退避因子
const MAX_RECONNECT_ATTEMPTS = 100;           // 最大重连次数

// 计算重连延迟
const delay = Math.min(
  RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, attempts - 1),
  RECONNECT_MAX_DELAY_MS
);
```

### 7.2 Nanobot 通信协议

#### 7.2.1 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `register` | C→S | 设备注册 |
| `register_success` | S→C | 注册成功 |
| `app_pairing` | C→S | 配对请求 |
| `pairing_success` | S→C | 配对成功 |
| `pairing_failed` | S→C | 配对失败 |
| `chat_message` | C→S | 聊天消息 |
| `chat_response` | S→C | AI 回复 |
| `ping/pong` | 双向 | 心跳 |
| `error` | S→C | 错误通知 |

---

## 8. UI 架构

### 8.1 三层布局架构

```
┌─────────────────────────────────────────────┐
│  Layer 0: 背景层 (HeroBackground)           │
│  - 首页全屏 3D 角色背景                       │
│  - 固定定位，不滚动                           │
│  - z-index: 0                                │
├─────────────────────────────────────────────┤
│  Layer 10: 内容层 (Routes)                  │
│  - 可滚动内容区域                             │
│  - 首页透明，其他页面浅灰背景                  │
│  - z-index: 10                               │
├─────────────────────────────────────────────┤
│  Layer 50: 悬浮层 (GlassDock)               │
│  - 底部导航栏                                │
│  - 毛玻璃效果                                │
│  - z-index: 50                               │
└─────────────────────────────────────────────┘
```

### 8.2 核心组件

#### 8.2.1 GlassDock - 底部导航

**文件**: `src/components/GlassDock.tsx`

**功能**:
- 5 个导航项：地图、学习、首页（核心）、聊天、个人
- 毛玻璃效果（backdrop-filter: blur(20px)）
- 核心按钮发光效果
- iOS 风格弹簧动画
- 智能显示/隐藏逻辑

**导航配置**:
```typescript
const tabs = [
  { id: "map", icon: Map, path: "/snapmap" },
  { id: "study", icon: BookOpen, path: "/study" },
  { id: "core", icon: Camera, path: "/", isCore: true },
  { id: "chat", icon: MessageSquare, path: "/chat" },
  { id: "profile", icon: User, path: "/profile" },
];
```

#### 8.2.2 HeroBackground - 首页背景

**文件**: `src/components/HeroBackground.tsx`

**功能**:
- 全屏 3D 角色展示
- Zero UI 设计核心
- 点击显示功能面板

#### 8.2.3 聊天组件

**文件**: `src/screens/Chat.tsx`, `src/screens/ChatDetail.tsx`

**功能**:
- 好友列表（带未读计数）
- 聊天详情（支持 Bot/好友）
- 媒体消息支持（图片/视频）
- 实时消息同步

### 8.3 动画系统

使用 Framer Motion 实现流畅动画：

```typescript
// GlassDock 进出动画
initial={{ y: 150, opacity: 0, scale: 0.9 }}
animate={{ 
  y: 0, 
  opacity: 1, 
  scale: 1,
  transition: {
    type: "spring",
    stiffness: 300,
    damping: 25,
    mass: 0.8
  }
}}
exit={{ 
  y: 150, 
  opacity: 0, 
  scale: 0.9 
}}

// 选中指示器动画
<motion.div layoutId="active-glow" />
<motion.div layoutId="dot-indicator" />
```

---

## 9. 用户系统

### 9.1 认证流程

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│   User   │────────▶│  Supabase│────────▶│  Profile │
│ (Login)  │         │   Auth   │         │   Table  │
└──────────┘         └──────────┘         └──────────┘
      │                     │                     │
      │ 1. signInWithPassword │                   │
      │─────────────────────▶│                   │
      │                     │                   │
      │ 2. Session + User    │                   │
      │◀─────────────────────│                   │
      │                     │                   │
      │ 3. Fetch Profile     │                   │
      │─────────────────────┼───────────────────▶│
      │                     │                   │
      │ 4. Profile Data      │                   │
      │◀────────────────────┼───────────────────│
```

### 9.2 用户数据结构

```typescript
interface Profile {
  id: string;                    // 用户 ID (UUID)
  username: string;              // 用户名
  full_name?: string;            // 全名
  avatar_url?: string;           // 头像 URL
  bio?: string;                  // 个人简介
  website?: string;              // 个人网站
  points?: number;               // 积分
  is_studying?: boolean;         // 是否正在学习
  companion_id?: string | null;  // 陪伴好友 ID
  days_active?: number;          // 活跃天数
  interaction_count?: number;    // 互动次数
  created_at?: string;
  updated_at?: string;
}
```

### 9.3 好友系统

#### 9.3.1 好友数据结构

```typescript
interface Friend {
  id: string;
  user_id: string;               // 所属用户
  friend_id: string;             // 好友 ID
  name: string;                  // 好友名称
  avatar_url: string | null;     // 头像
  status: 'online' | 'offline' | 'busy' | 'away';
  bio: string | null;
  study_time: number;            // 学习时长（分钟）
  is_studying: boolean;          // 是否正在学习
  created_at: string;
  updated_at: string;
}
```

#### 9.3.2 添加好友流程

```typescript
async function addFriend(account: string): Promise<void> {
  // 1. 查找目标用户（支持邮箱或用户名）
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id')
    .or(`email.eq.${account},username.eq.${account}`)
    .single();

  // 2. 不能添加自己
  // 3. 检查是否已是好友
  // 4. 插入双向好友关系
  await supabase.from('friends').insert([
    { user_id: currentUserId, friend_id: targetUserId, status: 'accepted' },
    { user_id: targetUserId, friend_id: currentUserId, status: 'accepted' }
  ]);
}
```

---

## 10. 数据库设计

### 10.1 数据库架构

```
┌─────────────────┐
│     users       │  (Supabase Auth)
│  - id (PK)      │
│  - email        │
│  - username     │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────┐
│ profiles │ friends │ chat_messages │ notifications │ mails  │
│ study_sessions │ study_rooms │ study_room_members │ pairing_requests│
└─────────────────────────────────────────────────────────────┘
```

### 10.2 核心表结构

#### 10.2.1 profiles - 用户资料

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  points INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  companion_id UUID REFERENCES profiles(id),
  days_active INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 10.2.2 friends - 好友表

```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,  -- 对方用户 ID
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'away')),
  bio TEXT,
  study_time INTEGER DEFAULT 0,
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

#### 10.2.3 chat_messages - 聊天记录

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,  -- 会话 ID (userId_friendId)
  sender_id UUID NOT NULL REFERENCES profiles(id),
  receiver_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'mixed')),
  media_uri TEXT,
  media_type TEXT,
  media_size INTEGER,
  media_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 10.2.4 unread_counts - 未读计数

```sql
CREATE TABLE unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

#### 10.2.5 pairing_requests - 配对请求

```sql
CREATE TABLE pairing_requests (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  device_token TEXT,
  node_id TEXT,
  platform TEXT,
  user_agent TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);
```

### 10.3 视图和函数

#### 10.3.1 friend_latest_messages 视图

```sql
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT 
  f.user_id,
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.is_studying,
  f.bio,
  f.study_time,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id;
```

#### 10.3.2 存储过程

```sql
-- 标记消息已读
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id UUID,
  p_friend_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE unread_counts
  SET unread_count = 0, updated_at = NOW()
  WHERE user_id = p_user_id AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. 部署架构

### 11.1 构建配置

**文件**: `vite.config.ts`

```typescript
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    build: isProduction ? {
      target: 'es2015',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js'],
            'leaflet': ['leaflet', 'react-leaflet'],
            'motion': ['framer-motion'],
          },
        },
      },
    } : undefined,
  };
});
```

### 11.2 环境变量

```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Clawbot Gateway 配置
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
VITE_PC_AUTH_TOKEN=your-secure-auth-token

# Nanobot 配置
VITE_NANOBOT_SERVER_URL=ws://47.243.55.130:8765
VITE_OSS_ENDPOINT=https://your-oss-endpoint.com/upload
```

### 11.3 部署流程

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 构建
npm run build

# 4. 输出目录
dist/
├── index.html
├── assets/
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
└── ...

# 5. 部署到服务器
# 使用 deploy.sh 或 deploy.ps1 脚本
```

---

## 12. 开发规范

### 12.1 目录结构

```
src/
├── components/          # UI 组件
│   ├── GlassDock.tsx
│   ├── HeroBackground.tsx
│   └── ...
├── screens/             # 页面组件
│   ├── Home.tsx
│   ├── Chat.tsx
│   ├── ChatDetail.tsx
│   └── ...
├── contexts/            # React Context
│   ├── AuthContext.tsx
│   ├── WebSocketContext.tsx
│   ├── NanobotContext.tsx
│   └── QRCodePairingContext.tsx
├── services/            # 业务服务
│   ├── databaseService.ts
│   ├── clawbotPairingService.ts
│   ├── NanobotBridge.ts
│   └── OSSService.ts
├── types/               # 类型定义
│   ├── clawbot.ts
│   └── index.ts
├── config/              # 配置文件
│   └── supabase.ts
├── hooks/               # 自定义 Hooks
│   ├── useCamera.ts
│   ├── useSpeechToText.ts
│   └── useNotification.ts
├── utils/               # 工具函数
│   └── dateFormat.ts
└── constants.ts         # 常量定义
```

### 12.2 命名规范

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `GlassDock.tsx` |
| 上下文 | PascalCase + Context | `AuthContext.tsx` |
| 服务 | camelCase | `databaseService.ts` |
| 类型 | PascalCase | `clawbot.ts` |
| 常量 | UPPER_SNAKE_CASE | `IMAGES.WIZARD_BOY` |
| 函数 | camelCase | `getFriends()` |
| 接口 | PascalCase + Type | `AuthContextType` |

---

## 13. 附录

### 13.1 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目总结 | `PROJECT_SUMMARY.md` | 项目整体概述 |
| 数据库架构 | `src/database/SCHEMA.md` | 详细数据库设计 |
| API 文档 | `docs/api/` | API 详细文档 |
| 部署指南 | `docs/deployment/` | 部署相关文档 |

### 13.2 外部依赖

- **Clawbot Gateway**: 本地 AI 服务，端口 18789
- **Nanobot Server**: 云端配对服务，ws://47.243.55.130:8765
- **Supabase**: 数据库和认证服务
- **Aliyun OSS**: 文件存储服务

---

**文档结束**

*最后更新: 2026-02-14*

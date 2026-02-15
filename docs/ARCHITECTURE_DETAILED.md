# TRIX 3D Companion 项目架构文档

> **文档版本**: 1.0.0
> **最后更新**: 2026-02-14
> **维护者**: TRIX Team

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈全景](#2-技术栈全景)
3. [目录结构](#3-目录结构)
4. [核心架构设计](#4-核心架构设计)
5. [模块详解](#5-模块详解)
6. [数据流设计](#6-数据流设计)
7. [关键功能实现](#7-关键功能实现)
8. [性能优化策略](#8-性能优化策略)
9. [开发指南](#9-开发指南)
10. [部署架构](#10-部署架构)

---

## 1. 项目概览

### 1.1 项目简介

**TRIX 3D Companion** 是一个基于 React 的沉浸式学习伴侣应用，采用 Zero UI 设计理念，通过 3D 虚拟角色和流畅动画提供沉浸式用户体验。

### 1.2 核心特性

- **沉浸式 3D 体验**: 动态 3D 角色背景，Zero UI 设计
- **实时多端通信**: 支持 App 与桌面客户端实时配对和通信
- **AI 对话集成**: 流式 AI 响应，类似 ChatGPT 的体验
- **学习伴侣系统**: 番茄钟、学习统计、学习伙伴列表
- **社交功能**: 好友系统、实时聊天、消息推送
- **地图定位**: 基于 Leaflet 的位置共享和地图功能

### 1.3 技术亮点

- ✨ **现代化技术栈**: React 19 + TypeScript + Vite
- 🎨 **毛玻璃动画效果**: Framer Motion + Tailwind CSS
- 🔐 **完整的认证系统**: Supabase Auth + JWT
- 📡 **实时数据同步**: Supabase Realtime + WebSocket
- 🚀 **高性能构建**: 代码分割、懒加载、Tree Shaking

---

## 2. 技术栈全景

### 2.1 前端框架层

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19.2.4 | UI 框架，函数组件 + Hooks |
| **TypeScript** | 5.8.2 | 类型安全，提升代码质量 |
| **Vite** | 6.2.0 | 构建工具，快速 HMR |
| **React Router** | 7.13.0 | 声明式路由管理 |

### 2.2 UI 与样式层

| 技术 | 用途 |
|------|------|
| **Tailwind CSS** | 原子化 CSS，快速样式开发 |
| **Framer Motion** | 声明式动画库 |
| **Lucide Icons** | 轻量级图标库 |
| **react-hot-toast** | 优雅的通知提示组件 |

### 2.3 后端服务层

| 技术 | 用途 |
|------|------|
| **Supabase** | BaaS 平台 (Auth + Database + Storage + Realtime) |
| **PostgreSQL** | 关系型数据库 (Supabase 底层) |
| **阿里云 OSS** | 对象存储，媒体文件托管 |

### 2.4 实时通信层

| 技术 | 用途 |
|------|------|
| **WebSocket** | 双向实时通信 |
| **Supabase Realtime** | 数据库变更订阅 |
| **Socket.IO Client** | Nanobot 桌面端通信 |

### 2.5 工具库

| 技术 | 用途 |
|------|------|
| **browser-image-compression** | 前端图片压缩 |
| **html5-qrcode** | 二维码扫描 |
| **Leaflet** | 地图展示 |
| **crypto.subtle** | Web Crypto API，HMAC 签名 |

---

## 3. 目录结构

```
trix-3d-companion/
├── docs/                      # 项目文档
│   ├── api/                   # API 文档
│   ├── guides/                # 使用指南
│   ├── features/              # 功能说明
│   ├── config/                # 配置说明
│   └── archive/               # 归档文档
│
├── public/                    # 静态资源
│
├── scripts/                   # 工具脚本
│   └── manual-test.cjs        # 手动测试脚本
│
├── src/                       # 源代码
│   ├── assets/                # 静态资源
│   │   ├── roles/             # 3D 角色资源
│   │   │   ├── role1/         # 角色 1
│   │   │   └── role2/         # 角色 2
│   │   ├── background.jpg     # 背景图
│   │   └── StudyRoomBG.png    # 学习室背景
│   │
│   ├── components/            # 可复用组件
│   │   ├── AddFriendModal.tsx # 添加好友模态框
│   │   ├── AIActionModal.tsx  # AI 操作模态框
│   │   ├── AIActionSelector.tsx
│   │   ├── Avatar.tsx         # 头像组件
│   │   ├── FilePicker.tsx     # 文件选择器
│   │   ├── GlassDock.tsx      # 毛玻璃底部导航
│   │   ├── GlassPanel.tsx     # 毛玻璃面板
│   │   ├── HeroBackground.tsx # 3D 角色背景
│   │   ├── MailPanel.tsx      # 邮件面板
│   │   ├── MediaMessage.tsx   # 媒体消息组件
│   │   ├── NotificationPanel.tsx
│   │   ├── ProjectProgress.tsx
│   │   ├── QRScanner.tsx      # 二维码扫描器
│   │   ├── SnapshotModal.tsx  # 快拍模态框
│   │   ├── StatusHeader.tsx   # 状态栏
│   │   ├── StudyBuddiesList.tsx
│   │   ├── StudyRoom.tsx      # 学习室组件
│   │   └── UserSwitcher.tsx   # 用户切换器
│   │
│   ├── config/                # 配置文件
│   │   ├── metadata.json      # 元数据
│   │   └── supabase.ts        # Supabase 配置
│   │
│   ├── contexts/              # React Context
│   │   ├── AuthContext.tsx    # 认证状态管理
│   │   ├── NanobotContext.tsx # Nanobot 连接管理
│   │   ├── QRCodePairingContext.tsx
│   │   └── WebSocketContext.tsx # WebSocket 管理
│   │
│   ├── database/              # 数据库相关
│   │   ├── init.sql           # 初始化 SQL
│   │   ├── complete-init.sql  # 完整初始化
│   │   ├── README.md          # 数据库说明
│   │   └── SCHEMA.md          # Schema 文档
│   │
│   ├── hooks/                 # 自定义 Hooks
│   │   ├── useCamera.ts       # 相机功能
│   │   ├── useNotification.ts # 通知功能
│   │   └── useSpeechToText.ts # 语音识别
│   │
│   ├── screens/               # 页面组件
│   │   ├── Auth.tsx           # 认证页面
│   │   ├── Chat.tsx           # 聊天列表
│   │   ├── ChatDetail.tsx     # 聊天详情
│   │   ├── Diagnostic.tsx     # 诊断页面
│   │   ├── DiagnosticAdvanced.tsx
│   │   ├── Home.tsx           # 首页
│   │   ├── Map.tsx            # 地图页面
│   │   ├── NanobotPairing.tsx # Nanobot 配对
│   │   ├── Pairing.tsx        # 配对页面
│   │   ├── Profile.tsx        # 个人资料
│   │   ├── QRCodePairing.tsx  # 二维码配对
│   │   ├── SnapMapScreen.tsx  # 地图快拍
│   │   ├── Snapshot.tsx       # 快拍页面
│   │   └── Study.tsx          # 学习页面
│   │
│   ├── services/              # 业务逻辑层
│   │   ├── clawbotPairingService.ts
│   │   ├── databaseService.ts # 数据库操作
│   │   ├── NanobotBridge.ts   # Nanobot 桥接
│   │   ├── OSSService.ts      # OSS 上传服务
│   │   ├── projectService.ts  # 项目服务
│   │   └── uploadService.ts   # 上传服务
│   │
│   ├── types/                 # TypeScript 类型
│   │   └── clawbot.ts         # Clawbot 类型定义
│   │
│   ├── utils/                 # 工具函数
│   │   └── dateFormat.ts      # 日期格式化
│   │
│   ├── clawbot/               # Clawbot 相关
│   │   └── index.ts
│   │
│   ├── App.tsx                # 应用根组件
│   ├── constants.ts           # 常量定义
│   ├── index.css              # 全局样式
│   ├── index.tsx              # 应用入口
│   ├── types.ts               # 全局类型
│   └── vite-env.d.ts          # Vite 类型声明
│
├── .env.example               # 环境变量示例
├── package.json               # 项目配置
├── tsconfig.json              # TypeScript 配置
└── vite.config.ts             # Vite 配置
```

---

## 4. 核心架构设计

### 4.1 分层架构

```
┌────────────────────────────────────────────────────┐
│                    表现层 (UI)                      │
│              Screens / Components                  │
│     Home | Chat | Study | GlassDock               │
├────────────────────────────────────────────────────┤
│                    状态层 (State)                   │
│                  Context API                       │
│   Auth | WebSocket | Nanobot | Pairing            │
├────────────────────────────────────────────────────┤
│                    业务层 (Logic)                   │
│                  Services                          │
│   database | upload | pairing | bridge            │
├────────────────────────────────────────────────────┤
│                    数据层 (Data)                    │
│              API / Storage                         │
│   Supabase | OSS | WebSocket | localStorage       │
└────────────────────────────────────────────────────┘
```

### 4.2 Context Provider 嵌套结构

```tsx
// src/App.tsx
<AuthProvider>                    // 认证状态
  <WebSocketProvider>             // WebSocket 连接
    <NanobotProvider>             // Nanobot 管理
      <HashRouter>                // 路由
        <QRCodePairingProvider>   // 二维码配对（按需）
          <AppContent />
        </QRCodePairingProvider>
      </HashRouter>
    </NanobotProvider>
  </WebSocketProvider>
</AuthProvider>
```

### 4.3 三层布局架构

应用采用三层 Z-Index 布局策略：

```tsx
<div className="fixed inset-0 w-full h-full">
  {/* 🎨 Layer 0: 背景层 - 3D 角色 (z-index: 0) */}
  {isHomePage && <HeroBackground />}

  {/* 📜 Layer 10: 滚动内容层 (z-index: 10) */}
  <div className="relative z-10 overflow-y-auto">
    <Routes>{/* 页面内容 */}</Routes>
  </div>

  {/* 🎯 Layer 50: 悬浮交互层 (z-index: 50) */}
  <AnimatePresence>
    {user && !isAuthPage && <GlassDock />}
  </AnimatePresence>

  {/* Toast 通知 (z-index: 9999) */}
  <Toaster position="top-center" />
</div>
```

---

## 5. 模块详解

### 5.1 认证系统 (AuthContext)

**位置**: `src/contexts/AuthContext.tsx`

**功能**:
- 用户注册/登录/登出
- Session 管理
- Profile 数据同步
- 自动恢复登录状态

**核心实现**:

```typescript
interface AuthContextType {
  user: User | null;              // Supabase User
  profile: Profile | null;        // 用户资料
  session: Session | null;        // 会话信息
  loading: boolean;               // 加载状态
  signIn: (email, password) => Promise<{ error }>;
  signUp: (email, password, username) => Promise<{ error }>;
  signOut: () => Promise<void>;
  updateProfile: (updates) => Promise<{ error }>;
  refreshProfile: () => Promise<void>;
}
```

**使用示例**:

```tsx
import { useAuth } from '@/contexts/AuthContext';

function ProfileScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <div>
      <h1>{profile?.username}</h1>
      <p>{user?.email}</p>
      <button onClick={signOut}>登出</button>
    </div>
  );
}
```

### 5.2 WebSocket 实时通信 (WebSocketContext)

**位置**: `src/contexts/WebSocketContext.tsx`

**功能**:
- WebSocket 连接管理
- 自动重连（指数退避）
- 心跳机制
- 流式 AI 响应处理

**连接流程**:

```
1. 建立 WebSocket 连接
   ↓
2. 收到 connect.challenge 挑战
   ↓
3. 发送 connect 请求（包含 auth token）
   ↓
4. 收到 hello-ok 确认
   ↓
5. 连接成功，开始心跳
```

**指数退避重连**:

```typescript
const RECONNECT_INITIAL_DELAY_MS = 2000;   // 初始 2s
const RECONNECT_MAX_DELAY_MS = 30000;      // 最大 30s
const RECONNECT_BACKOFF_FACTOR = 1.5;      // 退避因子
const MAX_RECONNECT_ATTEMPTS = 10;         // 最大 10 次

// 延迟序列: 2s → 3s → 4.5s → 6.75s → 10.125s → ...
```

### 5.3 Nanobot 桥接 (NanobotContext)

**位置**: `src/contexts/NanobotContext.tsx`

**功能**:
- 管理与 Nanobot 桌面端的连接
- 消息收发
- 配对码管理
- 自动重连

**配对流程**:

```
App 端                           云端服务器                      Nanobot 端
  │                                 │                              │
  ├─ 生成配对码 ────────────────────►│                              │
  │                                 │                              │
  │                                 │◄───── 输入配对码 ─────────────┤
  │                                 │                              │
  │◄────────────── 建立连接 ────────┼─────────────────────────────►│
  │                                 │                              │
  ├───────── 发送消息 ──────────────►│──────────── 转发 ────────────►│
  │                                 │                              │
```

### 5.4 数据库服务 (databaseService)

**位置**: `src/services/databaseService.ts`

**核心功能模块**:

#### 好友管理
- `getFriends()` - 获取好友列表（含最新消息）
- `addFriend(account)` - 添加好友（支持邮箱/用户名）
- `sendFriendRequest(account)` - 发送好友请求
- `updateFriendStatus()` - 更新好友状态

#### 聊天管理
- `getChatHistory(friendId)` - 获取聊天记录
- `sendMessage(friendId, sender, text)` - 发送文本消息
- `sendMessageWithMedia()` - 发送媒体消息
- `markMessagesAsRead(friendId)` - 标记已读
- `clearChatHistory(friendId)` - 清空聊天记录

#### 通知管理
- `getNotifications()` - 获取通知列表
- `markNotificationAsRead()` - 标记已读
- `deleteNotification()` - 删除通知

#### 学习记录
- `getStudySessions()` - 获取学习记录
- `createStudySession()` - 创建学习记录
- `getTodayStudyTime()` - 获取今日学习时长

#### 实时订阅
- `subscribeToChatMessages()` - 订阅聊天消息
- `subscribeToUnreadCounts()` - 订阅未读计数
- `subscribeToNotifications()` - 订阅通知

### 5.5 OSS 上传服务 (OSSService)

**位置**: `src/services/OSSService.ts`

**功能**:
- 浏览器端 HMAC-SHA1 签名
- 文件上传到阿里云 OSS
- 图片压缩（使用 browser-image-compression）

**签名流程**:

```typescript
// 1. 构造签名字符串
const stringToSign = `PUT\n\n${file.type}\n${date}\n/${bucket}/${objectName}`;

// 2. 使用 Web Crypto API 生成 HMAC-SHA1 签名
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(accessKeySecret),
  { name: 'HMAC', hash: 'SHA-1' },
  false,
  ['sign']
);
const signature = await crypto.subtle.sign('HMAC', key, messageData);

// 3. Base64 编码
const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

// 4. 构造 Authorization header
const authorization = `OSS ${accessKeyId}:${signatureBase64}`;
```

### 5.6 自定义 Hooks

#### useCamera - 相机功能

**位置**: `src/hooks/useCamera.ts`

```typescript
interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  startCamera: (facing?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  takePhoto: () => Promise<Blob | null>;
  switchCamera: () => void;
}
```

**使用示例**:

```tsx
function CameraScreen() {
  const { videoRef, isStreaming, takePhoto, switchCamera } = useCamera();

  useEffect(() => {
    startCamera('environment');
  }, []);

  const handleCapture = async () => {
    const blob = await takePhoto();
    if (blob) {
      // 处理照片
    }
  };

  return (
    <div>
      <video ref={videoRef} autoPlay />
      <button onClick={handleCapture}>拍照</button>
      <button onClick={switchCamera}>切换</button>
    </div>
  );
}
```

#### useSpeechToText - 语音识别

**位置**: `src/hooks/useSpeechToText.ts`

```typescript
interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}
```

---

## 6. 数据流设计

### 6.1 单向数据流

```
用户操作 → Action → Service/Context → State 更新 → UI 重渲染
```

**示例：发送消息流程**

```
1. 用户输入消息，点击发送
   ↓
2. ChatDetail 调用 sendMessage()
   ↓
3. databaseService.sendMessage() 写入 Supabase
   ↓
4. Supabase Realtime 推送消息
   ↓
5. subscribeToChatMessages() 收到新消息
   ↓
6. 更新 messages state
   ↓
7. UI 自动渲染新消息
```

### 6.2 Supabase Realtime 订阅模式

```typescript
// 订阅聊天消息
const channel = supabase
  .channel(`chat:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => {
      // 处理新消息
      onMessage(payload.new as ChatMessage);
    }
  )
  .subscribe();

// 清理订阅
return () => {
  supabase.removeChannel(channel);
};
```

### 6.3 会话 ID 生成规则

为确保双方对话使用相同的会话 ID，采用字典序拼接：

```typescript
const conversationId = userId < friendId
  ? `${userId}_${friendId}`
  : `${friendId}_${userId}`;
```

**示例**:
- 用户 A ID: `abc-123`
- 用户 B ID: `def-456`
- 会话 ID: `abc-123_def-456` (总是字典序小的在前)

---

## 7. 关键功能实现

### 7.1 路由守卫

**位置**: `src/App.tsx`

```tsx
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to={AppRoutes.LOGIN} replace />;
  }

  return children;
};

// 使用
<Route
  path={AppRoutes.CHAT}
  element={
    <ProtectedRoute>
      <Chat />
    </ProtectedRoute>
  }
/>
```

### 7.2 流式 AI 响应

**位置**: `src/contexts/WebSocketContext.tsx`

```typescript
const handleStreamResponse = useCallback((data: WebSocketResponse) => {
  if (data.payload?.stream === "assistant" && data.payload.data?.delta) {
    // 增量追加文本
    responseBufferRef.current += data.payload.data.delta;
    setFullResponse(responseBufferRef.current);

    // 更新流 ID
    if (!currentStreamIdRef.current) {
      const newStreamId = `stream-${Date.now()}`;
      currentStreamIdRef.current = newStreamId;
      setCurrentStreamId(newStreamId);
    }
  }

  // 流结束
  if (data.payload.data?.done) {
    currentStreamIdRef.current = null;
    setCurrentStreamId(null);
  }
}, []);
```

### 7.3 毛玻璃效果

**位置**: `src/components/GlassDock.tsx`

```tsx
<motion.div
  className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: 100, opacity: 0 }}
>
  <div className="mx-auto max-w-md bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl">
    {/* 导航项 */}
  </div>
</motion.div>
```

**关键 CSS 属性**:
- `bg-white/20` - 半透明背景
- `backdrop-blur-xl` - 背景模糊
- `border-white/30` - 半透明边框

### 7.4 图片压缩上传

**位置**: `src/services/uploadService.ts`

```typescript
async function compressImage(
  file: File,
  maxSizeMB = 1,
  maxWidthOrHeight = 1920
): Promise<File> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/jpeg' as const
  };

  return await imageCompression(file, options);
}

async function uploadWithCompression(file: File) {
  // 1. 压缩图片
  const compressedFile = await compressImage(file, 1, 1920);

  // 2. 上传到 OSS
  const url = await ossService.uploadFile(compressedFile);

  return url;
}
```

---

## 8. 性能优化策略

### 8.1 代码分割 (Code Splitting)

**位置**: `vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'leaflet': ['leaflet', 'react-leaflet'],
          'motion': ['framer-motion']
        }
      }
    }
  }
});
```

**效果**:
- 首屏加载更快
- 按需加载大型库
- 更好的缓存策略

### 8.2 图片懒加载

```tsx
<img
  src={uri}
  alt={alt}
  loading="lazy"      // 原生懒加载
  decoding="async"    // 异步解码
  onLoad={() => setImageLoaded(true)}
/>
```

### 8.3 动画性能优化

使用 GPU 加速的 CSS 属性：

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  // ✅ 使用 transform 和 opacity（GPU 加速）
  // ❌ 避免: width, height, margin 等（触发重排）
/>
```

### 8.4 生产构建优化

```typescript
build: {
  target: 'es2015',
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,   // 移除 console
      drop_debugger: true,  // 移除 debugger
    },
  },
  sourcemap: false,  // 禁用 sourcemap 减小体积
}
```

---

## 9. 开发指南

### 9.1 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 9.2 环境变量配置

创建 `.env` 文件：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# WebSocket 配置
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
VITE_PC_WEBSOCKET_URL_MOBILE=wss://your-server.com
VITE_PC_AUTH_TOKEN=your-auth-token

# OSS 配置
VITE_OSS_REGION=oss-cn-hangzhou
VITE_OSS_BUCKET=your-bucket
VITE_OSS_ACCESS_KEY_ID=your-access-key-id
VITE_OSS_ACCESS_KEY_SECRET=your-access-key-secret
```

### 9.3 代码规范

#### 组件命名
- 页面组件: `src/screens/` (如 `Home.tsx`, `Chat.tsx`)
- 可复用组件: `src/components/` (如 `GlassDock.tsx`)
- 使用 PascalCase 命名

#### 文件组织
- 每个文件一个主要导出
- 相关类型定义放在文件顶部或单独的 `types.ts`
- 工具函数放在 `src/utils/`

#### TypeScript 规范
- 优先使用 `interface` 定义类型
- 避免使用 `any`，使用 `unknown` 或具体类型
- 为所有函数参数和返回值添加类型注解

### 9.4 常见问题

#### Q: 如何添加新页面？

1. 在 `src/screens/` 创建页面组件
2. 在 `src/types.ts` 添加路由枚举
3. 在 `src/App.tsx` 添加路由配置
4. 如需认证保护，包裹 `<ProtectedRoute>`

#### Q: 如何添加新的 Context？

1. 在 `src/contexts/` 创建 Context 文件
2. 定义 ContextType 接口
3. 创建 Provider 组件
4. 导出 custom hook (如 `useAuth`, `useNanobot`)
5. 在 `App.tsx` 嵌套 Provider

#### Q: 如何订阅数据库变更？

```typescript
useEffect(() => {
  const unsubscribe = subscribeToChatMessages(friendId, (message) => {
    setMessages(prev => [...prev, message]);
  });

  return () => {
    unsubscribe(); // 清理订阅
  };
}, [friendId]);
```

---

## 10. 部署架构

### 10.1 部署拓扑

```
┌──────────────┐
│   用户浏览器   │
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────────┐
│   CDN (静态资源)  │
│  Vercel / Netlify │
└────────┬─────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    ▼         ▼             ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐
│Supabase│ │ OSS    │ │ WebSocket│ │  Python    │
│  BaaS  │ │ 存储   │ │  Server  │ │  Server    │
└────────┘ └────────┘ └──────────┘ └────────────┘
```

### 10.2 服务依赖

| 服务 | 用途 | 提供商 |
|------|------|--------|
| **静态托管** | 前端应用托管 | Vercel / Netlify |
| **Supabase** | 认证、数据库、实时订阅 | Supabase Cloud |
| **OSS** | 媒体文件存储 | 阿里云 OSS |
| **WebSocket** | 实时通信 | 自建服务器 |

### 10.3 构建和发布流程

```bash
# 1. 代码检查
npm run lint

# 2. 类型检查
npm run type-check

# 3. 构建生产版本
npm run build

# 4. 部署到 CDN
# 自动化: GitHub Actions / Vercel 自动部署
```

---

## 附录

### A. 关键文件索引

| 文件 | 用途 | 重要性 |
|------|------|--------|
| [src/App.tsx](../src/App.tsx) | 应用入口，路由配置 | ⭐⭐⭐⭐⭐ |
| [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx) | 认证管理 | ⭐⭐⭐⭐⭐ |
| [src/contexts/WebSocketContext.tsx](../src/contexts/WebSocketContext.tsx) | WebSocket 连接 | ⭐⭐⭐⭐⭐ |
| [src/services/databaseService.ts](../src/services/databaseService.ts) | 数据库操作 | ⭐⭐⭐⭐⭐ |
| [src/config/supabase.ts](../src/config/supabase.ts) | Supabase 配置 | ⭐⭐⭐⭐ |
| [src/types.ts](../src/types.ts) | 全局类型定义 | ⭐⭐⭐⭐ |
| [vite.config.ts](../vite.config.ts) | Vite 构建配置 | ⭐⭐⭐ |

### B. 技术债务

- [ ] 添加单元测试 (Jest + React Testing Library)
- [ ] 添加 E2E 测试 (Playwright / Cypress)
- [ ] 优化消息列表虚拟化 (react-window)
- [ ] 添加离线缓存 (Service Worker)
- [ ] 改进错误监控 (Sentry)

### C. 性能指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 首屏加载 (FCP) | < 1.5s | ~1.2s |
| 可交互时间 (TTI) | < 3s | ~2.5s |
| 构建大小 (gzip) | < 500KB | ~420KB |
| Lighthouse 分数 | > 90 | ~88 |

---

## 结语

本文档涵盖了 TRIX 3D Companion 项目的完整架构设计。建议开发者：

1. **先阅读**: 技术栈全景 → 目录结构 → 核心架构设计
2. **深入理解**: 模块详解 → 数据流设计
3. **实践参考**: 关键功能实现 → 开发指南

如有疑问，请参考 `docs/` 目录下的详细文档或联系团队。

---

*文档更新时间: 2026-02-14*

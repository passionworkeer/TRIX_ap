# TRIX 3D Companion 技术栈与核心亮点

> 本文档整理项目的核心技术栈、架构亮点和关键技术实现，供学习参考。

---

## 目录

1. [技术栈全景](#1-技术栈全景)
2. [核心技术亮点](#2-核心技术亮点)
3. [架构设计模式](#3-架构设计模式)
4. [关键技术实现](#4-关键技术实现)
5. [性能优化策略](#5-性能优化策略)
6. [学习要点总结](#6-学习要点总结)

---

## 1. 技术栈全景

### 1.1 前端框架层

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19.2.4 | UI 框架，采用函数组件 + Hooks |
| **TypeScript** | 5.8+ | 类型安全，提升代码质量 |
| **Vite** | 6.x | 构建工具，快速 HMR 和生产构建 |
| **React Router** | 7.13.0 | 声明式路由管理 |

### 1.2 UI 与样式层

| 技术 | 用途 |
|------|------|
| **Tailwind CSS** | 原子化 CSS，快速样式开发 |
| **Framer Motion** | 声明式动画库，流畅的过渡效果 |
| **Lucide Icons** | 轻量级图标库 |
| **react-hot-toast** | 优雅的通知提示组件 |

### 1.3 后端服务层

| 技术 | 用途 |
|------|------|
| **Supabase** | BaaS 平台，提供 Auth、Database、Storage、Realtime |
| **PostgreSQL** | 关系型数据库（Supabase 底层） |
| **阿里云 OSS** | 对象存储服务，媒体文件托管 |

### 1.4 实时通信层

| 技术 | 用途 |
|------|------|
| **WebSocket** | 双向实时通信（原生 API） |
| **Supabase Realtime** | 数据库变更订阅 |
| **Python WebSocket Server** | 云端配对服务 |

### 1.5 工具库

| 技术 | 用途 |
|------|------|
| **browser-image-compression** | 前端图片压缩 |
| **html5-qrcode** | 二维码扫描 |
| **Leaflet** | 地图展示 |
| **crypto.subtle** | Web Crypto API，HMAC 签名 |

---

## 2. 核心技术亮点

### 2.1 🌟 Zero UI 设计理念

项目采用 Zero UI（零界面）设计，通过 3D 角色和动画打造沉浸式体验。

**实现要点**:

```tsx
// 三层布局架构
<div className="relative h-screen overflow-hidden">
  {/* Layer 0: 背景层 - 3D 角色 */}
  <div className="fixed inset-0 z-0">
    <HeroBackground role={currentRole} />
  </div>

  {/* Layer 10: 内容层 - 可滚动 */}
  <div className="relative z-10 overflow-y-auto">
    <Routes>{/* 页面内容 */}</Routes>
  </div>

  {/* Layer 50: 悬浮层 - 底部导航 */}
  <div className="fixed bottom-0 left-0 right-0 z-50">
    <GlassDock />
  </div>
</div>
```

**亮点**:
- 毛玻璃效果 (`backdrop-filter: blur()`)
- 流畅的页面过渡动画
- 沉浸式全屏体验

---

### 2.2 🌟 多端实时配对系统

支持 App 与桌面端（Clawbot/Nanobot）的实时配对和通信。

**架构设计**:

```
┌─────────────┐                    ┌─────────────────┐
│   App 端    │                    │  云端配对服务器  │
│  (React)    │◄──WebSocket───────►│  (Python/WS)    │
└─────────────┘                    └────────┬────────┘
                                            │
                                   WebSocket│
                                            ▼
                                   ┌─────────────────┐
                                   │   Nanobot 端    │
                                   │  (桌面客户端)   │
                                   └─────────────────┘
```

**配对流程**:

```typescript
// 1. App 端生成配对码
const pairingCode = generatePairingCode(); // 如: "ABCD1234"

// 2. 连接云端服务
const ws = new WebSocket('wss://cloud-server:8765');

// 3. 注册配对码
ws.send(JSON.stringify({
  type: 'register',
  pairing_code: pairingCode,
  device_type: 'app'
}));

// 4. Nanobot 端输入配对码后，双方建立连接
```

**核心代码**: [NanobotBridge.ts](src/services/NanobotBridge.ts)

---

### 2.3 🌟 流式 AI 对话

实现类似 ChatGPT 的流式响应体验。

**实现原理**:

```typescript
// WebSocketContext.tsx
interface StreamData {
  type: 'stream';
  delta: string;      // 增量文本
  is_final: boolean;  // 是否结束
}

// 处理流式数据
case 'stream': {
  const streamData = message as StreamData;

  // 增量更新消息内容
  setMessages(prev => {
    const lastMessage = prev[prev.length - 1];
    if (lastMessage?.isStreaming) {
      // 追加新内容
      lastMessage.content += streamData.delta;
      lastMessage.isStreaming = !streamData.is_final;
    }
    return [...prev];
  });

  // 滚动到底部
  scrollToBottom();
  break;
}
```

**效果**:
- 文字逐字显示
- 实时渲染 Markdown
- 流畅的打字机效果

---

### 2.4 🌟 实时数据库订阅

利用 Supabase Realtime 实现多端数据同步。

**核心实现**:

```typescript
// databaseService.ts

// 订阅聊天消息
export function subscribeToChatMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): () => void {
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
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  // 返回清理函数
  return () => {
    supabase.removeChannel(channel);
  };
}

// 订阅未读计数
export function subscribeToUnreadCounts(
  userId: string,
  onUpdate: (counts: UnreadCount[]) => void
): () => void {
  // ... 类似实现
}
```

**优势**:
- 无需轮询，实时推送
- 自动处理断线重连
- 支持过滤和条件订阅

---

### 2.5 🌟 指数退避重连机制

WebSocket 断线后智能重连。

**实现**:

```typescript
// WebSocketContext.tsx

const RECONNECT_INITIAL_DELAY_MS = 2000;   // 初始延迟 2s
const RECONNECT_MAX_DELAY_MS = 30000;      // 最大延迟 30s
const RECONNECT_BACKOFF_FACTOR = 1.5;      // 退避因子
const MAX_RECONNECT_ATTEMPTS = 10;         // 最大重试次数

const connect = useCallback(() => {
  const socket = new WebSocket(url);

  socket.onclose = () => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // 计算退避延迟: 2s → 3s → 4.5s → 6.75s → ...
      const delay = Math.min(
        RECONNECT_INITIAL_DELAY_MS *
          Math.pow(RECONNECT_BACKOFF_FACTOR, reconnectAttempts),
        RECONNECT_MAX_DELAY_MS
      );

      setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        connect();
      }, delay);
    }
  };
}, []);
```

**学习要点**:
- 指数退避避免服务器压力
- 最大延迟上限防止等待过久
- 最大重试次数限制

---

### 2.6 🌟 浏览器端 HMAC 签名

无需后端，前端直接生成 OSS 上传签名。

**实现**:

```typescript
// OSSService.ts

import { crypto } from 'crypto';

class OSSService {
  // HMAC-SHA1 签名（浏览器兼容）
  private async generateSignature(
    stringToSign: string,
    accessKeySecret: string
  ): Promise<string> {
    const encoder = new TextEncoder();

    // 导入密钥
    const keyData = encoder.encode(accessKeySecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    // 生成签名
    const messageData = encoder.encode(stringToSign);
    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Base64 编码
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  async uploadFile(file: File, filename: string): Promise<string> {
    const objectName = `uploads/${Date.now()}_${filename}`;
    const date = new Date().toUTCString();

    // 构造签名字符串
    const stringToSign = `PUT\n\n${file.type}\n${date}\n/${bucket}/${objectName}`;

    // 生成签名
    const signature = await this.generateSignature(stringToSign, accessKeySecret);
    const authorization = `OSS ${accessKeyId}:${signature}`;

    // 上传文件
    const response = await fetch(
      `https://${bucket}.${endpoint}/${objectName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': authorization,
          'Content-Type': file.type,
          'Date': date
        },
        body: file
      }
    );

    return response.ok ? objectName : null;
  }
}
```

**⚠️ 注意**: 虽然技术上有亮点，但生产环境不建议在前端暴露 AccessKeySecret。

---

### 2.7 🌟 自定义 Hooks 封装

复用复杂逻辑，保持组件简洁。

#### useCamera - 相机功能

```typescript
// hooks/useCamera.ts

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  startCamera: (facing?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  takePhoto: () => Promise<Blob | null>;
  switchCamera: () => void;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (facing = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('无法访问相机:', error);
    }
  }, [facingMode]);

  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !isStreaming) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }, [isStreaming]);

  const switchCamera = useCallback(() => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    stopCamera();
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  return {
    videoRef,
    isStreaming,
    startCamera,
    stopCamera,
    takePhoto,
    switchCamera
  };
}
```

#### useSpeechToText - 语音识别

```typescript
// hooks/useSpeechToText.ts

interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechToText(
  language = 'zh-CN',
  continuous = false
): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (const result of event.results) {
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [language, continuous]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript: () => setTranscript('')
  };
}
```

---

### 2.8 🌟 响应式图片压缩

上传前压缩图片，减少带宽和存储。

```typescript
// uploadService.ts

import imageCompression from 'browser-image-compression';

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

async function uploadWithCompression(file: File): Promise<string> {
  // 1. 压缩图片
  const compressedFile = await compressImage(file, 1, 1920);

  // 2. 生成缩略图
  const thumbnail = await generateThumbnail(compressedFile, 200, 200);

  // 3. 提取元数据
  const metadata = await extractMetadata(compressedFile);

  // 4. 上传原图和缩略图
  const originalPath = await uploadToStorage(compressedFile);
  const thumbnailPath = await uploadToStorage(thumbnail, 'thumbnails');

  return { originalPath, thumbnailPath, metadata };
}
```

---

## 3. 架构设计模式

### 3.1 分层架构

```
┌────────────────────────────────────────────────────┐
│                    表现层                          │
│              Screens / Components                  │
│     Home | Chat | Study | GlassDock               │
├────────────────────────────────────────────────────┤
│                    状态层                          │
│                  Context API                       │
│   Auth | WebSocket | Nanobot | Pairing            │
├────────────────────────────────────────────────────┤
│                    业务层                          │
│                  Services                          │
│   database | upload | pairing | bridge            │
├────────────────────────────────────────────────────┤
│                    数据层                          │
│              API / Storage                         │
│   Supabase | OSS | WebSocket | localStorage       │
└────────────────────────────────────────────────────┘
```

### 3.2 Context + Hooks 模式

```typescript
// 定义 Context
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// 定义 Provider
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);

  // 连接逻辑
  const connect = useCallback(() => { /* ... */ }, []);

  // 发送消息
  const sendMessage = useCallback((data: any) => { /* ... */ }, []);

  return (
    <WebSocketContext.Provider value={{ status, connect, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// 定义 Hook
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}

// 使用
function ChatComponent() {
  const { status, sendMessage } = useWebSocket();

  // ...
}
```

### 3.3 服务单例模式

```typescript
// databaseService.ts

// 导出单例函数，无需实例化
export async function getFriends(): Promise<Friend[]> {
  // ...
}

export async function sendMessage(message: Message): Promise<void> {
  // ...
}

// 使用时直接调用
import { getFriends, sendMessage } from '@/services/databaseService';

const friends = await getFriends();
```

---

## 4. 关键技术实现

### 4.1 路由守卫

保护需要认证的路由。

```typescript
// App.tsx

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    // 保存当前路径，登录后重定向
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// 使用
<Route
  path="/chat"
  element={
    <ProtectedRoute>
      <Chat />
    </ProtectedRoute>
  }
/>
```

### 4.2 消息列表虚拟化 (待优化)

处理大量消息时的性能优化思路：

```typescript
// 使用 react-window 或类似库
import { FixedSizeList } from 'react-window';

function MessageList({ messages }: { messages: Message[] }) {
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => (
    <div style={style}>
      <MessageBubble message={messages[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={messages.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 4.3 防抖与节流

```typescript
// 搜索输入防抖
import { useMemo, useCallback } from 'react';
import { debounce } from 'lodash';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// 使用
function ChatList() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    // 仅在 debouncedQuery 变化时搜索
    searchFriends(debouncedQuery);
  }, [debouncedQuery]);
}
```

---

## 5. 性能优化策略

### 5.1 代码分割

```typescript
// vite.config.ts

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

### 5.2 图片懒加载

```tsx
// MediaMessage.tsx

<img
  src={uri}
  alt={alt}
  loading="lazy"  // 原生懒加载
  decoding="async"
  onLoad={() => setImageLoaded(true)}
/>
```

### 5.3 动画性能优化

```tsx
// 使用 transform 和 opacity（GPU 加速）
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  // 避免: width, height, margin 等触发重排的属性
/>
```

---

## 6. 学习要点总结

### 6.1 必学知识点

| 类别 | 知识点 | 文件参考 |
|------|--------|---------|
| **React Hooks** | useState, useEffect, useCallback, useRef, Context | 所有组件 |
| **状态管理** | Context API, 状态提升, reducer 模式 | `contexts/` |
| **WebSocket** | 连接管理, 心跳, 重连, 消息协议 | `WebSocketContext.tsx` |
| **实时数据** | Supabase Realtime, 订阅模式 | `databaseService.ts` |
| **文件上传** | FormData, Blob, 压缩, 签名 | `OSSService.ts` |
| **路由** | 声明式路由, 路由守卫, 编程式导航 | `App.tsx` |
| **动画** | Framer Motion 声明式动画 | `components/` |
| **TypeScript** | 接口, 泛型, 类型推断, 类型守卫 | `types/` |

### 6.2 推荐学习路径

```
第一阶段：基础
  ├── React 函数组件与 Hooks
  ├── TypeScript 基础类型
  └── Vite 项目结构

第二阶段：核心功能
  ├── Context API 状态管理
  ├── React Router 路由
  └── Supabase 集成

第三阶段：进阶
  ├── WebSocket 实时通信
  ├── 文件上传与处理
  └── 动画实现

第四阶段：架构
  ├── 分层架构设计
  ├── 服务抽象
  └── 性能优化
```

### 6.3 关键文件学习顺序

1. **入口理解**: `src/index.tsx` → `src/App.tsx`
2. **状态管理**: `src/contexts/AuthContext.tsx`
3. **数据操作**: `src/services/databaseService.ts`
4. **实时通信**: `src/contexts/WebSocketContext.tsx`
5. **复杂页面**: `src/screens/ChatDetail.tsx`
6. **自定义 Hook**: `src/hooks/useCamera.ts`

---

## 附录：技术选型理由

| 技术 | 选型理由 |
|------|---------|
| **Vite** | 开发启动快，HMR 性能好，配置简单 |
| **Supabase** | 开源 Firebase 替代，PostgreSQL 强大，实时功能内置 |
| **Framer Motion** | 声明式 API，性能优秀，与 React 无缝集成 |
| **Tailwind** | 原子化 CSS，快速开发，无需维护 CSS 文件 |
| **TypeScript** | 类型安全，IDE 支持好，减少运行时错误 |

---

*文档更新时间: 2026-02-14*

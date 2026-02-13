# TRIX 3D Companion - 项目总结

> **项目名称**: TRIX 3D Companion  
> **项目类型**: 移动端 AI 伴侣应用  
> **核心理念**: Zero UI 设计 - 沉浸式 AI 交互体验  
> **最后更新**: 2026-02-12

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [项目结构](#项目结构)
4. [核心功能模块](#核心功能模块)
5. [Clawbot 连接系统详解](#clawbot-连接系统详解)
6. [数据结构详解](#数据结构详解)
7. [环境配置](#环境配置)

---

## 项目概述

TRIX 3D Companion 是一款面向移动端的 AI 伴侣应用，采用 **Zero UI** 设计理念，通过 3D 角色展示、AI 对话、社交功能、学习计时器等模块，提供沉浸式的用户体验。

### 核心特性

| 特性 | 描述 |
|------|------|
| 🎭 **Zero UI 设计** | 首页仅展示全屏 3D 角色，点击后显示功能面板 |
| 🤖 **AI 对话** | 通过 WebSocket 连接本地 Clawbot Gateway，实现流式 AI 响应 |
| 👥 **社交功能** | 好友聊天、实时消息、未读提醒 |
| ⏱️ **学习计时** | 番茄钟学习工具，支持状态同步和虚拟自习室 |
| 📍 **实时位置** | 基于 Leaflet 的地图共享 |
| 🗣️ **语音交互** | 集成 Web Speech API 语音识别 |
| 📱 **扫码配对** | 手机端与电脑端 Gateway 通过二维码配对 |

### 技术栈

```
Frontend:  React 19.2.4 + TypeScript 5.8.2
Build:     Vite 6.2.0
Database:  Supabase (PostgreSQL)
Realtime:  Supabase Realtime + WebSocket
Maps:      Leaflet 1.9.4
Animation: Framer Motion 12.33.0
State:     React Context + Hooks
```

---

## 技术架构

### 系统整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIX 3D Mobile App                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  React Frontend (Vite)                                        │ │
│  │  ├── AuthContext (Supabase 认证)                              │ │
│  │  ├── WebSocketContext (Clawbot 连接)                          │ │
│  │  ├── QRCodePairingContext (配对管理)                          │ │
│  │  ├── Components (UI 组件)                                     │ │
│  │  └── Services (业务逻辑)                                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ Supabase    │    │ Clawbot      │    │ Supabase     │         │
│  │ Realtime    │    │ Gateway      │    │ Storage      │         │
│  │ (好友状态)  │    │ (AI 对话)    │    │ (文件上传)   │         │
│  └─────────────┘    └──────────────┘    └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                    Clawbot Gateway (本地部署)                       │
│  - WebSocket Server (Port 18789)                                   │
│  - 认证机制 (Token)                                                │
│  - 流式响应 (Delta Streaming)                                      │
│  - AI Agent 代理                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
e:\desktop\trix-3d-companion/
├── src/
│   ├── clawbot/                    # Clawbot 集成模块入口
│   │   └── index.ts               # 统一导出所有 Clawbot 功能
│   │
│   ├── components/                 # UI 组件
│   │   ├── GlassDock.tsx          # 底部导航栏（毛玻璃效果）
│   │   ├── HeroBackground.tsx     # 首页全屏背景
│   │   ├── GlassPanel.tsx         # 毛玻璃面板
│   │   ├── QRScanner.tsx          # 二维码扫描组件
│   │   └── ...
│   │
│   ├── screens/                    # 页面组件
│   │   ├── Home.tsx               # 首页（3D 角色展示）
│   │   ├── Chat.tsx               # 聊天列表
│   │   ├── ChatDetail.tsx         # 聊天详情（支持 Bot/好友）
│   │   ├── Study.tsx              # 学习计时器
│   │   ├── QRCodePairing.tsx      # 二维码配对页面
│   │   └── ...
│   │
│   ├── contexts/                   # React Context
│   │   ├── AuthContext.tsx        # 认证状态管理
│   │   ├── WebSocketContext.tsx   # WebSocket 连接管理
│   │   └── QRCodePairingContext.tsx # 配对状态管理
│   │
│   ├── services/                   # 业务服务
│   │   ├── clawbotPairingService.ts # 配对服务
│   │   ├── databaseService.ts     # 数据库操作
│   │   └── uploadService.ts       # 文件上传
│   │
│   ├── types/                      # TypeScript 类型定义
│   │   ├── clawbot.ts             # Clawbot 相关类型
│   │   └── ...
│   │
│   ├── config/                     # 配置文件
│   │   ├── supabase.ts            # Supabase 客户端配置
│   │   └── metadata.json          # 项目元数据
│   │
│   └── database/                   # 数据库脚本
│       ├── init.sql               # 数据库初始化
│       └── SCHEMA.md              # 架构文档
│
├── database/                       # 数据库迁移脚本
│   ├── add-pairing-requests-table.sql  # 配对请求表
│   └── ...
│
├── docs/                          # 项目文档
│   ├── CLAWBOT_GATEWAY_INTEGRATION.md
│   ├── CLAWBOT_INTEGRATION_GUIDE.md
│   ├── CLAWBOT_QUICK_START.md
│   └── ...
│
├── .env                           # 环境变量配置
├── .env.example                   # 环境变量模板
├── vite.config.ts                 # Vite 配置
└── package.json                   # 项目依赖
```

---

## 核心功能模块

### 1. 认证系统 (AuthContext)

基于 Supabase Auth 实现用户注册、登录、登出功能。

### 2. WebSocket 连接系统 (WebSocketContext)

管理与 Clawbot Gateway 的长连接，支持：
- 自动重连（最多 5 次）
- 心跳保活（30 秒间隔）
- 流式消息接收
- 多媒体消息发送

### 3. 配对系统 (QRCodePairingContext)

实现手机端与电脑端 Gateway 的扫码配对功能。

### 4. 数据库服务 (databaseService)

封装所有 Supabase 数据库操作，包括好友管理、聊天记录、通知等。

---

## Clawbot 连接系统详解

这是项目的核心功能模块，实现手机 App 与本地 Clawbot Gateway 的连接。

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Clawbot 连接架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │  QRCodePairing  │─────▶│   ClawbotPairingService     │  │
│  │    Context      │      │                             │  │
│  │                 │      │  - 生成配对请求              │  │
│  │  管理配对状态    │      │  - 生成二维码内容            │  │
│  │  提供配对方法    │      │  - 轮询配对状态              │  │
│  └─────────────────┘      │  - 取消/重置配对             │  │
│           │               └─────────────────────────────┘  │
│           │                           │                     │
│           │                           ▼                     │
│           │               ┌─────────────────────────────┐  │
│           │               │       Supabase DB           │  │
│           │               │   (pairing_requests 表)      │  │
│           │               └─────────────────────────────┘  │
│           │                           ▲                     │
│           │                           │                     │
│           ▼                           │                     │
│  ┌─────────────────┐                  │                     │
│  │  WebSocket      │                  │                     │
│  │   Context       │──────────────────┘                     │
│  │                 │      使用 device_token                 │
│  │  管理长连接      │      建立 WebSocket 连接               │
│  │  收发消息        │                                       │
│  └─────────────────┘                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 连接流程

#### 方式一：直接 WebSocket 连接（当前主要使用）

```
┌───────────┐                              ┌──────────────┐
│  Mobile   │                              │   Clawbot    │
│    App    │                              │   Gateway    │
└─────┬─────┘                              └──────┬───────┘
      │                                           │
      │  1. 读取环境变量配置                         │
      │     VITE_PC_WEBSOCKET_URL                   │
      │     VITE_PC_AUTH_TOKEN                      │
      │                                           │
      │  2. 创建 WebSocket 连接                     │
      │ ─────────────────────────────────────────>│
      │                                           │
      │  3. 接收连接挑战 (connect.challenge)        │
      │ <─────────────────────────────────────────│
      │                                           │
      │  4. 发送认证响应                             │
      │     { type: 'req', method: 'connect', ...} │
      │ ─────────────────────────────────────────>│
      │                                           │
      │  5. 连接成功 (hello-ok)                     │
      │ <─────────────────────────────────────────│
      │                                           │
      │  6. WebSocket 连接已建立 ✅                  │
      │  开始收发消息                               │
      │ ◄───────────────────────────────────────► │
```

#### 方式二：扫码配对流程（推荐用于多设备）

```
┌─────────────────────┐                    ┌─────────────────────┐
│  电脑端 (Gateway)   │                    │  手机端 (TRIX App)  │
└─────────────────────┘                    └─────────────────────┘
         │                                           │
         │  1. 启动 Gateway                         │
         │  2. 进入配对模式                         │
         │  3. 生成二维码 + 配对码                  │
         │     [QR Code]                             │
         │                                           │
         │                    ←───────────────────── │  4. 打开配对页面
         │                                           │  5. 扫描二维码
         │                                           │     或手动输入配对码
         │                                           │
         │                    ←───────────────────── │  6. 发送配对请求
         │                                           │     (存入 Supabase)
         │  7. 收到配对请求                         │
         │  8. 显示审批界面                         │
         │     [允许] [拒绝]                         │
         │                                           │
         │  9. 点击 [允许]                          │
         │  10. 生成 device_token                    │
         │  11. 写入 Supabase                        │
         │                                           │
         │                    ────────────────────→  │  12. 轮询检测到审批
         │                                           │  13. 获得 device_token
         │                                           │  14. 保存 token
         │                                           │  15. 建立 WebSocket
         │                                           │  16. ✅ 配对成功!
         │  ←─────────────────────────────────────→  │
         │        WebSocket 连接已建立               │
         └───────────────────────────────────────────┘
```

### 核心代码解析

#### 1. WebSocketContext - 连接管理

```typescript
// 核心状态
interface WebSocketContextValue {
  status: ConnectionStatus;        // DISCONNECTED | CONNECTING | CONNECTED | ERROR | RECONNECTING
  isConnected: boolean;            // 是否已连接
  fullResponse: string;            // Bot 完整响应（流式）
  currentStreamId: string | null;  // 当前流 ID
  lastError: string | null;        // 最后错误信息
  reconnectCount: number;          // 重连次数
  
  // 方法
  connect: () => void;             // 建立连接
  disconnect: () => void;          // 断开连接
  sendMessage: (text: string, media?: MediaInfo) => void;  // 发送消息
}
```

**连接流程：**

1. **初始化连接**
   ```typescript
   const WS_URL = isMobile
     ? import.meta.env.VITE_PC_WEBSOCKET_URL_MOBILE
     : import.meta.env.VITE_PC_WEBSOCKET_URL;
   const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN;
   ```

2. **处理连接挑战**
   ```typescript
   const handleConnectChallenge = (socket, data) => {
     const challengeResponse: ConnectRequest = {
       type: "req",
       id: data.payload?.nonce,
       method: "connect",
       params: {
         minProtocol: 3,
         maxProtocol: 3,
         role: "operator",
         client: {
           id: "clawdbot-ios",
           mode: "webchat",
           platform: isMobile ? "ios" : "web",
           displayName: "TRIX App",
           version: "1.0.0",
           instanceId: Math.random().toString(36),
         },
         caps: [],
         auth: { token: AUTH_TOKEN },
       },
     };
     socket.send(JSON.stringify(challengeResponse));
   };
   ```

3. **自动重连机制**
   ```typescript
   // 连接关闭时自动重连
   socket.onclose = (event) => {
     if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
       reconnectAttemptsRef.current++;
       setStatus("RECONNECTING");
       
       reconnectTimeoutRef.current = setTimeout(() => {
         connect();
       }, RECONNECT_DELAY_MS);  // 3 秒后重连
     }
   };
   ```

4. **心跳保活**
   ```typescript
   const sendHeartbeat = () => {
     if (wsRef.current?.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({ 
         type: "ping", 
         timestamp: Date.now() 
       }));
     }
   };
   
   // 每 30 秒发送一次心跳
   setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
   ```

5. **流式响应处理**
   ```typescript
   const handleStreamResponse = (data: WebSocketResponse) => {
     if (data.payload?.stream === "assistant" && data.payload.data?.delta) {
       // 追加增量数据
       responseBufferRef.current += data.payload.data.delta;
       setFullResponse(responseBufferRef.current);
     }
     
     // 流结束
     if (data.payload.data?.done) {
       currentStreamIdRef.current = null;
       setCurrentStreamId(null);
     }
   };
   ```

#### 2. ClawbotPairingService - 配对服务

```typescript
class ClawbotPairingService {
  // 生成配对请求
  async generatePairingRequest(deviceName?: string): Promise<PairingRequest> {
    const requestId = this.generateRequestId();
    const deviceId = this.getOrCreateDeviceId();
    
    const request: PairingRequest = {
      requestId,
      deviceName: deviceName || `TRIX-${navigator.platform}`,
      deviceType: 'mobile',
      timestamp: Date.now(),
      status: 'pending',
      deviceId,
      metadata: {
        deviceName,
        deviceType: 'mobile',
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      },
    };
    
    // 存储到 Supabase
    await supabase.from('pairing_requests').insert([{
      id: requestId,
      device_id: deviceId,
      device_name: request.deviceName,
      device_type: 'mobile',
      status: 'pending',
      expires_at: new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
    }]);
    
    return request;
  }
  
  // 获取二维码内容
  getQRCodeContent(requestId: string): string {
    const qrData: QRCodeData = {
      gatewayUrl: this.gatewayUrl,
      pairingToken: this.authToken,
      requestId,
      expiresAt: new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
    };
    return JSON.stringify(qrData);
  }
  
  // 轮询配对状态
  async pollPairingStatus(
    requestId: string,
    onStatusChange: (response: PairingResponse) => void
  ): Promise<void> {
    // 每 2 秒查询一次，最多 180 次（6 分钟）
    this.pollingTimer = setInterval(async () => {
      const { data } = await supabase
        .from('pairing_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      switch (data.status) {
        case 'approved':
          // 保存 device_token
          localStorage.setItem('clawbot_device_token', data.device_token);
          onStatusChange({ status: 'approved', deviceToken: data.device_token });
          break;
        case 'denied':
        case 'cancelled':
        case 'expired':
          onStatusChange({ status: data.status });
          break;
        // pending: 继续轮询
      }
    }, this.pollInterval);
  }
}
```

#### 3. QRCodePairingContext - 配对状态管理

```typescript
interface QRCodePairingContextType {
  // 状态
  isPairing: boolean;              // 是否正在配对
  pairingRequest: PairingRequest | null;
  pairingStatus: PairingResponse['status'] | null;
  deviceToken: string | null;      // 配对成功后的设备 Token
  errorMessage: string | null;
  qrCodeContent: string | null;    // 二维码内容
  
  // 操作
  startPairing: (deviceName?: string) => Promise<void>;
  cancelPairing: () => Promise<void>;
  resetPairing: () => void;
}
```

### 类型定义

```typescript
// 配对状态
export type PairingStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

// 连接状态
export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTH_FAILED' | 'ERROR' | 'RECONNECTING';

// WebSocket 消息类型
export type WebSocketMessageType = 
  | 'ping' | 'pong'           // 心跳
  | 'pairing.request'         // 配对请求
  | 'pairing.confirm'         // 配对确认
  | 'pairing.success'         // 配对成功
  | 'message' | 'command'     // 普通消息/命令
  | 'error';                  // 错误

// 配对请求
export interface PairingRequest {
  requestId: string;
  deviceName: string;
  deviceType: DeviceType;
  timestamp: number;
  status: PairingStatus;
  deviceId?: string;
  metadata?: PairingMetadata;
}

// 配对响应
export interface PairingResponse {
  requestId: string;
  status: PairingStatus;
  deviceToken?: string;
  nodeId?: string;
  message?: string;
}

// WebSocket 连接参数
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  role: 'operator' | 'node' | 'gateway';
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
    instanceId: string;
  };
  caps: string[];
  auth?: { token: string };
}
```

### 配置常量

```typescript
// 配对超时时间（毫秒）
export const PAIRING_TIMEOUT_MS = 5 * 60 * 1000;        // 5 分钟

// 配对确认超时时间（毫秒）
export const PAIRING_CONFIRM_TIMEOUT_MS = 2 * 60 * 1000; // 2 分钟

// Token 有效期（毫秒）
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;     // 24 小时

// 心跳间隔（毫秒）
export const HEARTBEAT_INTERVAL_MS = 30 * 1000;         // 30 秒

// 重连延迟（毫秒）
export const RECONNECT_DELAY_MS = 3 * 1000;             // 3 秒

// 最大重连次数
export const MAX_RECONNECT_ATTEMPTS = 5;
```

---

## 数据结构详解

### 数据库表结构

项目使用 **Supabase (PostgreSQL)** 作为数据库，共包含 **10 个核心表**：

#### 1. 用户表 (users)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. 好友表 (friends)

```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT UNIQUE NOT NULL,      -- 好友唯一标识
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'away')),
  bio TEXT,
  study_time INTEGER DEFAULT 0,        -- 学习时长（分钟）
  is_studying BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**特别说明**: `clawbot` 是一个特殊的好友 ID，代表 TRIX AI 机器人。

#### 3. 聊天记录表 (chat_messages)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friend_id TEXT NOT NULL,             -- 对应好友的 friend_id
  sender TEXT NOT NULL CHECK (sender IN ('user', 'friend', 'bot')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. 未读消息计数表 (unread_counts)

```sql
CREATE TABLE unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

#### 5. 通知表 (notifications)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'friend_request', 'study', 'achievement')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  avatar_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. 邮件表 (mails)

```sql
CREATE TABLE mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_avatar TEXT,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. 学习记录表 (study_sessions)

```sql
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  duration INTEGER NOT NULL,           -- 学习时长（分钟）
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8. 自习室表 (study_rooms)

```sql
CREATE TABLE study_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9. 自习室成员表 (study_room_members)

```sql
CREATE TABLE study_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, friend_id)
);
```

#### 10. 配对请求表 (pairing_requests) ⭐ Clawbot 专用

```sql
CREATE TABLE pairing_requests (
  id TEXT PRIMARY KEY,                 -- 请求 ID（客户端生成）
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'desktop')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  device_token TEXT,                   -- 审批通过后由 Gateway 填写
  approved_at TIMESTAMP,
  approved_by TEXT,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- 索引
CREATE INDEX idx_pairing_requests_status ON pairing_requests(status);
CREATE INDEX idx_pairing_requests_device_id ON pairing_requests(device_id);
CREATE INDEX idx_pairing_requests_created_at ON pairing_requests(created_at);
```

### 表关系图

```
┌─────────────────┐
│     users       │  (用户表)
│  - id (PK)      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────┐
│  friends │  chat_messages │  notifications │  mails         │
│  study_sessions │  study_rooms │  pairing_requests          │
└─────────────────────────────────────────────────────────────┘
```

### 存储过程和函数

#### 1. 发送消息并更新未读计数

```sql
CREATE OR REPLACE FUNCTION send_message(
  p_friend_id TEXT,
  p_sender TEXT,
  p_text TEXT
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- 插入消息
  INSERT INTO chat_messages (friend_id, sender, text)
  VALUES (p_friend_id, p_sender, p_text)
  RETURNING id INTO v_message_id;
  
  -- 更新未读计数
  IF p_sender = 'friend' OR p_sender = 'bot' THEN
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 1, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      unread_count = unread_counts.unread_count + 1,
      last_message = p_text,
      last_message_time = NOW();
  ELSE
    -- 用户发送的消息，只更新最后消息，不增加未读
    INSERT INTO unread_counts (user_id, friend_id, unread_count, last_message, last_message_time)
    VALUES ('00000000-0000-0000-0000-000000000001', p_friend_id, 0, p_text, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      last_message = p_text,
      last_message_time = NOW();
  END IF;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;
```

#### 2. 标记消息已读

```sql
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id UUID,
  p_friend_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE unread_counts
  SET unread_count = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql;
```

### 视图

#### 好友最新消息视图

```sql
CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT 
  f.friend_id,
  f.name,
  f.avatar_url,
  f.status,
  f.bio,
  f.study_time,
  f.is_studying,
  uc.unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN unread_counts uc ON f.friend_id = uc.friend_id
ORDER BY uc.last_message_time DESC NULLS LAST;
```

---

## 环境配置

### 环境变量 (.env)

```env
# ============================================
# Supabase 数据库配置
# ============================================
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# Clawbot Gateway 配置
# ============================================
# Gateway WebSocket URL (本地/局域网)
VITE_PC_WEBSOCKET_URL=ws://192.168.1.100:18789

# 移动端访问 URL (同一局域网)
VITE_PC_WEBSOCKET_URL_MOBILE=ws://192.168.1.100:18789

# Gateway 认证 Token (与 Gateway 配置一致)
VITE_PC_AUTH_TOKEN=your-secure-auth-token

# 配对功能配置
VITE_CLAWBOT_GATEWAY_URL=ws://192.168.1.100:18789
VITE_CLAWBOT_GATEWAY_TOKEN=your-secure-auth-token

# ============================================
# Supabase Storage (文件上传)
# ============================================
VITE_SUPABASE_STORAGE_PATH=trix-uploads

# ============================================
# 开发配置
# ============================================
VITE_DEBUG=true
```

### Clawbot Gateway 配置

`~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "your-secure-token-here"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true,
      "pairing": {
        "enabled": true,
        "approvalMode": "manual",
        "qrCodeEnabled": true,
        "supabaseUrl": "https://your-project.supabase.co",
        "supabaseKey": "your-supabase-anon-key"
      }
    }
  }
}
```

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目概览和快速开始 |
| [QR_PAIRING_IMPLEMENTATION.md](./QR_PAIRING_IMPLEMENTATION.md) | 扫码配对功能实现细节 |
| [QR_PAIRING_USER_GUIDE.md](./QR_PAIRING_USER_GUIDE.md) | 扫码配对用户使用指南 |
| [docs/CLAWBOT_GATEWAY_INTEGRATION.md](./docs/CLAWBOT_GATEWAY_INTEGRATION.md) | Clawbot Gateway 集成指南 |
| [docs/CLAWBOT_QUICK_START.md](./docs/CLAWBOT_QUICK_START.md) | 快速开始指南 |
| [docs/CLAWBOT_SIMPLE_IMPLEMENTATION.md](./docs/CLAWBOT_SIMPLE_IMPLEMENTATION.md) | 简化版实现 |
| [docs/CLAWBOT_INTEGRATION_GUIDE.md](./docs/CLAWBOT_INTEGRATION_GUIDE.md) | 完整实现方案 |
| [src/database/SCHEMA.md](./src/database/SCHEMA.md) | 数据库架构详细文档 |

---

## 总结

TRIX 3D Companion 是一个功能完整的移动端 AI 伴侣应用，核心亮点包括：

1. **创新的 Zero UI 设计** - 全屏 3D 角色展示，沉浸式交互
2. **完整的 Clawbot 集成** - 支持直接连接和扫码配对两种方式
3. **丰富的社交功能** - 好友系统、聊天、通知、邮件
4. **学习辅助工具** - 番茄钟、自习室、学习记录
5. **实时数据同步** - Supabase Realtime 实现即时更新

**Clawbot 连接系统** 是项目的技术核心，通过 WebSocket 协议实现手机端与本地 Gateway 的低延迟通信，支持流式 AI 响应和多媒体消息传输。

# TRIX Native OpenClaw Channel - 完整实施计划

> 项目目标: 构建完整的 TRIX Native Channel，使任何安装了 OpenClaw 的用户可通过一行命令快速连接，支持完整多模态消息收发
> 版本: 1.0 | 更新: 2024-03-14

---

## 1. 系统架构总览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              TRIX Native 生态系统                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                    1. TRIX Native Server (TRIX_SERVER_HOST:8788)             │  │
│  │  ────────────────────────────────────────────────────────────────────────  │  │
│  │                                                                              │  │
│  │  HTTP API:                                                                   │  │
│  │    POST /api/pairings              → 生成6位配对码                          │  │
│  │    GET  /api/pairings/:code       → 查询配对状态                            │  │
│  │    POST /api/pairings/:code/claim → 手机确认配对                            │  │
│  │    POST /api/upload               → 上传文件(图片/语音/视频)                │  │
│  │    POST /api/messages/from-plugin → Plugin发送消息到手机                    │  │
│  │    GET  /api/messages/to-plugin   → Plugin拉取手机消息(轮询)               │  │
│  │                                                                              │  │
│  │  WebSocket:                                                                   │  │
│  │    /ws/phone?code=XXX          → 手机连接,实时接收消息                     │  │
│  │    /ws/plugin?token=XXX       → Plugin连接,实时推送(可选)                 │  │
│  │                                                                              │  │
│  │  文件存储: /attachments (Nginx静态服务)                                       │  │
│  │                                                                              │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                    ↑                                              │
│                                    │ HTTP+WS (Auth: X-Plugin-Token)               │
│                                    ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                    2. TRIX Native Channel Plugin                            │  │
│  │                    (@trix-app/trix-native)                                  │  │
│  │  ────────────────────────────────────────────────────────────────────────  │  │
│  │                                                                              │  │
│  │  安装: openclaw plugins install @trix-app/trix-native                        │  │
│  │                                                                              │  │
│  │  配置 (~/.openclaw/config.json):                                             │  │
│  │  { "channels": { "trixNative": { "enabled": true, "accounts": {            │  │
│  │    "default": { "name": "TRIX Native", "serverUrl": "http://TRIX_SERVER_HOST" }│  │
│  │  } } } }                                                                    │  │
│  │                                                                              │  │
│  │  核心功能:                                                                   │  │
│  │    login()   → 生成keypair→请求配对码→显示QR→轮询确认                       │  │
│  │    resume()  → 读取凭证→验证→重建连接                                      │  │
│  │    outbound()→ Agent发消息→上传附件→POST到服务器→推手机                    │  │
│  │    inbound() → 拉取手机消息→注入OpenClaw                                   │  │
│  │                                                                              │  │
│  │  守护进程: 断线自动重连(指数退避), 心跳保活, 离线消息队列                    │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                    ↑                                              │
│                                    │ Channel Plugin API (inbound/outbound)        │
│                                    ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                         OpenClaw Gateway / Agent                           │  │
│  │  ────────────────────────────────────────────────────────────────────────  │  │
│  │  多模态处理:                                                                │  │
│  │    收到图片URL → Vision模型分析                                             │  │
│  │    收到语音URL → Whisper转文字 → 理解 → 回复                               │  │
│  │    发送图片 → 生成/获取图片URL → 通过Plugin发送                            │  │
│  │                                                                              │  │
│  │  对话示例:                                                                  │  │
│  │    用户: [图片] "这是什么?"                                                 │  │
│  │    Agent: "这是一只橘猫" + [图片: 分析结果]                                 │  │
│  │    用户: [语音] "今天天气?"                                                 │  │
│  │    Agent: [语音] "北京晴天25度"                                            │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │ HTTP / WebSocket
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              手机端 (iOS / Web)                                    │
│  ───────────────────────────────────────────────────────────────────────────────  │
│  配对: 扫码/输入6位配对码 → 确认 → 连接成功                                       │
│  消息: 文字/图片/语音/视频/文件                                                    │
│  特性: 离线消息同步, 已读回执, 多端同步                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流向

```
手机 → OpenClaw:
1. 手机拍照/选择文件 → POST /api/upload → 服务器返回URL
2. 手机WebSocket发送: { text, attachments: [{url, type, mimeType}] }
3. 服务器存入消息队列
4. Plugin轮询 GET /api/messages/to-plugin
5. Plugin调用inbound()注入OpenClaw
6. Agent处理消息

OpenClaw → 手机:
1. Agent发送消息: { text, attachments: [...] }
2. Plugin的outbound()调用
3. 如有附件,先POST /api/upload上传,得到公网URL
4. Plugin POST /api/messages/from-plugin
5. 服务器通过WebSocket推送给手机
6. 手机显示消息+附件
```

---

## 2. 技术栈选型

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 服务器运行时 | Node.js 20 LTS | 与现有项目统一,生态成熟 |
| Web框架 | Express 5 | 轻量,灵活,中间件丰富 |
| 实时通信 | Socket.IO 4 | 自动重连,房间管理,跨浏览器 |
| 数据库 | Redis (消息队列) + PostgreSQL (持久化) | Redis高性能队列,PG可靠存储 |
| 文件存储 | 本地磁盘 + Nginx | 简单可靠,配合CDN |
| Plugin开发 | TypeScript 5.8 | 类型安全,OpenClaw SDK兼容 |
| iOS开发 | SwiftUI + Combine | 与现有项目统一 |
| 部署 | Docker + PM2 | 容器化,进程管理 |

---

## 3. 项目结构

```
trix-native/
├── packages/
│   ├── trix-native-server/           # Node.js服务器
│   │   ├── src/
│   │   │   ├── index.ts              # 入口
│   │   │   ├── app.ts               # Express应用
│   │   │   ├── server.ts            # HTTP服务器
│   │   │   ├── ws-server.ts         # Socket.IO服务器
│   │   │   ├── routes/
│   │   │   │   ├── pairings.ts      # 配对API
│   │   │   │   ├── messages.ts      # 消息API
│   │   │   │   ├── upload.ts        # 文件上传
│   │   │   │   └── devices.ts       # 设备管理
│   │   │   ├── ws/
│   │   │   │   ├── phone.ts         # 手机WS处理
│   │   │   │   └── plugin.ts        # PluginWS处理
│   │   │   ├── models/
│   │   │   │   ├── Pairing.ts       # 配对模型
│   │   │   │   ├── Message.ts       # 消息模型
│   │   │   │   ├── Device.ts        # 设备模型
│   │   │   │   └── User.ts          # 用户模型
│   │   │   ├── services/
│   │   │   │   ├── StorageService.ts    # 文件存储
│   │   │   │   ├── QueueService.ts      # 消息队列
│   │   │   │   └── NotificationService.ts # 通知服务
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # 认证中间件
│   │   │   │   └── rateLimit.ts    # 限流中间件
│   │   │   └── utils/
│   │   │       ├── crypto.ts       # 加密工具
│   │   │       ├── qr.ts           # QR码生成
│   │   │       └── validators.ts   # 输入验证
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── trix-native-plugin/           # OpenClaw Channel Plugin
│       ├── src/
│       │   ├── index.ts             # 入口,注册插件
│       │   ├── channel.ts          # Channel定义
│       │   ├── login.ts            # 配对流程
│       │   ├── resume.ts           # 恢复连接
│       │   ├── outbound.ts         # 发送消息到手机
│       │   ├── inbound.ts          # 接收手机消息
│       │   ├── credentials.ts      # 凭证管理
│       │   ├── api.ts              # 服务器API调用
│       │   ├── types.ts            # 类型定义
│       │   └── config.ts           # 配置处理
│       ├── openclaw.plugin.json    # 插件元数据
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── trix-ios/                     # iOS App
│   │   ├── Sources/
│   │   │   ├── App/
│   │   │   │   └── TRIXApp.swift
│   │   │   ├── Features/
│   │   │   │   ├── Pairing/
│   │   │   │   │   ├── PairingView.swift
│   │   │   │   │   ├── QRScannerView.swift
│   │   │   │   │   └── PairingViewModel.swift
│   │   │   │   └── Chat/
│   │   │   │       ├── ChatView.swift
│   │   │   │       └── ChatViewModel.swift
│   │   │   ├── Services/
│   │   │   │   ├── WebSocketService.swift
│   │   │   │   ├── APIService.swift
│   │   │   │   └── NotificationService.swift
│   │   │   └── Models/
│   │   │       ├── Message.swift
│   │   │       └── Device.swift
│   │   └── Resources/
│   │       ├── Assets.xcassets
│   │       └── Info.plist
│   │
│   └── trix-web/                     # Web App
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── PairingPage.tsx
│       │   │   └── ChatPage.tsx
│       │   ├── components/
│       │   │   ├── QRScanner.tsx
│       │   │   └── MessageList.tsx
│       │   └── services/
│       │       ├── api.ts
│       │       └── websocket.ts
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
│
├── docker-compose.yml                # 一键部署
├── docker/
│   ├── server.Dockerfile
│   └── nginx.conf
│
├── package.json                      # workspace根配置
└── README.md
```

---

## 4. 服务器端实现 (TRIX Native Server)

### 4.1 核心API设计

#### 4.1.1 配对API

```typescript
// POST /api/pairings
// 生成新的配对码
interface PairingsCreateResponse {
  success: true;
  code: string;              // 6位配对码,如 "X7K9P2"
  qrDataUrl: string;         // QR码data URL
  expiresIn: number;         // 过期秒数,如300
  createdAt: string;         // ISO时间戳
}

// GET /api/pairings/:code
// 查询配对状态
interface PairingsStatusResponse {
  success: true;
  code: string;
  status: 'waiting' | 'phone_connected' | 'paired' | 'expired';
  deviceId?: string;         // 配对成功后返回
  createdAt: string;
  pairedAt?: string;
}

// POST /api/pairings/:code/claim
// 手机认领配对
interface PairingsClaimRequest {
  deviceId: string;          // 手机设备ID
  deviceName: string;        // 手机设备名,如 "iPhone 15 Pro"
  publicKey: string;        // 设备公钥(可选)
}

interface PairingsClaimResponse {
  success: true;
  deviceId: string;
  pluginToken: string;       // 长期token,用于后续API认证
  refreshToken: string;      // 刷新token
  serverUrl: string;        // 服务器URL
  expiresIn: number;
}
```

#### 4.1.2 消息API

```typescript
// POST /api/messages/from-plugin
// Plugin发送消息到手机(Agent → 手机)
interface FromPluginRequest {
  conversationId: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'file';
    url: string;
    mimeType: string;
    fileName?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
  }>;
}

interface FromPluginResponse {
  success: true;
  messageId: string;
}

// GET /api/messages/to-plugin
// Plugin拉取手机消息(手机 → Agent)
interface ToPluginQuery {
  conversationId: string;
  lastMessageId?: string;
}

interface ToPluginResponse {
  success: true;
  messages: Array<{
    id: string;
    conversationId: string;
    from: 'phone';
    text?: string;
    attachments?: Array<Attachment>;
    timestamp: string;
  }>;
  hasMore: boolean;
}
```

#### 4.1.3 文件上传API

```typescript
// POST /api/upload
// 上传附件
interface UploadRequest {
  file: File;                    // multipart/form-data
  type: 'image' | 'audio' | 'video' | 'file';
  conversationId?: string;
}

interface UploadResponse {
  success: true;
  url: string;                   // 公网可访问URL
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}
```

### 4.2 WebSocket协议

#### 4.2.1 手机端 (/ws/phone)

```typescript
// 连接
ws = new WebSocket('ws://TRIX_SERVER_HOST:8788/ws/phone?code=X7K9P2');

// 发送消息
ws.send(JSON.stringify({
  type: 'message',
  id: 'msg_xxx',
  conversationId: 'conv_default',
  text: '你好',
  attachments: [
    { type: 'image', url: 'http://...', mimeType: 'image/jpeg' }
  ]
}));

// 接收消息
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg = { type: 'message', id, from: 'agent', text, attachments, timestamp }
};

// 心跳
ws.send(JSON.stringify({ type: 'ping' }));
```

#### 4.2.2 Plugin端 (/ws/plugin) - 可选优化

```typescript
// 连接
ws = new WebSocket('ws://TRIX_SERVER_HOST:8788/ws/plugin?token=ptk_xxx');

// 接收手机消息(实时推送)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // 收到手机发来的消息
};

// 发送确认
ws.send(JSON.stringify({
  type: 'ack',
  messageIds: ['msg_xxx']
}));
```

### 4.3 凭证文件格式

```json
// ~/.openclaw/credentials/trixNative-creds.json
{
  "version": "1.0",
  "accountId": "default",
  "serverUrl": "http://TRIX_SERVER_HOST:8788",
  "deviceId": "device_abc123",
  "pluginToken": "ptk_xxx...yyy",
  "refreshToken": "rtk_xxx...yyy",
  "keyPair": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIC...",
    "encryptedPrivateKey": "enc_xxx...yyy"  // 加密存储
  },
  "pairedAt": "2024-03-14T12:00:00Z",
  "expiresAt": "2025-03-14T12:00:00Z"
}
```

---

## 5. OpenClaw Channel Plugin 实现

### 5.1 插件元数据

```json
// openclaw.plugin.json
{
  "id": "trix-native",
  "name": "TRIX Native Channel",
  "description": "通过配对码或QR码连接TRIX手机App,支持完整多模态消息",
  "version": "1.0.0",
  "channels": ["trix-native"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["serverUrl"],
    "properties": {
      "enabled": { "type": "boolean", "default": true },
      "name": { "type": "string", "default": "TRIX Native" },
      "serverUrl": { "type": "string", "format": "uri" }
    }
  },
  "uiHints": {
    "serverUrl": {
      "label": "Server URL",
      "help": "TRIX Native服务器地址,如 http://TRIX_SERVER_HOST:8788"
    }
  }
}
```

### 5.2 Channel定义

```typescript
// src/channel.ts
import type { ChannelPlugin } from 'openclaw/plugin-sdk';

export const trixNativeChannel: ChannelPlugin = {
  id: 'trix-native',

  meta: {
    id: 'trix-native',
    label: 'TRIX Native',
    selectionLabel: 'TRIX Native (手机配对)',
    docsPath: '/channels/trix-native',
    blurb: '通过配对码或QR码连接TRIX手机App,支持完整多模态消息',
    aliases: ['trix', 'native', 'phone']
  },

  capabilities: {
    chatTypes: ['direct'],
    media: true,        // 支持多模态
    polls: false,
    threads: false,
    reactions: false,
    edit: false,
    reply: true
  },

  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.trixNative?.accounts ?? {}),
    resolveAccount: (cfg, accountId) => {
      const account = cfg.channels?.trixNative?.accounts?.[accountId ?? 'default'];
      if (!account) throw new Error(`Account ${accountId} not found`);
      return { accountId: accountId ?? 'default', ...account };
    }
  },

  // 登录/配对
  async login(ctx) {
    const { account, api } = ctx;
    const { serverUrl } = account;

    // 1. 生成配对码
    const res = await fetch(`${serverUrl}/api/pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const { code, qrDataUrl, expiresIn } = await res.json();

    // 2. 显示配对界面
    api.ui.showPairingDialog({
      title: '连接 TRIX 手机',
      code,
      qrCode: qrDataUrl,
      expiresIn,
      instructions: ['在手机上打开TRIX App', '点击"连接OpenClaw"', '扫描此二维码或输入配对码']
    });

    // 3. 轮询等待配对
    const startTime = Date.now();
    while (Date.now() - startTime < expiresIn * 1000) {
      await sleep(3000);

      const statusRes = await fetch(`${serverUrl}/api/pairings/${code}`);
      const status = await statusRes.json();

      if (status.status === 'paired') {
        api.ui.closePairingDialog();
        api.ui.showNotification({ type: 'success', message: '手机已连接!' });

        return {
          paired: true,
          deviceId: status.deviceId,
          pluginToken: status.pluginToken,
          refreshToken: status.refreshToken,
          serverUrl,
          pairingCode: code
        };
      }

      if (status.status === 'expired') {
        api.ui.closePairingDialog();
        throw new Error('配对码已过期');
      }
    }

    api.ui.closePairingDialog();
    throw new Error('配对超时');
  },

  // 恢复连接
  async resume(ctx) {
    const { credentials, account } = ctx;

    // 验证设备是否仍然有效
    const res = await fetch(`${credentials.serverUrl}/api/devices/${credentials.deviceId}/status`, {
      headers: { 'X-Plugin-Token': credentials.pluginToken }
    });

    if (!res.ok) {
      throw new Error('设备已失效,请重新配对');
    }

    return { resumed: true };
  },

  // 发送消息到手机(outbound)
  async sendMessage(ctx) {
    const { message, account, conversation } = ctx;
    const { text, attachments } = message;

    // 1. 上传附件
    const uploadedAttachments = [];
    if (attachments?.length) {
      for (const att of attachments) {
        const content = await fetch(att.url).then(r => r.buffer());
        const formData = new FormData();
        formData.append('file', new Blob([content]), att.name);
        formData.append('type', att.type);

        const uploadRes = await fetch(`${account.serverUrl}/api/upload`, {
          method: 'POST',
          headers: { 'X-Plugin-Token': credentials.pluginToken },
          body: formData
        });
        const uploadData = await uploadRes.json();
        uploadedAttachments.push({ ...att, url: uploadData.url });
      }
    }

    // 2. 发送消息到手机
    const res = await fetch(`${account.serverUrl}/api/messages/from-plugin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-Token': credentials.pluginToken
      },
      body: JSON.stringify({
        conversationId: conversation.id,
        text,
        attachments: uploadedAttachments
      })
    });

    if (!res.ok) throw new Error('发送失败');
    return { sent: true };
  },

  // 接收手机消息(inbound)
  async receiveMessages(ctx) {
    const { account, conversation, lastMessageId } = ctx;

    const res = await fetch(
      `${account.serverUrl}/api/messages/to-plugin?` +
      `conversationId=${conversation.id}&lastMessageId=${lastMessageId || ''}`,
      { headers: { 'X-Plugin-Token': credentials.pluginToken } }
    );

    const data = await res.json();

    return {
      messages: data.messages.map(msg => ({
        id: msg.id,
        timestamp: msg.timestamp,
        from: msg.from === 'phone' ? 'user' : 'agent',
        text: msg.text,
        attachments: msg.attachments
      }))
    };
  }
};
```

---

## 6. iOS App 实现

### 6.1 配对流程

```swift
// PairingViewModel.swift
class PairingViewModel: ObservableObject {
    @Published var pairingCode: String = ""
    @Published var qrCodeData: String = ""
    @Published var status: PairingStatus = .idle
    @Published var error: String?

    enum PairingStatus {
        case idle
        case waiting
        case connecting
        case paired
        case failed
    }

    // 开始配对
    func startPairing() async {
        status = .waiting

        // 1. 请求服务器生成配对码
        let response = try await APIService.shared.createPairing()
        pairingCode = response.code
        qrCodeData = response.qrDataUrl

        // 2. 轮询等待配对确认
        while status == .waiting {
            try await Task.sleep(nanoseconds: 3_000_000_000)

            let statusResponse = try await APIService.shared.getPairingStatus(code: pairingCode)

            switch statusResponse.status {
            case "paired":
                // 3. 配对成功,保存凭证
                let credentials = try await APIService.shared.claimPairing(
                    code: pairingCode,
                    deviceId: DeviceInfo.deviceId,
                    deviceName: DeviceInfo.deviceName
                )
                await saveCredentials(credentials)
                status = .paired

            case "expired":
                status = .failed
                error = "配对码已过期"

            default:
                break
            }
        }
    }

    // 扫码配对
    func handleQRCode(_ code: String) async throws {
        status = .connecting

        let response = try await APIService.shared.claimPairing(
            code: code,
            deviceId: DeviceInfo.deviceId,
            deviceName: DeviceInfo.deviceName
        )

        await saveCredentials(response)
        status = .paired
    }
}
```

### 6.2 WebSocket连接

```swift
// WebSocketService.swift
class WebSocketService: ObservableObject {
    private var socket: WebSocket?
    @Published var isConnected = false
    @Published var messages: [ChatMessage] = []

    // 连接服务器
    func connect(pairingCode: String) {
        var request = URLRequest(url: URL(string: "\(ServerConfig.wsURL)/ws/phone?code=\(pairingCode)")!)
        request.timeoutInterval = 30

        socket = WebSocket(request: request)
        socket?.delegate = self
        socket?.connect()
    }

    // 发送消息
    func send(message: ChatMessage) {
        let data = try? JSONEncoder().encode(message)
        socket?.send(data: data)
    }

    // 接收消息
    func didReceive(event: WebSocketEvent) {
        switch event {
        case .connected:
            isConnected = true

        case .text(let text):
            if let data = text.data(using: .utf8),
               let message = try? JSONDecoder().decode(ChatMessage.self, from: data) {
                messages.append(message)
            }

        case .disconnected:
            isConnected = false

        default:
            break
        }
    }
}
```

---

## 7. 用户使用流程

### 7.1 首次配对

```bash
# 1. 安装Plugin
$ openclaw plugins install @trix-app/trix-native

# 2. 配置
# 首次使用,插件引导配置serverUrl

# 3. 配对
$ openclaw channels login trixNative

═══════════════════════════════════════════════════════
           TRIX Native 配对
═══════════════════════════════════════════════════════

配对码: X7K9P2

或扫描二维码:
█████████████████████████████████████
██ ▄▄▄▄▄ █▀▄▄▄▀▄▀▄▀█ ▄▄▄▄▄ ██
██ █   █ █ ▄▀ ▄▀ ▄▀█ █   █ ██
██ █▄▄▄█ █▀▄▀▄▀▄▀▄▀█ █▄▄▄█ ██
██▄▄▄▄▄▄▄█ ▀▄▀ ▀▄▀▄█▄▄▄▄▄▄▄██
██ ▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀██
██▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄██
█████████████████████████████████████

请在手机上打开TRIX App,点击"连接OpenClaw"
扫描此二维码或输入配对码: X7K9P2

等待配对确认... ⏱️ (5分钟过期)

# 4. 手机扫码后
✓ 配对成功! 手机已连接!
设备ID: device_abc123
凭证已保存到 ~/.openclaw/credentials/trixNative-creds.json
下次自动连接,无需再次配对
```

### 7.2 日常使用

```bash
# 启动OpenClaw时自动恢复连接
$ openclaw start
...
[trixNative] Loading credentials...
[trixNative] Resuming connection to server...
[trixNative] ✓ Connected (device_abc123)
[trixNative] ✓ Channel online

# 查看状态
$ openclaw channels list
NAME          STATUS     ACCOUNT
trixNative    online     default

$ openclaw channels status trixNative
Channel: trixNative
Status: online
Device: device_abc123
Server: http://TRIX_SERVER_HOST:8788
Connected since: 2024-03-14 12:00:00
```

---

## 8. 部署方案

### 8.1 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  trix-native-server:
    build:
      context: ./packages/trix-native-server
      dockerfile: ../../docker/server.Dockerfile
    ports:
      - "8788:8788"
    volumes:
      - ./attachments:/app/attachments
      - ./credentials:/app/credentials
    environment:
      - NODE_ENV=production
      - PORT=8788
      - UPLOAD_DIR=/app/attachments
      - MAX_FILE_SIZE=50MB
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8788/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./attachments:/usr/share/nginx/html:ro
    depends_on:
      - trix-native-server
    restart: unless-stopped
```

---

## 9. 测试计划

### 9.1 单元测试

| 模块 | 测试项 | 覆盖率目标 |
|------|--------|-----------|
| Server | PairingService, MessageService, UploadService | 80%+ |
| Plugin | login, resume, sendMessage, receiveMessages | 80%+ |
| iOS | WebSocketService, APIService | 70%+ |

### 9.2 集成测试

- 配对流程: 手机扫码 → 服务器 → Plugin
- 消息收发: 手机 → 服务器 → Plugin → OpenClaw → Agent
- 多模态: 图片/语音/视频上传和显示

### 9.3 E2E测试

- 完整用户流程: 安装 → 配对 → 聊天 → 重连

---

## 10. 时间线和里程碑

| 阶段 | 时间 | 任务 | 交付物 |
|------|------|------|--------|
| Phase 1 | Week 1-2 | 服务器核心API开发 | 可运行的REST API + WebSocket |
| Phase 2 | Week 3 | Plugin开发 | 可安装的Channel Plugin |
| Phase 3 | Week 4-5 | iOS配对流程 | 扫码+输入码功能 |
| Phase 4 | Week 6 | 完整消息功能 | 文字+多模态收发 |
| Phase 5 | Week 7 | 集成测试 | 完整E2E流程 |
| Phase 6 | Week 8 | 部署+文档 | 生产可用的系统 |

---

## 11. 风险和对策

| 风险 | 影响 | 对策 |
|------|------|------|
| OpenClaw SDK变更 | Plugin可能不兼容 | 关注官方更新,保持接口兼容 |
| 服务器稳定性 | 服务中断 | PM2监控,自动重启,日志告警 |
| Token泄露 | 账户安全 | 加密存储,短期过期,刷新机制 |
| 网络中断 | 消息丢失 | 离线队列,重新同步机制 |

---

## 附录

### A. 消息格式完整定义

```typescript
// 手机发送的消息
interface PhoneMessage {
  id: string;
  type: 'message';
  conversationId: string;
  from: 'phone';
  timestamp: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'file';
    url: string;
    mimeType: string;
    fileName?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
  }>;
}

// OpenClaw Agent发送的消息
interface AgentMessage {
  id: string;
  type: 'message';
  conversationId: string;
  from: 'agent';
  timestamp: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'file';
    url: string;
    mimeType: string;
    fileName?: string;
    size?: number;
  }>;
}
```

### B. 错误码定义

```typescript
const ErrorCodes = {
  // 配对相关
  PAIRING_NOT_FOUND: 'PAIRING_NOT_FOUND',
  PAIRING_EXPIRED: 'PAIRING_EXPIRED',
  PAIRING_ALREADY_USED: 'PAIRING_ALREADY_USED',

  // 认证相关
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',

  // 消息相关
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  CLIENT_NOT_CONNECTED: 'CLIENT_NOT_CONNECTED',

  // 文件相关
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED'
};
```

### C. 配置参考

```json
// 服务器配置 (config/default.json)
{
  "server": {
    "port": 8788,
    "host": "0.0.0.0"
  },
  "pairing": {
    "codeLength": 6,
    "expiresIn": 300,
    "chars": "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  },
  "upload": {
    "maxFileSize": 52428800,
    "allowedTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg", "video/mp4", "video/quicktime"],
    "storageDir": "./attachments"
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
```

---

*文档版本: 1.0 | 最后更新: 2024-03-14*

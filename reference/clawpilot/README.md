# @rethinkingstudio/clawpilot 参考文档

> 轻量级 OpenClaw Relay Client，适用于 macOS/Linux

## 简介

`@rethinkingstudio/clawpilot` 是一个轻量级的 OpenClaw Gateway 客户端，专门为 macOS 和 Linux 设计，用于 iOS 应用与 OpenClaw Gateway 之间的通信中继。

**npm**: https://www.npmjs.com/package/@rethinkingstudio/clawpilot
**版本**: 1.1.13

---

## 与 openclaw 官方包对比

| 特性 | @rethinkingstudio/clawpilot | openclaw 官方 |
|------|-------------------------------|---------------|
| 体积 | 轻量 (~3 个核心文件) | 庞大 (100MB+) |
| 依赖 | ws, commander, qrcode-terminal | 54 个依赖 |
| 用途 | Relay 客户端 | 完整平台集成 |
| 代码 | 简洁易读 | 编译后难以阅读 |
| 平台 | macOS/Linux | 全平台 |

---

## 目录结构

```
clawpilot/
├── README.md              # 原始 README
├── package.json           # 包配置
├── src/
│   ├── index.ts           # 入口文件
│   ├── commands/          # CLI 命令
│   │   ├── pair.ts        # 配对命令
│   │   ├── run.ts         # 运行命令
│   │   ├── status.ts      # 状态命令
│   │   └── install.ts     # 安装服务
│   ├── config/            # 配置管理
│   ├── relay/            # 核心中继逻辑 ⭐
│   │   ├── gateway-client.ts   # Gateway 客户端 (~350 行)
│   │   ├── relay-manager.ts    # 中继管理器 (~300 行)
│   │   └── reconnect.ts       # 重连逻辑
│   ├── platform/          # 平台特定代码
│   └── i18n/              # 国际化
├── dist/                  # 编译输出
├── test-chat.mjs          # 测试脚本
└── test-direct.mjs        # 直连测试
```

---

## 核心实现

### 1. 设备身份 (Ed25519)

clawpilot 使用 Ed25519 密钥对进行设备认证：

```typescript
// 加载或创建设备身份
function loadOrCreateDeviceIdentity(): DeviceIdentity {
  const IDENTITY_PATH = join(homedir(), ".clawai", "device-identity.json");

  if (existsSync(IDENTITY_PATH)) {
    const stored = JSON.parse(readFileSync(IDENTITY_PATH, "utf8"));
    if (stored.deviceId && stored.publicKeyPem && stored.privateKeyPem) {
      return stored;
    }
  }

  // 生成新的 Ed25519 密钥对
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  // 从公钥派生设备 ID
  const deviceId = createHash("sha256").update(rawPublicKeyBytes(publicKeyPem)).digest("hex");

  return { deviceId, publicKeyPem, privateKeyPem };
}

// 构建签名设备信息
function buildSignedDevice(identity, opts) {
  const version = opts.nonce ? "v2" : "v1";
  const payload = [
    version,
    identity.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    opts.scopes.join(","),
    String(opts.signedAtMs),
    opts.token ?? "",
    ...(version === "v2" ? [opts.nonce ?? ""] : []),
  ].join("|");

  const signature = base64UrlEncode(sign(null, Buffer.from(payload, "utf8"), privateKey));

  return { id, publicKey, signature, signedAt, nonce };
}
```

### 2. Gateway 客户端

核心 `OpenClawGatewayClient` 类实现：

```typescript
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve, reject }>();
  private backoffMs = 1000;
  private stopped = false;
  private connectNonce: string | null = null;
  private storedDeviceToken: string | null = null;
  private identity: DeviceIdentity;

  constructor(opts: GatewayClientOptions) {
    this.identity = loadOrCreateDeviceIdentity();
  }

  start(): void {
    this.ws = new WebSocket(this.opts.url, { maxPayload: 25 * 1024 * 1024 });

    this.ws.on("open", () => {
      // 等待 connect.challenge 或直接发送 connect
      this.connectTimer = setTimeout(() => this.sendConnect(), 1000);
    });

    this.ws.on("message", (data) => this.handleMessage(data.toString()));
    this.ws.on("close", (code, reason) => {
      this.scheduleReconnect();
      this.opts.onDisconnected(reason.toString());
    });
  }

  // 发送请求（等待响应）
  async request<T>(method: string, params?: unknown): Promise<T> {
    const id = randomUUID();
    const frame = { type: "req", id, method, params };

    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });

    this.ws.send(JSON.stringify(frame));
    return p;
  }

  // 发送通知（不等待响应）
  send(method: string, params?: unknown): void {
    const frame = { type: "req", id: randomUUID(), method, params };
    this.ws.send(JSON.stringify(frame));
  }
}
```

### 3. 协议帧格式

```typescript
// 请求帧
interface ReqFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

// 响应帧
interface ResFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string };
}

// 事件帧
interface EvtFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}
```

### 4. 连接流程

```
1. WebSocket 连接打开
2. 等待 connect.challenge (nonce)
3. 发送 connect 请求:
   - minProtocol: 3
   - maxProtocol: 3
   - role: "operator"
   - scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals", "operator.pairing"]
   - client: { id, displayName, version, platform, mode }
   - device: { id, publicKey, signature, signedAt, nonce? }
   - auth: { token?, password? }
4. 接收 hello-ok 响应
5. 存储 deviceToken 供后续使用
6. 启动 tick 心跳
```

---

## 关键代码片段

### 发送 chat.send

```typescript
// 使用 request 等待响应
const result = await client.request("chat.send", {
  sessionKey: "agent:main:main",
  message: "Hello",
  attachments: []  // 可选
});

// 或使用 send 不等待响应
client.send("chat.send", {
  sessionKey: "agent:main:main",
  message: "Hello"
});
```

### 处理 chat.push 事件

```typescript
// 监听 chat 事件（来自 Gateway 的推送）
client.on("chat", (params) => {
  console.log("收到聊天推送:", params);
});
```

---

## 在自己的项目中使用

### 安装

```bash
npm install ws
# 或
npm install @rethinkingstudio/clawpilot
```

### 直接使用 ws 实现

```typescript
import { WebSocket } from "ws";
import { randomUUID, generateKeyPairSync, createPrivateKey, sign, createPublicKey, createHash } from "node:crypto";

// 1. 加载设备身份
const identity = loadOrCreateDeviceIdentity();

// 2. 连接 Gateway
const ws = new WebSocket("ws://127.0.0.1:18789");

ws.on("open", () => {
  // 3. 发送 connect
  const connectFrame = buildConnectFrame(identity, { token: "your-token" });
  ws.send(JSON.stringify(connectFrame));
});

ws.on("message", (data) => {
  const frame = JSON.parse(data.toString());

  // 4. 处理响应
  if (frame.type === "res" && frame.ok) {
    console.log("连接成功!");
  }

  // 5. 处理 chat.push
  if (frame.type === "req" && frame.method === "chat.push") {
    console.log("收到消息:", frame.params);
  }
});

// 6. 发送消息
function sendChat(sessionKey: string, message: string) {
  ws.send(JSON.stringify({
    type: "req",
    id: randomUUID(),
    method: "chat.send",
    params: { sessionKey, message }
  }));
}
```

---

## 与官方 openclaw 包的区别

| 特性 | clawpilot | openclaw 官方 |
|------|------------|---------------|
| 请求验证 | 无 | 有 validateRequestFrame |
| 重连逻辑 | 简单指数退避 | 复杂状态机 |
| 依赖数量 | 3 个 | 54 个 |
| 代码可读性 | 高 (源码 ~350 行) | 低 (编译后难以阅读) |
| 功能完整 | 核心功能 | 全平台集成 |

---

## 注意事项

1. **sessionKey**: 必须使用完整会话键，如 `agent:main:main`
2. **心跳**: Gateway 15-30 秒发送 tick，需保持连接
3. **设备令牌**: 首次连接后会获得 deviceToken，需持久化
4. **错误处理**: 需处理连接断开、重连、认证失败等情况

---

## 许可证

MIT

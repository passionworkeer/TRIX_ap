# OpenClaw 参考代码

本文件夹包含从官方 OpenClaw 包中提取的参考代码，用于理解和实现 TRIX 3D Companion 与 OpenClaw Gateway 的集成。

## 目录结构

```
reference/
├── README.md              # 本文件
├── openclaw/              # 官方 openclaw 包 (完整平台)
│   ├── feishu/           # 飞书集成源码 (50+ 文件)
│   │   ├── bot.ts        # 飞书 Bot 核心逻辑
│   │   ├── send.ts       # 消息发送
│   │   ├── client.ts     # 飞书 API 客户端
│   │   ├── channel.ts   # Channel 实现
│   │   ├── accounts.ts   # 账号管理
│   │   ├── skills/      # 飞书 Skills
│   │   └── ...          # 其他模块
│   ├── gateway-client/   # Gateway 客户端
│   └── protocol/        # 协议类型定义
│
└── clawpilot/            # @rethinkingstudio/clawpilot (轻量级)
    ├── README.md         # 详细实现文档 ⭐
    ├── src/             # 源码
    │   └── relay/       # 核心中继逻辑
    │       ├── gateway-client.ts  # Gateway 客户端 (~350 行)
    │       ├── relay-manager.ts    # 中继管理器
    │       └── reconnect.ts        # 重连逻辑
    └── test-*.mjs       # 测试脚本
```

## 两个包对比

| 特性 | openclaw (官方) | clawpilot (轻量) |
|------|-----------------|------------------|
| 体积 | 100MB+ | ~3 文件 |
| 依赖 | 54 个 | 3 个 |
| 适用场景 | 完整平台集成 | Relay 中继 |
| 代码可读性 | 编译后难读 | 源码简洁 |
| 文档 | 本文件 | `clawpilot/README.md` |

## 快速开始

### 使用 clawpilot (推荐用于 Relay)

```bash
npm install @rethinkingstudio/clawpilot

clawpilot pair    # 配对
clawpilot run    # 运行
```

### 使用官方 openclaw

```bash
npm install openclaw
```

## 关键要点

### 1. chat.send 参数

官方协议要求使用 `sessionKey`（完整会话键）：

```typescript
// 正确 ✅
await client.request('chat.send', {
  sessionKey: 'agent:main:main',  // 完整会话键
  message: 'Hello'
});

// 错误 ❌
await client.request('chat.send', {
  sessionId: 'main',  // 只传 sessionId 会导致路由错误
  message: 'Hello'
});
```

### 2. GatewayClient 关键方法

```typescript
class GatewayClient {
  constructor(opts: GatewayClientOptions);

  // 启动连接
  start(): void;

  // 停止连接
  stop(): void;

  // 发送请求（等待响应）
  request<T>(method: string, params?: unknown): Promise<T>;

  // 回调选项
  onEvent?: (evt: EventFrame) => void;
  onHelloOk?: (hello: HelloOk) => void;
  onConnectError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
}
```

### 3. 连接选项

```typescript
interface GatewayClientOptions {
  url?: string;              // Gateway URL (默认 ws://127.0.0.1:18789)
  token?: string;            // 设备配对 token
  password?: string;         // 密码认证
  deviceIdentity?: DeviceIdentity;  // 设备身份
  mode?: GatewayClientMode;  // 'backend' | 'ui' | 'cli'
  clientName?: string;       // 客户端名称
  onEvent?: (evt) => void;   // 事件处理
}
```

### 4. 飞书集成要点

飞书集成使用官方 `@larksuiteoapi/node-sdk`：

```typescript
import { Client } from '@larksuiteoapi/node-sdk';

// 创建客户端
const client = new Client({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
});

// 发送消息
await client.im.message.create({
  params: { receive_id_type: 'open_id' },
  data: {
    receive_id: userOpenId,
    content: JSON.stringify({ text: 'Hello' }),
    msg_type: 'text'
  }
});
```

## 使用官方包

如果想使用官方 openclaw 包：

```bash
npm install openclaw
```

然后：

```typescript
import { GatewayClient } from 'openclaw';

const client = new GatewayClient({
  url: 'ws://127.0.0.1:18789',
  token: 'your-token',
  onEvent: (evt) => console.log(evt),
});

client.start();
```

## 注意事项

1. **sessionKey vs sessionId**: 必须使用完整 sessionKey
2. **消息验证**: 官方包会验证请求帧格式
3. **心跳**: Gateway 需要定期 tick 保持连接
4. **重连**: 官方包内置指数退避重连

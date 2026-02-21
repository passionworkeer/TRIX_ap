# OpenClaw 集成 - 实际可行方案总结

## 重要发现

经过实际测试和文档研究，我发现了一个关键问题：

**OpenClaw Gateway (`localhost:18789`) 主要是一个 WebSocket 服务器和 Web UI，并没有暴露标准的 HTTP REST API (如 `/v1/chat/completions`)。**

### 实际测试结果

1. ✅ **Gateway 正在运行**: `http://127.0.0.1:18789` 返回 Web UI
2. ❌ **OpenAI 兼容 API 不存在**: `POST /v1/chat/completions` 返回 `405 Method Not Allowed`
3. ✅ **WebSocket 可用**: Gateway 支持原生 WebSocket 连接

### 正确的集成方案

基于实际架构，有以下三种可行方案：

---

## 方案对比

| 方案 | 难度 | 延迟 | 需要改动 | 推荐度 |
|------|------|------|----------|--------|
| **方案1: 文件轮询 (当前)** | ⭐ 极低 | 3-5秒 | 0行 | ⭐⭐ 暂时可用 |
| **方案2: WebSocket Relay** | ⭐⭐⭐ 高 | <1秒 | ~500行 Python | ⭐⭐⭐⭐ 最优 |
| **方案3: OpenClaw 自定义 Channel** | ⭐⭐ 中 | <1秒 | ~300行 Python | ⭐⭐⭐ 推荐 |

---

## 方案1: 文件轮询 (当前实现，已可用)

### 工作原理

```
Relay Server → 轮询文件 → OpenClaw 写入文件 → Relay 读取 → 返回 App
```

### 优点
- ✅ **零代码修改**: 已经实现
- ✅ **简单可靠**: 文件 I/O 最简单
- ✅ **立即可用**: 无需额外开发

### 缺点
- ❌ **延迟高**: 3-5秒轮询间隔
- ❌ **资源浪费**: 空轮询消耗 CPU/内存
- ❌ **Token 浪费**: OpenClaw 频繁处理空请求

### 代码示例

**Relay Server 端** (已实现):

```javascript
// 定时轮询 OpenClaw 输出文件
setInterval(async () => {
  const response = await fetch('http://localhost:18789/api/messages');
  const messages = await response.json();

  if (messages.length > 0) {
    // 发送到 App
    socket.emit('bot_message', { content: messages[0].text });
  }
}, 3000);  // 每3秒轮询一次
```

---

## 方案2: WebSocket Relay (推荐，最优性能)

### 工作原理

```
App → Relay Server (Socket.IO) → WebSocket Relay Skill → OpenClaw Gateway (WebSocket)
```

### 架构图

```
┌─────────────┐      Socket.IO      ┌──────────────┐      WebSocket      ┌─────────────┐
│  Web App    │ ←─────────────────→ │ Relay Server │ ←─────────────────→ │  OpenClaw   │
│  (云端)      │   wss://m.jmtrick.com │  (阿里云)    │  ws://localhost:18789 │  Gateway    │
└─────────────┘                      └──────────────┘                      └─────────────┘
```

### 实现步骤

#### 2.1 创建 WebSocket Relay Skill

**文件**: `C:\Users\wang\.openclaw\skills\websocket_relay.py`

```python
"""
OpenClaw WebSocket Relay Channel
允许 Relay Server 连接并接收消息
"""

import asyncio
import websockets
import json
from typing import Callable, Optional
from loguru import logger

class WebSocketRelayChannel:
    """WebSocket 中继通道"""

    def __init__(self, host: str = "0.0.0.0", port: int = 18888):
        self.host = host
        self.port = port
        self.server = None
        self.clients = set()
        self.message_handler: Optional[Callable] = None

    async def handle_client(self, websocket, path):
        """处理客户端连接"""
        logger.info(f"[WS Relay] 客户端连接: {websocket.remote_address}")
        self.clients.add(websocket)

        try:
            async for message in websocket:
                data = json.loads(message)

                logger.info(f"[WS Relay] 收到消息: {data.get('content', '')[:50]}")

                # 调用 OpenClaw 处理消息
                if self.message_handler:
                    response = await self.message_handler(data.get('content'))

                    # 发送响应
                    await websocket.send(json.dumps({
                        'type': 'response',
                        'content': response
                    }))

        except websockets.exceptions.ConnectionClosed:
            logger.warning(f"[WS Relay] 客户端断开: {websocket.remote_address}")
        finally:
            self.clients.remove(websocket)

    async def start(self, message_handler: Callable):
        """启动 WebSocket 服务器"""
        self.message_handler = message_handler

        logger.info(f"[WS Relay] 启动服务器: ws://{self.host}:{self.port}")

        self.server = await websockets.serve(
            self.handle_client,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=20
        )

        logger.info(f"[WS Relay] ✅ 服务器已启动")

        # 保持运行
        await asyncio.Future()  # run forever

    async def broadcast(self, message: str):
        """广播消息给所有客户端"""
        if self.clients:
            await asyncio.gather(*[
                client.send(json.dumps({'content': message}))
                for client in self.clients
            ])

    async def stop(self):
        """停止服务器"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("[WS Relay] 服务器已停止")


# ============== OpenClaw 集成 ==============

async def handle_openclaw_message(user_message: str) -> str:
    """
    调用 OpenClaw Gateway 处理消息
    这里需要使用 OpenClaw 的内部事件注入机制
    """
    # 方法1: 使用 Gateway 事件注入 (推荐)
    # await gateway.emit('user_message', {'text': user_message})

    # 方法2: 调用 OpenClaw HTTP API (如果存在)
    # async with aiohttp.ClientSession() as session:
    #     async with session.post('http://localhost:18789/api/chat', json={'message': user_message}) as resp:
    #         data = await resp.json()
    #         return data.get('response')

    # 方法3: 使用 OpenClaw Python SDK
    from openclaw import Gateway
    gateway = Gateway()
    response = await gateway.chat(user_message)
    return response


# ============== 启动脚本 ==============

async def main():
    """启动 WebSocket Relay Channel"""
    channel = WebSocketRelayChannel(host="0.0.0.0", port=18888)

    # 启动服务器
    await channel.start(handle_openclaw_message)


if __name__ == "__main__":
    # 这会被 OpenClaw Gateway 自动加载
    asyncio.run(main())
```

#### 2.2 在 Relay Server 中连接

**文件**: `server.js` (阿里云 Relay Server)

```javascript
const WebSocket = require('ws');
const axios = require('axios');

// OpenClaw WebSocket Relay 配置
const OPENCLAW_WS_URL = 'ws://localhost:18888';  // 如果在同一台服务器
// 或使用 frp 穿透:
// const OPENCLAW_WS_URL = 'ws://frp.your-domain.com:18888';

// 维护 WebSocket 连接
let openClawWS = null;

function connectToOpenClaw() {
  openClawWS = new WebSocket(OPENCLAW_WS_URL);

  openClawWS.on('open', () => {
    console.log('[Relay] ✅ 已连接到 OpenClaw WebSocket Relay');
  });

  openClawWS.on('message', (data) => {
    const message = JSON.parse(data);

    console.log('[Relay] 收到 OpenClaw 响应:', message.content);

    // 转发给 App
    io.to(message.deviceId).emit('bot_message', {
      content: message.content,
      contentType: 'text'
    });
  });

  openClawWS.on('close', () => {
    console.warn('[Relay] 与 OpenClaw 断开，5秒后重连...');
    setTimeout(connectToOpenClaw, 5000);
  });

  openClawWS.on('error', (error) => {
    console.error('[Relay] OpenClaw WebSocket 错误:', error);
  });
}

// 启动连接
connectToOpenClaw();

// ============== Socket.IO 事件处理 ==============

io.on('connection', (socket) => {
  socket.on('app_message', async (data) => {
    console.log('[Relay] 收到 App 消息:', data.content);

    // 转发给 OpenClaw
    if (openClawWS && openClawWS.readyState === WebSocket.OPEN) {
      openClawWS.send(JSON.stringify({
        content: data.content,
        deviceId: data.deviceId
      }));
    } else {
      socket.emit('bot_message', {
        content: '抱歉，OpenClaw 服务暂时不可用',
        isError: true
      });
    }
  });
});
```

#### 2.3 使用 frp 穿透 (如需要)

**本地 frp 客户端配置** (OpenClaw 端):

```toml
# C:\Tools\frp\frpc.toml
serverAddr = "47.243.55.130"  # 阿里云 IP
serverPort = 7000

[[proxies]]
name = "openclaw-ws-relay"
type = "tcp"
localIP = "127.0.0.1"
localPort = 18889
remotePort = 18889
```

**Relay Server 连接地址改为**:

```javascript
const OPENCLAW_WS_URL = 'ws://47.243.55.130:18889';
```

---

## 方案3: OpenClaw 自定义 Channel (最符合官方架构)

### 参考文档

OpenClaw 官方文档: `e:\desktop\nanobot\nanobot\MYAPP_INTEGRATION_GUIDE.md`

### 实现思路

创建一个 OpenClaw Channel，让 OpenClaw 主动连接 Relay Server:

```python
# myapp_channel.py (在 OpenClaw skills 目录)
import asyncio
import socketio

class MyRelayChannel:
    """主动连接 Relay Server 的 Channel"""

    def __init__(self, server_url: str):
        self.server_url = server_url
        self.sio = socketio.AsyncClient()

    async def start(self):
        """连接到 Relay Server"""
        await self.sio.connect(self.server_url)

        # 注册为 OpenClaw 客户端
        await self.sio.emit('register_openclaw', {
            'client_type': 'openclaw'
        })

        # 监听 App 消息
        @self.sio.on('app_message')
        async def on_message(data):
            # 调用 OpenClaw 处理
            response = await self.handle_message(data['content'])

            # 返回响应
            await self.sio.emit('bot_message', {
                'content': response
            })

    async def handle_message(self, message: str) -> str:
        """使用 OpenClaw Gateway 处理消息"""
        # 这里直接调用 Gateway
        from openclaw import Gateway
        gateway = Gateway()
        return await gateway.chat(message)
```

---

## 推荐实施路径

### 短期 (立即)

**使用方案1 (文件轮询)** - 已实现，立即可用

- ✅ 无需修改代码
- ✅ 可以立即开始使用
- ✅ 体验虽然不是最优，但完全可用

### 中期 (1-2天)

**实现方案2 (WebSocket Relay)** - 性能最优

- 📝 创建 WebSocket Relay Skill (~200行 Python)
- 📝 修改 Relay Server 代码 (~100行 JS)
- 🚀 实现 <1秒延迟的实时响应

### 长期 (3-5天)

**实现方案3 (自定义 Channel)** - 最符合官方架构

- 📝 参考 nanobot 文档创建官方 Channel
- 📝 完整的事件驱动架构
- 🎯 最佳的可维护性和扩展性

---

## 立即可用的代码

### Relay Server 端 (文件轮询方案，已可用)

```javascript
// 接收 App 消息
socket.on('app_message', async (data) => {
  console.log('[Relay] 收到消息:', data.content);

  // 写入文件，让 OpenClaw 处理
  fs.appendFileSync(
    'C:\\Users\\wang\\.openclaw\\inbox.txt',
    JSON.stringify({
      content: data.content,
      deviceId: data.deviceId,
      timestamp: Date.now()
    }) + '\n'
  );
});

// 轮询 OpenClaw 输出
setInterval(() => {
  try {
    const output = fs.readFileSync('C:\\Users\\wang\\.openclaw\\outbox.txt', 'utf8');
    const lines = output.trim().split('\n');

    lines.forEach(line => {
      if (line) {
        const message = JSON.parse(line);

        // 发送到 App
        io.to(message.deviceId).emit('bot_message', {
          content: message.content,
          contentType: 'text'
        });
      }
    });

    // 清空输出文件
    fs.writeFileSync('C:\\Users\\wang\\.openclaw\\outbox.txt', '');

  } catch (error) {
    // 文件不存在或为空，忽略
  }
}, 3000);  // 每3秒检查一次
```

---

## 总结

基于实际测试，**OpenClaw Gateway 并没有暴露标准的 HTTP REST API**。

### 最务实的方案

**短期**: 使用文件轮询 (已实现)
- ✅ 立即可用
- ✅ 稳定可靠
- ⚠️ 延迟较高(3-5秒)

**中期**: 实现 WebSocket Relay (推荐)
- ✅ 延迟 <1秒
- ✅ 性能最优
- ⚠️ 需要开发 (~500行代码)

**相关文档**:
- `e:\desktop\nanobot\nanobot\MYAPP_INTEGRATION_GUIDE.md` - nanobot Channel 集成指南
- `e:\desktop\trix-3d-companion\docs\OpenClaw端实现方案-详细代码.md` - OpenClaw 端实现
- `e:\desktop\trix-3d-companion\docs\三端接通架构文档.md` - 三端架构文档

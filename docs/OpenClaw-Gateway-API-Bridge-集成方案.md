# OpenClaw Gateway API Bridge 集成方案

## 文档概述

**项目**: TRIX-3D-Companion + OpenClaw 集成
**创建日期**: 2026-02-18
**方案类型**: Gateway API Bridge（事件驱动 PUSH 模式）
**预计时间**: 30 分钟

---

## 核心架构

### 为什么选择 Gateway API Bridge？

**❌ 旧方案（文件轮询/Skill 主动查询）**：
- Skill 每 3-5 秒主动查询服务器
- 延迟高（3-5 秒）
- 浪费 Token 和资源
- AI 无法记住上下文

**✅ 新方案（Gateway API Bridge）**：
- 服务器消息通过 HTTP API **直接推入** OpenClaw
- 延迟 <200ms
- 事件驱动，零浪费
- AI 自动保持上下文记忆

### 架构图

```
┌─────────────┐      Socket.IO      ┌──────────────────┐      Socket.IO      ┌──────────────────┐      HTTP POST      ┌─────────────┐
│  Web App    │ ←─────────────────→ │  Relay Server    │ ←─────────────────→ │  Local Bridge    │ ←─────────────────→ │  OpenClaw   │
│  (云端)     │   wss://m.jmtrick.com│  (云端)          │  wss://m.jmtrick.com│  (本地电脑)       │  localhost:18789   │  Gateway    │
│             │                      │                  │  bridge.js 监听     │  /v1/chat/         │  (本地)     │
└─────────────┘                      └──────────────────┘  completions       └──────────────────┘  completions       └─────────────┘
     (发送消息)                           (转发消息)                              (调用 API)                              (AI 响应)
        │                                     │                                       │                                       │
        │                                     │                                       │                                       │
        │                                     │<──────────────────────────────────────┘                                       │
        │                                     │  (返回 AI 响应)                                                                │
        │<────────────────────────────────────┘                                                                               │
        │  (返回给 App 显示)                                                                                                   │
        │                                                                                                                      │
        └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 核心优势

| 特性 | 说明 |
|------|------|
| ⚡ **零延迟** | <200ms 响应时间（相比文件轮询的 3-5 秒） |
| 🧠 **上下文记忆** | 通过 Gateway 注入的消息自动进入 Memory 系统 |
| 💰 **精准 Token** | 只在真正对话时调用模型，无空转浪费 |
| 🔧 **架构解耦** | Socket 逻辑和推理逻辑完全分离 |
| 🔄 **支持流式** | 可选打字机效果输出 |

---

## 实施步骤

### Step 1: 启动 OpenClaw Gateway（2 分钟）

#### 1.1 启动 OpenClaw-CN

```bash
# 方式 1: 直接运行
openclaw-cn

# 方式 2: 使用 node
node "C:\nodejs_global\node_modules\openclaw-cn\dist\index.js"

# 方式 3: 后台运行（推荐）
openclaw-cn --daemon
```

**验证 Gateway 运行状态**：

```bash
# 测试健康检查
curl http://127.0.0.1:18789/health

# 测试 OpenAI 兼容接口
curl http://127.0.0.1:18789/v1/models
```

**预期响应**：
```json
{
  "object": "list",
  "data": [
    {
      "id": "zai/glm-4.7",
      "object": "model"
    }
  ]
}
```

#### 1.2 验证 Token 认证

OpenClaw Gateway 当前配置：
- **端口**: 18789
- **认证模式**: Token
- **Token**: `__GATEWAY_AUTH_TOKEN_REDACTED__`

---

### Step 2: 部署本地 Bridge 进程（10 分钟）

#### 2.1 架构说明

**关键修正**: 云端 Relay Server **无法直接访问**你本地电脑的 `localhost:18789`。

**正确架构**: 需要在本地电脑运行一个独立的 **Bridge 进程** (`bridge.js`)，它：
1. 使用 `socket.io-client` 连接云端 Relay Server
2. 监听 `app_message` 事件
3. 收到消息后，调用本地 OpenClaw Gateway API (`http://127.0.0.1:18789`)
4. 拿到 AI 响应后，通过 Socket 发回云端

#### 2.2 创建本地 Bridge 脚本

在 **本地电脑**上创建文件 `e:\desktop\trix-3d-companion\bridge\openclaw-bridge.js`：

```javascript
// openclaw-bridge.js
// 运行在本地电脑上，连接云端 Relay Server 和本地 OpenClaw Gateway

const axios = require('axios');
const socketIOClient = require('socket.io-client');

// ==================== 配置 ====================

// 云端 Relay Server 地址
const RELAY_SERVER_URL = 'wss://m.jmtrick.com';
// 或使用测试服务器: 'ws://TRIX_SERVER_HOST:8765'

// 本地 OpenClaw Gateway 配置
const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';
const OPENCLAW_AUTH_TOKEN = '__GATEWAY_AUTH_TOKEN_REDACTED__';

// ==================== OpenClaw Gateway 客户端 ====================

/**
 * 调用本地 OpenClaw Gateway API（带重试机制）
 * @param {string} message - 用户消息
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} AI 响应
 */
async function callOpenClawGateway(message, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // 500ms

  try {
    console.log(`[Bridge] 调用 OpenClaw Gateway (尝试 ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const response = await axios.post(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        model: "zai/glm-4.7",
        messages: [
          { role: "user", content: message }
        ],
        stream: false  // 设为 true 启用流式输出
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000  // 30 秒超时
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log(`[Bridge] ✅ OpenClaw 响应成功: ${aiResponse.substring(0, 50)}...`);

    return aiResponse;

  } catch (error) {
    console.error(`[Bridge] ❌ OpenClaw 调用失败:`, error.message);

    // 如果未达到最大重试次数，延迟后重试
    if (retryCount < MAX_RETRIES) {
      console.log(`[Bridge] 🔄 ${RETRY_DELAY}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return callOpenClawGateway(message, retryCount + 1);
    }

    // 重试次数用尽，抛出错误
    throw new Error(`OpenClaw Gateway 调用失败（已重试 ${MAX_RETRIES} 次）: ${error.message}`);
  }
}

// ==================== Socket.IO 客户端 ====================

console.log(`[Bridge] 🚀 正在连接云端 Relay Server: ${RELAY_SERVER_URL}`);

const socket = socketIOClient(RELAY_SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

// 连接成功
socket.on('connect', () => {
  console.log('[Bridge] ✅ 已连接到云端 Relay Server');

  // 注册为 OpenClaw Bridge
  socket.emit('bridge_register', {
    type: 'openclaw',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

// 连接错误
socket.on('connect_error', (error) => {
  console.error('[Bridge] ❌ 连接失败:', error.message);
});

// 断开连接
socket.on('disconnect', (reason) => {
  console.log('[Bridge] 🔌 与云端断开连接:', reason);
});

// ==================== 消息处理（核心逻辑）====================

// 监听来自 App 的消息
socket.on('app_message', async (data) => {
  const { content, messageId, userId } = data;

  console.log(`[Bridge] 📨 收到 App 消息 (ID: ${messageId}): ${content.substring(0, 50)}...`);

  try {
    // 🎯 关键：调用本地 OpenClaw Gateway API（带自动重试）
    const aiResponse = await callOpenClawGateway(content);

    console.log(`[Bridge] 📤 发送 AI 响应回云端...`);

    // 发送回云端
    socket.emit('bot_message', {
      content: aiResponse,
      contentType: 'text',
      timestamp: Date.now(),
      messageId: messageId
    });

    // 确认消息已处理
    socket.emit('message_sent', {
      success: true,
      messageId: messageId
    });

  } catch (error) {
    console.error('[Bridge] ❌ 处理消息失败:', error.message);

    // 发送错误回云端
    socket.emit('bot_message', {
      content: '抱歉，AI 助手暂时无法响应。请检查本地 OpenClaw 是否正常运行。',
      contentType: 'text',
      timestamp: Date.now(),
      error: true,
      messageId: messageId
    });
  }
});

// 心跳检测
socket.on('ping', () => {
  socket.emit('pong');
});

// ==================== 启动信息 ====================

console.log(`
╔═══════════════════════════════════════════════════════╗
║        OpenClaw Gateway Bridge Client                ║
╠═══════════════════════════════════════════════════════╣
║  Relay Server: ${RELAY_SERVER_URL.padEnd(35)}║
║  OpenClaw:     ${OPENCLAW_GATEWAY_URL.padEnd(35)}║
║  Model:        zai/glm-4.7${' '.repeat(23)}║
╚═══════════════════════════════════════════════════════╝
`);

// 进程退出处理
process.on('SIGINT', () => {
  console.log('\n[Bridge] 🛑 收到退出信号，正在断开连接...');
  socket.disconnect();
  process.exit(0);
});
```

#### 2.3 安装依赖

在本地电脑上安装必要的 npm 包：

```bash
# 在项目根目录
cd e:\desktop\trix-3d-companion\bridge
npm init -y
npm install axios socket.io-client
```

#### 2.4 启动本地 Bridge

```bash
# 方式 1: 直接运行
node openclaw-bridge.js

# 方式 2: 使用 PM2 后台运行（推荐）
npm install -g pm2
pm2 start openclaw-bridge.js --name openclaw-bridge
pm2 save
pm2 startup

# 查看日志
pm2 logs openclaw-bridge
```

**预期输出**：

```
[Bridge] 🚀 正在连接云端 Relay Server: wss://m.jmtrick.com
╔═══════════════════════════════════════════════════════╗
║        OpenClaw Gateway Bridge Client                ║
╠═══════════════════════════════════════════════════════╣
║  Relay Server: wss://m.jmtrick.com                ║
║  OpenClaw:     http://127.0.0.1:18789              ║
║  Model:        zai/glm-4.7                          ║
╚═══════════════════════════════════════════════════════╝
[Bridge] ✅ 已连接到云端 Relay Server
```

---

### Step 3: 配置云端 Relay Server（5 分钟）

云端 Relay Server 需要添加 **Bridge 设备识别**功能，将 OpenClaw Bridge 视为特殊的"设备类型"。

在云端 Relay Server 上添加以下代码：

```javascript
// relay-server.js (在 wss://m.jmtrick.com 或 TRIX_SERVER_HOST:8765 服务器上)

io.on('connection', (socket) => {
  console.log('[Relay Server] 客户端连接:', socket.id);

  // ==================== Bridge 注册 ====================

  socket.on('bridge_register', (data) => {
    const { type, version } = data;

    if (type === 'openclaw') {
      socket.deviceType = 'openclaw_bridge';
      socket.bridgeVersion = version;

      console.log(`[Relay Server] ✅ OpenClaw Bridge 注册成功 (v${version})`);

      socket.emit('bridge_registered', {
        success: true,
        message: 'Bridge 注册成功'
      });
    }
  });

  // ==================== 消息转发（修改版）====================

  // App 发送消息（修改后的逻辑）
  socket.on('app_message', async (data) => {
    const { content, messageId, userId } = data;

    console.log(`[Relay Server] 📨 收到 App 消息: ${content.substring(0, 50)}...`);

    // 查找可用的 OpenClaw Bridge
    const openclawBridge = findOpenClawBridge();

    if (!openclawBridge) {
      console.log('[Relay Server] ⚠️ 未找到可用的 OpenClaw Bridge');

      socket.emit('bot_message', {
        content: 'AI 助手离线。请确保本地电脑运行着 openclaw-bridge.js',
        contentType: 'text',
        timestamp: Date.now(),
        error: true,
        messageId: messageId
      });
      return;
    }

    // 转发消息到本地 Bridge
    console.log(`[Relay Server] 📤 转发消息到 OpenClaw Bridge...`);
    openclawBridge.emit('app_message', data);
  });

  // ==================== 辅助函数 ====================

  function findOpenClawBridge() {
    // 查找连接的 OpenClaw Bridge
    const sockets = Array.from(io.sockets.sockets.values());
    return sockets.find(s => s.deviceType === 'openclaw_bridge');
  }
});
```

---

### Step 4: App 端验证（5 分钟）

App 端代码无需修改，现有的 `ClawbotChannelBridge.ts` 已经实现了完整的 Socket.IO 通信。

#### 3.1 验证环境变量

**文件**: `e:\desktop\trix-3d-companion\.env`

```bash
# Clawbot Channel Relay Server
VITE_CLAWBOT_CHANNEL_URL=wss://m.jmtrick.com
# 或使用测试服务器
# VITE_CLAWBOT_CHANNEL_URL=ws://TRIX_SERVER_HOST:8765
```

#### 3.2 测试连接

```bash
# 启动 Web App
cd e:\desktop\trix-3d-companion
npm run dev
```

**测试步骤**：

1. 打开浏览器访问 http://localhost:5173
2. 进入 Clawbot 聊天页面
3. 发送消息: "你好 OpenClaw"
4. **预期**: <1 秒内收到响应

---

### Step 4: 测试验证（8 分钟）

#### 4.1 Relay Server 测试

**测试 OpenClaw Gateway 连接**：

```bash
# 在 Relay Server 所在服务器上运行
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Authorization: Bearer __GATEWAY_AUTH_TOKEN_REDACTED__" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "zai/glm-4.7",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

**预期响应**：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "zai/glm-4.7",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是 OpenClaw 助手，有什么可以帮助你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

#### 4.2 端到端测试

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 基础对话 | 发送"你好" | <1 秒收到问候回复 |
| 复杂问题 | 发送"帮我分析这段代码" | 收到有意义的分析 |
| 上下文记忆 | 连续提问"他的名字是什么？" | AI 记住之前的对话内容 |
| 长文本 | 发送 500 字以上长文本 | 正常处理并响应 |
| 超时处理 | 发送后立即断开网络 | 显示友好的错误提示 |

---

## 故障排查

### 问题 1: 本地 Bridge 无法连接云端 Relay Server

**症状**：

```
[Bridge] ❌ 连接失败: connect ECONNREFUSED
```

**解决方案**：

1. 检查云端 Relay Server 是否在线
2. 确认 RELAY_SERVER_URL 配置正确（`wss://m.jmtrick.com` 或 `ws://TRIX_SERVER_HOST:8765`）
3. 检查本地网络是否正常
4. 检查防火墙是否阻止出站连接

### 问题 2: OpenClaw Gateway 无响应

**症状**:

```
```
Error: connect ECONNREFUSED 127.0.0.1:18789
```

**解决方案**：
1. 检查 OpenClaw 是否运行: `openclaw-cn`
2. 检查端口: `netstat -ano | findstr :18789`
3. 检查防火墙设置

### 问题 3: 认证失败

**症状**：

```text
Error: Authentication failed (401)
```

**解决方案**：

1. 验证 Token 是否正确
2. 检查 Gateway 配置文件
3. 确保 Authorization Header 格式正确: `Bearer {token}`

### 问题 4: 响应超时

**症状**：

- 消息发送成功，但 30 秒后显示超时

**解决方案**：

1. 检查 AI 模型是否正常工作
2. 增加超时时间: `timeout: 60000`
3. 检查网络连接
4. 查看重试机制是否已触发（默认 3 次重试，每次间隔 500ms）

### 问题 5: AI 无上下文记忆

**症状**：

- AI 每次都像第一次对话，不记得之前的内容

**解决方案**：

- 确保本地 Bridge 每次调用时**只发送最新的消息**
- OpenClaw Gateway 会自动维护上下文历史
- 不要在 `messages` 数组中重复发送历史消息

### 问题 6: 网络可达性问题（⚠️ 重要）

**症状**：

- 云端 Relay Server 报错：`connect ECONNREFUSED 127.0.0.1:18789`
- App 显示"AI 助手离线"

**原因**：

- 云端 Relay Server **无法直接访问**你本地电脑的 `localhost:18789`
- 这是正常的网络隔离现象

**正确解决方案**：

1. 确保本地电脑运行了 `openclaw-bridge.js` 进程
2. Bridge 进程会主动连接云端 Relay Server
3. 检查 Bridge 日志：`pm2 logs openclaw-bridge`
4. 确保 Bridge 日志显示：`[Bridge] ✅ 已连接到云端 Relay Server`

**不要尝试**：

- ❌ 在云端 Relay Server 上配置 `localhost:18789`（这是错误的）
- ❌ 尝试从云端访问本地 IP（这是不可达的）

---

## 高级配置

### 1. 启用流式输出

**本地 Bridge 端修改**：

```javascript
// 在 openclaw-bridge.js 中添加流式输出支持

async function callOpenClawGatewayStream(message, socket) {
  try {
    const response = await axios.post(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        model: "zai/glm-4.7",
        messages: [{ role: "user", content: message }],
        stream: true  // 启用流式输出
      },
      {
        responseType: 'stream',  // 接收流式响应
        headers: {
          'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    // 处理流式数据
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          if (jsonStr === '[DONE]') {
            // 流式输出完成
            socket.emit('bot_message_stream', {
              delta: '',
              done: true
            });
            return;
          }

          try {
            const json = JSON.parse(jsonStr);
            if (json.choices && json.choices[0].delta.content) {
              // 实时发送到云端
              socket.emit('bot_message_stream', {
                delta: json.choices[0].delta.content,
                done: false
              });
            }
          } catch (e) {
            // 忽略 JSON 解析错误
          }
        }
      }
    });

  } catch (error) {
    console.error('[Bridge] 流式输出失败:', error.message);
    throw error;
  }
}
```

**App 端接收流式消息**：

```typescript
// ClawbotChannelBridge.ts
this.socket.on('bot_message_stream', (data) => {
  const { delta, done } = data;

  if (delta) {
    // 追加增量内容
    this.emit('message_delta', delta);
  }

  if (done) {
    // 流式输出完成
    this.emit('message_complete');
  }
});
```

### 2. 支持任务中断

**本地 Bridge 端添加中断接口**：

```javascript
// 在 openclaw-bridge.js 中添加中断功能

async function interruptOpenClaw() {
  try {
    await axios.post(
      `${OPENCLAW_GATEWAY_URL}/v1/interrupt`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`
        }
      }
    );
    console.log('[Bridge] ✅ OpenClaw 任务已中断');
  } catch (error) {
    console.error('[Bridge] ❌ 中断失败:', error);
  }
}

// 监听来自云端的中断请求
socket.on('interrupt_task', async () => {
  await interruptOpenClaw();
  socket.emit('task_interrupted');
});
```

### 3. 多用户会话隔离

OpenClaw Gateway 自动为每个连接维护独立的会话上下文。

**Relay Server 端实现用户隔离**：

```javascript
// 为每个用户维护独立的会话
const userSessions = new Map();

async function callOpenClawGateway(userId, message) {
  // 获取或创建用户会话
  let session = userSessions.get(userId);

  if (!session) {
    session = {
      messages: [],
      createdAt: Date.now()
    };
    userSessions.set(userId, session);
  }

  // 添加当前消息
  session.messages.push({
    role: 'user',
    content: message
  });

  // 调用 Gateway
  const response = await axios.post(
    `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
    {
      model: 'zai/glm-4.7',
      messages: session.messages,  // 发送完整历史
      stream: false
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`
      }
    }
  );

  // 保存助手响应
  const assistantMessage = response.data.choices[0].message.content;
  session.messages.push({
    role: 'assistant',
    content: assistantMessage
  });

  return assistantMessage;
}
```

---

## 与旧方案对比

| 维度 | 旧方案（文件轮询/Skill 主动查询） | 新方案（Gateway API Bridge） |
|------|----------------------------------|------------------------------|
| **延迟** | 3-5 秒 | <200ms |
| **架构** | App → Relay → 文件 → Skill 轮询 | App → Relay → Bridge → HTTP → Gateway |
| **网络** | ✅ 无需本地进程 | ⚠️ 需要本地 Bridge 进程 |
| **上下文** | ❌ Skill 无法记住历史 | ✅ Gateway 自动维护 |
| **Token 消耗** | ❌ 轮询空转浪费 | ✅ 精准消耗 |
| **流式输出** | ❌ 不支持 | ✅ 支持 |
| **任务中断** | ❌ 不支持 | ✅ 支持 |
| **错误处理** | ❌ 简单超时 | ✅ 自动重试（3次） |
| **代码量** | 500+ 行（Skill + Relay） | 200 行（Bridge + Relay） |
| **维护成本** | 高 | 低 |

---

## 参考资料

### OpenClaw 官方文档
- 官网: https://clawd.org.cn/
- GitHub: https://github.com/openclaw/openclaw
- Gateway 协议文档: https://docs.openclaw.ai/
- OpenAI 兼容接口: https://docs.openclaw.ai/openai-api

### 项目文档
| 文档 | 路径 |
|------|------|
| 三端架构文档 | `e:\desktop\trix-3d-companion\docs\三端接通架构文档.md` |
| OpenClaw 接入方案 | `e:\desktop\trix-3d-companion\docs\OpenClaw最佳接入方案-MVP.md` |
| Nanobot 云端实现 | `e:\desktop\nanobot\nanobot\CLOUD_SERVER_AND_APP_IMPLEMENTATION.md` |

### 关键文件
| 文件 | 路径 |
|------|------|
| OpenClaw Bridge | `e:\desktop\trix-3d-companion\bridge\openclaw-bridge.js` |
| ClawbotChannelBridge | `e:\desktop\trix-3d-companion\src\services\ClawbotChannelBridge.ts` |
| OpenClaw 配置 | `C:\Users\wang\.openclaw\openclaw.json` |
| Nanobot Relay | `e:\desktop\nanobot\nanobot\web_interface_final.py` |

---

## 总结

### 核心要点

1. **网络架构修正**: 云端 Relay Server 无法访问本地 localhost，必须使用本地 Bridge 进程
2. **本地 Bridge 模式**: Bridge 主动连接云端，接收消息后调用本地 OpenClaw Gateway API
3. **事件驱动架构**: 服务器收到消息立即推送到本地 Bridge，<200ms 响应
4. **自动重试机制**: API 调用失败时自动重试 3 次，间隔 500ms，提升稳定性
5. **自动上下文**: Gateway 自动维护对话历史

### 实施优先级

1. ✅ **立即执行**（25 分钟）:
   - 启动 OpenClaw Gateway (2 分钟)
   - 创建并启动本地 Bridge 进程 (10 分钟)
   - 配置云端 Relay Server (5 分钟)
   - 测试端到端通信 (8 分钟)

2. ⬜ **后续优化**（1 小时）:
   - 添加流式输出支持
   - 实现任务中断功能
   - 完善错误处理和日志

### 关键注意事项

- ⚠️ **网络可达性**: 云端服务器无法直接访问本地 localhost，必须使用本地 Bridge 进程
- ⚠️ **Bridge 运行**: 本地电脑必须始终运行 `openclaw-bridge.js` 进程（建议使用 PM2 后台运行）
- ⚠️ **防火墙**: 确保本地电脑能出站连接到云端 Relay Server（wss://m.jmtrick.com）
- ✅ **自动重试**: API 调用失败时会自动重试 3 次，提升稳定性

---

**方案完成！** 🎉

这是基于 OpenClaw 官方 Gateway API 的**事件驱动 PUSH 模式 + 本地 Bridge**集成方案，彻底解决文件轮询的低效问题和网络可达性问题。

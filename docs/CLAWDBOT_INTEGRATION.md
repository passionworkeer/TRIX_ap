# 🔌 Clawdbot Gateway 集成文档

## 概览

TRIX 前端现已通过 WebSocket 连接到本地 **Clawdbot Gateway**,实现实时 AI 对话功能。

---

## 🏗️ 架构

```
┌─────────────────┐
│   React App     │
│   (Frontend)    │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│ Clawdbot Gateway│
│  (Local Server) │
│   Port: 18789   │
└─────────────────┘
```

---

## ⚙️ 配置

### 环境变量 (`.env`)

```env
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
VITE_PC_AUTH_TOKEN=8be65c12303f8c35340d9c8cedffa5e61109cbe600c0b772
```

**获取方式:**
- `VITE_PC_WEBSOCKET_URL`: Clawdbot Gateway 的 WebSocket 地址
- `VITE_PC_AUTH_TOKEN`: Gateway 提供的认证令牌

---

## 📡 Clawdbot Gateway 协议

### 1. 认证流程

**连接建立后立即发送:**

```json
{
  "action": "auth",
  "token": "YOUR_AUTH_TOKEN_HERE"
}
```

**预期响应:**

```json
{
  "action": "auth",
  "status": "ok"
}
```

或错误:

```json
{
  "action": "auth",
  "status": "error",
  "error": "Invalid token"
}
```

---

### 2. 发送消息 (RPC 格式)

**请求:**

```json
{
  "action": "message.send",
  "params": {
    "message": "用户输入的消息"
  }
}
```

---

### 3. 接收消息

**响应示例:**

```json
{
  "result": "AI 代理的回复内容",
  "status": "ok"
}
```

或包含 `text`/`message` 字段:

```json
{
  "text": "AI 代理的回复"
}
```

**错误响应:**

```json
{
  "error": "错误描述",
  "status": "error"
}
```

---

## 🔧 前端实现

### 核心 Hook: `usePCConnection`

**位置:** `src/hooks/usePCConnection.ts`

**功能:**
- ✅ WebSocket 连接管理
- ✅ 自动认证
- ✅ 自动重连 (最多 5 次,间隔 3 秒)
- ✅ 连接状态追踪
- ✅ 消息收发

**使用示例:**

```typescript
import { usePCConnection } from '../hooks/usePCConnection';

const { status, sendMessage, lastMessage, isConnected } = usePCConnection();

// 连接状态
status // 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'CONNECTED' | 'AUTH_FAILED' | 'ERROR'

// 发送消息
sendMessage('用户输入的文本');

// 接收最新消息
useEffect(() => {
  if (lastMessage) {
    console.log('收到回复:', lastMessage);
  }
}, [lastMessage]);
```

---

### 连接状态

| 状态 | 描述 | 显示 |
|------|------|------|
| `DISCONNECTED` | 未连接 | ⚪ 离线 |
| `CONNECTING` | 连接中 | 🟡 连接中 |
| `AUTHENTICATING` | 认证中 | 🟡 认证中 |
| `CONNECTED` | 已连接 | 🟢 已连接 |
| `AUTH_FAILED` | 认证失败 | 🔴 认证失败 |
| `ERROR` | 连接错误 | 🔴 错误 |

---

## 🎨 UI 集成

### Chat.tsx (聊天列表)

**功能:**
- 显示 Clawdbot Gateway 连接状态
- 实时状态指示器 (绿/黄/红点)
- 点击进入聊天界面

**关键代码:**

```typescript
const { status, isConnected } = usePCConnection();

<div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
<span>{getStatusText()}</span>
```

---

### ChatDetail.tsx (聊天界面)

**功能:**
- 发送用户消息
- 显示 AI 回复
- 连接状态横幅
- 禁用输入(未连接时)

**消息流程:**

```
1. 用户输入 → handleSend()
2. 添加到 UI → setMessages()
3. 通过 WebSocket 发送 → sendMessage(text)
4. 等待回复 → lastMessage 更新
5. 显示 AI 回复 → useEffect() 自动添加
```

---

## 🧪 测试步骤

### 1. 启动 Clawdbot Gateway

确保 Gateway 服务运行在 `ws://192.168.101.4:18789`

### 2. 启动前端

```bash
npm run dev
```

### 3. 检查连接状态

1. 打开聊天页面
2. 查看 "Clawdbot Gateway" 卡片
3. 状态应显示: 🟢 已连接

### 4. 发送测试消息

1. 点击进入聊天界面
2. 输入任意消息
3. 查看 AI 回复

### 5. 检查控制台日志

```
✅ WebSocket connected, sending authentication...
📤 Auth packet sent
📥 Received from server: {action: "auth", status: "ok"}
✅ Authentication successful - Gateway ready
📤 Sending message: {action: "message.send", params: {...}}
📥 Received from server: {result: "..."}
💬 Message content: ...
```

---

## 🐛 故障排除

### 问题 1: 连接失败

**症状:** 状态显示 "🔴 错误" 或 "⚪ 离线"

**检查:**
- [ ] Gateway 是否正在运行?
- [ ] IP 地址和端口是否正确?
- [ ] 防火墙是否阻止?
- [ ] `.env` 文件是否存在?

**解决方案:**
```bash
# 检查 Gateway 状态
# 确认 Gateway 运行在正确的端口

# 验证环境变量
Get-Content .env

# 重启前端
npm run dev
```

---

### 问题 2: 认证失败

**症状:** 状态显示 "🔴 认证失败"

**检查:**
- [ ] `VITE_PC_AUTH_TOKEN` 是否正确?
- [ ] Token 是否过期?

**解决方案:**
```bash
# 更新 .env 中的 Token
VITE_PC_AUTH_TOKEN=新的Token

# 重启前端 (必须)
npm run dev
```

---

### 问题 3: 发送消息无响应

**症状:** 消息发送后无 AI 回复

**检查:**
- [ ] 连接状态是否为 "🟢 已连接"?
- [ ] 控制台是否有错误?
- [ ] Gateway 是否正常处理消息?

**调试:**

打开浏览器控制台,查看:
```
📤 Sending message: {...}  // 应该出现
📥 Received from server: {...}  // 等待出现
```

---

### 问题 4: 频繁断线重连

**症状:** 连接状态在 "🟡 连接中" 和 "⚪ 离线" 间切换

**原因:**
- 网络不稳定
- Gateway 重启
- Token 无效

**解决方案:**
- 检查网络连接
- 确认 Gateway 稳定运行
- 验证 Token 有效性

---

## 📊 协议消息示例

### 完整对话流程

**1. 连接:**
```
Client → Server (WebSocket 握手)
```

**2. 认证:**
```json
Client → Server:
{
  "action": "auth",
  "token": "8be65c12303f8c35340d9c8cedffa5e61109cbe600c0b772"
}

Server → Client:
{
  "action": "auth",
  "status": "ok"
}
```

**3. 发送消息:**
```json
Client → Server:
{
  "action": "message.send",
  "params": {
    "message": "你好,请帮我整理桌面文件"
  }
}

Server → Client:
{
  "result": "好的,我会帮你整理桌面文件。正在扫描...",
  "status": "ok"
}
```

---

## 🔒 安全注意事项

⚠️ **当前配置仅适用于本地开发**

**生产环境需要:**
- ✅ 使用 WSS (WebSocket Secure)
- ✅ Token 定期轮换
- ✅ 添加请求签名
- ✅ 实现速率限制
- ✅ IP 白名单

---

## 📝 类型定义

```typescript
// 连接状态
type ConnectionStatus = 
  | 'DISCONNECTED'   // 未连接
  | 'CONNECTING'     // 连接中
  | 'AUTHENTICATING' // 认证中
  | 'CONNECTED'      // 已连接
  | 'AUTH_FAILED'    // 认证失败
  | 'ERROR';         // 错误

// Hook 返回值
interface UsePCConnectionReturn {
  status: ConnectionStatus;      // 连接状态
  sendMessage: (text: string) => void;  // 发送消息
  lastMessage: string | null;    // 最新消息
  connect: () => void;           // 手动连接
  disconnect: () => void;        // 断开连接
  isConnected: boolean;          // 是否已连接
}
```

---

## 🚀 下一步开发

### 短期目标
- [ ] 支持流式响应 (`agent.turn.stream`)
- [ ] 添加消息历史记录
- [ ] 实现打字指示器

### 中期目标
- [ ] 支持文件上传
- [ ] 语音输入
- [ ] Markdown 渲染

### 长期目标
- [ ] 多会话管理
- [ ] 离线消息队列
- [ ] 端到端加密

---

## 📞 联系支持

**遇到问题?**
1. 查看控制台日志
2. 检查 Gateway 日志
3. 参考本文档故障排除部分

**开发者工具:**
- Chrome DevTools → Network → WS (查看 WebSocket 消息)
- Console (查看日志)

---

**集成完成! 🎉**

TRIX 现已成功连接到 Clawdbot Gateway,可以进行实时 AI 对话。

# WebSocket 重构说明

## ✅ 已完成

### 问题 1: 连接在切换页面时断开 - 已解决
- ✅ 创建了全局 `WebSocketContext` (`src/contexts/WebSocketContext.tsx`)
- ✅ WebSocket 连接现在是全局单例，绑定到 App 生命周期
- ✅ 在 `App.tsx` 中包裹了 `WebSocketProvider`
- ✅ 切换页面时连接保持活跃（长连接）

### 问题 2: 消息解析错误 - 已解决
- ✅ 实现了智能消息过滤，忽略系统噪音：
  - 过滤 `tick`, `health`, `heartbeat`, `connect.challenge`
  - 过滤 `stream: lifecycle` 生命周期消息
  - 过滤 `status: accepted` 确认消息
- ✅ 提取有效文本内容：
  - 优先提取 `payload.stream === 'assistant'` 的 `data.delta` (流式增量)
  - 或提取 `data.text` (完整文本)
  - 支持多种消息格式的回退
- ✅ 累积流式回复到 `fullResponse` 提供给 UI

### 配置要求 - 已严格遵守
```typescript
{
  id: 'clawdbot-ios',      // ✅ 必须
  mode: 'webchat',          // ✅ 必须
  platform: 'ios',          // ✅ 必须
  role: 'operator',         // ✅ 必须
  auth: { token: AUTH_TOKEN } // ✅ 从环境变量读取
}
```

### 发送消息 - 包含 idempotencyKey
```typescript
{
  type: 'req',
  id: generateId(),
  method: 'agent',
  params: {
    message: text,
    to: 'self',
    idempotencyKey: `${Date.now()}-${generateId()}` // ✅ 必须
  }
}
```

## 📁 修改的文件

1. **新建文件:**
   - `src/contexts/WebSocketContext.tsx` - 全局 WebSocket Context

2. **更新文件:**
   - `App.tsx` - 包裹 `WebSocketProvider`
   - `screens/ChatDetail.tsx` - 使用 `useGlobalConnection()` 替换 `usePCConnection()`
   - `screens/Home.tsx` - 使用 `useGlobalConnection()`
   - `screens/Chat.tsx` - 使用 `useGlobalConnection()`

3. **弃用文件:**
   - `src/hooks/usePCConnection.ts` - 保留但不再使用

## 🎯 使用方法

### 在任何组件中获取连接状态和发送消息

```typescript
import { useGlobalConnection } from '../src/contexts/WebSocketContext';

function MyComponent() {
  const { 
    status,        // ConnectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR'
    fullResponse,  // 完整的 AI 回复文本（累积后的）
    sendMessage,   // 发送消息函数
    isConnected    // 布尔值，是否已连接
  } = useGlobalConnection();

  const handleSend = () => {
    sendMessage('你好，AI！');
  };

  return (
    <div>
      <div>状态: {status}</div>
      <div>回复: {fullResponse}</div>
      <button onClick={handleSend}>发送</button>
    </div>
  );
}
```

## 🔍 消息处理逻辑

### 接收消息的优先级顺序：

1. **握手确认** - `type: 'res'`, `payload.type: 'hello-ok'` → 设置为 CONNECTED
2. **系统心跳** - `event: 'tick' | 'health' | 'heartbeat' | 'connect.challenge'` → 忽略
3. **请求确认** - `payload.status: 'accepted'` → 忽略
4. **生命周期** - `payload.stream: 'lifecycle'` → 忽略并记录日志
5. **AI 回复** - 提取以下字段之一：
   - `payload.stream === 'assistant'` 且 `payload.data.delta` → 流式增量 ✅
   - `payload.stream === 'assistant'` 且 `payload.data.text` → 完整文本 ✅
   - `payload.stream === 'text'` 且 `payload.data` → 通用文本流
   - `payload.message` → 直接消息
   - `payload.text` → 纯文本字段

### 回复结束检测：

- `payload.data.done === true` → 回复完成
- `payload.stream === 'done'` → 回复完成

## 🚀 启动流程

1. 启动 Clawdbot Gateway:
   ```bash
   openclaw-cn gateway
   ```

2. 启动前端:
   ```bash
   npm run dev
   ```

3. WebSocket 会自动连接到 `VITE_PC_WEBSOCKET_URL` (默认: `ws://192.168.101.4:18789`)

## 📊 连接状态

- `DISCONNECTED` - 未连接
- `CONNECTING` - 连接中
- `CONNECTED` - 已连接并握手成功
- `AUTH_FAILED` - 认证失败
- `ERROR` - 连接错误

## 🔄 自动重连

- 最大重连次数: 10 次
- 重连间隔: 3 秒
- 正常关闭（code 1000/1001/1005）不会重连
- 异常断开会自动尝试重连

## ⚠️ 注意事项

1. **环境变量必须配置:**
   - `VITE_PC_WEBSOCKET_URL` - Gateway WebSocket 地址
   - `VITE_PC_AUTH_TOKEN` - 认证 Token

2. **不要修改连接参数:**
   - `id: 'clawdbot-ios'` - 硬编码，网关要求
   - `mode: 'webchat'` - 硬编码，网关要求
   - `platform: 'ios'` - 硬编码，网关要求
   - `role: 'operator'` - 硬编码，网关要求

3. **发送消息必须包含 idempotencyKey:**
   - 格式: `${Date.now()}-${randomId}`
   - 否则网关会拒绝请求

4. **旧的 usePCConnection 已弃用:**
   - 不要在新代码中使用
   - 现有使用已全部替换为 `useGlobalConnection`

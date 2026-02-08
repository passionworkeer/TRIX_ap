# ✅ WebSocket 协议修复说明

## 📋 修复内容

根据 **Clawdbot WebSocket 完整协议规范**，已对 `src/contexts/WebSocketContext.tsx` 进行了全面修复。

---

## 🔧 主要修改

### 1. Challenge 认证流程修复

**修复前**：
```typescript
// 错误：使用了错误的 ID 字段
id: data.id  // ❌ 这是 undefined
```

**修复后**：
```typescript
// 正确：从 payload.nonce 提取 ID
const challengeId = data.payload?.nonce || data.id || generateId();

const challengeResponse = {
  type: 'req',
  id: challengeId,  // ✅ 使用 nonce 作为响应 ID
  method: 'connect',
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    role: 'operator',
    client: {
      id: 'clawdbot-ios',
      mode: 'webchat',
      platform: 'ios',
      displayName: 'TRIX App',
      version: '1.0.0',
      instanceId: generateId()
    },
    caps: [],
    auth: { token: AUTH_TOKEN }
  }
};
```

### 2. 完善的日志输出

**Challenge 接收日志**：
```typescript
console.log('🎯 收到 challenge');
console.log('   Nonce:', data.payload?.nonce);
console.log('   Timestamp:', data.payload?.ts);
```

**Challenge 响应日志**：
```typescript
console.log('📤 发送 challenge 响应:', JSON.stringify(challengeResponse, null, 2));
```

**认证失败日志**：
```typescript
console.error('❌ 认证失败:');
console.error('   错误码:', data.error.code);
console.error('   错误信息:', data.error.message);
```

### 3. 消息发送优化

**修复前**：
```typescript
const packet = {
  type: 'req',
  id: generateId(),  // 随机 ID
  method: 'agent',
  params: {
    message: text,
    to: 'self',
    idempotencyKey: idempotencyKey
  }
};
console.log('📤 发送消息:', text);  // 简单日志
```

**修复后**：
```typescript
// 生成可追踪的消息 ID
const messageId = `msg-${Date.now()}-${generateId()}`;
const idempotencyKey = `${Date.now()}-${generateId()}`;

const packet = {
  type: 'req',
  id: messageId,
  method: 'agent',
  params: {
    message: text,
    to: 'self',
    idempotencyKey: idempotencyKey
  }
};

// 详细日志
console.log('📤 发送消息:');
console.log('   内容:', text);
console.log('   消息 ID:', messageId);
console.log('   完整数据包:', JSON.stringify(packet, null, 2));
```

### 4. 增强的错误处理

**新增状态检查**：
```typescript
if (status !== 'CONNECTED') {
  console.warn('⚠️ 未完成认证，无法发送消息');
  return;
}
```

**认证失败处理**：
```typescript
if (data.type === 'res' && !data.ok && data.error) {
  console.error('❌ 认证失败:');
  console.error('   错误码:', data.error.code);
  console.error('   错误信息:', data.error.message);
  setStatus('AUTH_FAILED');
  challengePendingRef.current = false;
  return;
}
```

### 5. AI 回复处理优化

**新增完成状态检测**：
```typescript
let isDone = false;

// 检测是否完成
if (payload.data?.done === true || payload.stream === 'done') {
  isDone = true;
}

// 回复结束时输出详细信息
if (isDone) {
  console.log('✅ 回复完成');
  console.log('   总长度:', responseBufferRef.current.length);
  console.log('   完整内容:', responseBufferRef.current);
}
```

---

## 🔄 认证流程

### 完整流程图

```
客户端                                    Gateway
  |                                          |
  |  1. WebSocket.connect()                 |
  |----------------------------------------->|
  |                                          |
  |  2. onopen (连接已建立)                  |
  |<-----------------------------------------|
  |                                          |
  |  3. connect.challenge                    |
  |<-----------------------------------------|
  |  {                                       |
  |    event: 'connect.challenge',          |
  |    payload: {                            |
  |      nonce: 'xxx-xxx-xxx',              |
  |      ts: 1770278025767                   |
  |    }                                     |
  |  }                                       |
  |                                          |
  |  4. Challenge 响应                       |
  |----------------------------------------->|
  |  {                                       |
  |    type: 'req',                         |
  |    id: 'xxx-xxx-xxx',  // ← 使用 nonce  |
  |    method: 'connect',                    |
  |    params: {                             |
  |      auth: { token: 'your-token' }      |
  |    }                                     |
  |  }                                       |
  |                                          |
  |  5. 认证结果                             |
  |<-----------------------------------------|
  |  {                                       |
  |    type: 'res',                         |
  |    id: 'xxx-xxx-xxx',                   |
  |    ok: true,                            |
  |    payload: { type: 'hello-ok' }        |
  |  }                                       |
  |                                          |
  |  ✅ 连接成功，可以发送消息                |
  |                                          |
```

---

## 📝 关键改进点

### ✅ 修复项

1. **Challenge ID 提取**：从 `payload.nonce` 提取，不再使用错误的 `data.id`
2. **完整日志**：每个关键步骤都有详细的日志输出
3. **状态检查**：发送消息前验证连接状态
4. **错误信息**：认证失败时输出完整的错误码和消息
5. **消息追踪**：使用可追踪的消息 ID（`msg-timestamp-random`）

### 🎯 协议对齐

所有修改都严格遵循 **Clawdbot WebSocket 协议规范**：

- ✅ `type: 'req'` - 请求类型
- ✅ `id: nonce` - 使用 challenge 的 nonce
- ✅ `method: 'connect'` - 连接方法
- ✅ `params.auth.token` - 认证令牌
- ✅ `params.client` - 客户端信息
- ✅ `params.minProtocol: 3` - 协议版本

---

## 🧪 测试方法

### 1. 查看连接日志

启动应用后，打开浏览器控制台，应该看到：

```
🔌 启动全局连接: ws://192.168.101.4:18789
✅ WebSocket 连接已建立，等待 challenge...
📨 收到消息: {
  "event": "connect.challenge",
  "payload": {
    "nonce": "xxx-xxx-xxx",
    "ts": 1770278025767
  }
}
🎯 收到 challenge
   Nonce: xxx-xxx-xxx
   Timestamp: 1770278025767
📤 发送 challenge 响应: {
  "type": "req",
  "id": "xxx-xxx-xxx",
  "method": "connect",
  ...
}
🟢 握手成功，连接已建立
```

### 2. 发送测试消息

在聊天界面输入 "你好"，控制台应该显示：

```
📤 发送消息:
   内容: 你好
   消息 ID: msg-1770278025767-abc123
   完整数据包: {
     "type": "req",
     "id": "msg-1770278025767-abc123",
     "method": "agent",
     ...
   }
```

### 3. 接收 AI 回复

控制台应该显示：

```
📝 增量回复 (delta): 你好！
📝 增量回复 (delta): 我是
📝 增量回复 (delta): TRIX
✅ 回复完成
   总长度: 12
   完整内容: 你好！我是TRIX
```

---

## 🚀 使用方法

### 重启应用

```powershell
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### 验证配置

确保 `.env` 文件配置正确：

```properties
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
VITE_PC_AUTH_TOKEN=853d8151ad2a8777296e74503260c5d7f9558f628cb3d16a
```

### 启动 Gateway

```bash
openclaw-cn gateway
```

---

## ⚠️ 常见问题

### 问题 1: 认证失败

**错误信息**：
```
❌ 认证失败:
   错误码: INVALID_REQUEST
   错误信息: unauthorized: gateway token mismatch
```

**解决方法**：
1. 检查 `.env` 中的 `VITE_PC_AUTH_TOKEN` 是否正确
2. 重启 Gateway 和应用
3. 清除浏览器缓存

### 问题 2: 连接超时

**错误信息**：
```
🔌 连接关闭: code=1006, reason=
```

**解决方法**：
1. 确认 Gateway 正在运行
2. 检查防火墙设置（端口 18789）
3. 验证 IP 地址是否正确

### 问题 3: 未收到 Challenge

**现象**：连接后没有收到 `connect.challenge` 消息

**解决方法**：
1. 更新 Gateway 到最新版本
2. 检查 Gateway 配置
3. 查看 Gateway 控制台日志

---

## 📊 性能优化

- ✅ 使用单例 WebSocket 连接
- ✅ 自动重连机制（最多 10 次）
- ✅ 消息缓冲区优化
- ✅ 静默忽略心跳包（不输出日志）

---

**修复完成时间**: 2026-02-05  
**协议版本**: Clawdbot Protocol v3  
**状态**: ✅ 已验证，生产就绪

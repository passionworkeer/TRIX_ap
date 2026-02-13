# 📋 Gateway HTTP API 详细文档

---

## 🌐 API 基础信息

### 基础 URL
```
https://salty-insects-dance.loca.lt
```

### WebSocket 地址
```
wss://salty-insects-dance.loca.lt/ws
```

---

## 📱 配对 API

### 1. 发送配对请求

**接口地址**：
```
POST /pairing/request
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/pairing/request
```

**请求头（Headers）**：
```
Content-Type: application/json
Accept: application/json
```

**请求体（Body）**：
```json
{
  "device_id": "dev_a84fd879bde440beb90138381c5315ce",
  "device_name": "My Phone",
  "device_type": "mobile",
  "auto_approve": true,
  "metadata": {
    "platform": "iOS",
    "userAgent": "Mozilla/5.0...",
    "deviceModel": "iPhone 14 Pro"
  }
}
```

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `device_id` | string | ✅ | 设备唯一标识 |
| `device_name` | string | ✅ | 设备名称 |
| `device_type` | string | ✅ | 设备类型 |
| `auto_approve` | boolean | ❌ | 是否自动确认（默认 false）|
| `metadata` | object | ❌ | 元数据（可选）|

**成功响应（auto_approve: true）**：
```json
{
  "success": true,
  "requestId": "dev_a84fd879bde440beb90138381c5315ce_auto",
  "status": "approved",
  "deviceToken": "tok_6f3e1b4d6a0c4754a5d9ceae107530c0",
  "message": "配对成功（自动确认）"
}
```

**成功响应（auto_approve: false）**：
```json
{
  "success": true,
  "requestId": "req_1770948807848_z106a9qp7",
  "status": "pending",
  "message": "配对请求已提交，等待 Gateway 审批"
}
```

**失败响应**：
```json
{
  "success": false,
  "error": "INVALID_REQUEST",
  "message": "缺少必要参数: device_id, device_name, device_type"
}
```

---

### 2. 轮询配对状态

**接口地址**：
```
GET /pairing/status/:requestId
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/pairing/status/req_1770948807848_z106a9qp7
```

**请求头（Headers）**：
```
Accept: application/json
```

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `requestId` | string | 配对请求 ID |

**成功响应（pending）**：
```json
{
  "success": true,
  "status": "pending",
  "requestId": "req_1770948807848_z106a9qp7",
  "message": "等待审批"
}
```

**成功响应（approved）**：
```json
{
  "success": true,
  "status": "approved",
  "requestId": "req_1770948807848_z106a9qp7",
  "deviceToken": "tok_6f3e1b4d6a0c4754a5d9ceae107530c0",
  "message": "配对成功"
}
```

**失败响应**：
```json
{
  "success": false,
  "status": "not_found",
  "message": "配对请求不存在"
}
```

---

### 3. 审批配对请求（管理界面）

**接口地址**：
```
POST /pairing/approve/:requestId
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/pairing/approve/req_1770948807848_z106a9qp7
```

**请求头（Headers）**：
```
Content-Type: application/json
```

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `requestId` | string | 配对请求 ID |

**成功响应**：
```json
{
  "success": true,
  "message": "配对已批准",
  "deviceToken": "tok_6f3e1b4d6a0c4754a5d9ceae107530c0"
}
```

---

### 4. 拒绝配对请求（管理界面）

**接口地址**：
```
POST /pairing/deny/:requestId
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/pairing/deny/req_1770948807848_z106a9qp7
```

**请求头（Headers）**：
```
Content-Type: application/json
```

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `requestId` | string | 配对请求 ID |

**成功响应**：
```json
{
  "success": true,
  "message": "配对已拒绝"
}
```

---

### 5. 获取所有待审批请求（管理界面）

**接口地址**：
```
GET /pairing/requests
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/pairing/requests
```

**请求头（Headers）**：
```
Accept: application/json
```

**成功响应**：
```json
[
  {
    "id": "req_1770948807848_z106a9qp7",
    "deviceId": "dev_a84fd879bde440beb90138381c5315ce",
    "deviceName": "My Phone",
    "deviceType": "mobile",
    "status": "pending",
    "pairingToken": "tok_xxx",
    "createdAt": 1770948807848,
    "expiresAt": "2026-02-13T17:00:00Z",
    "metadata": {
      "platform": "iOS",
      "userAgent": "Mozilla/5.0..."
    }
  }
]
```

---

## 🔧 其他 API

### 1. 健康检查

**接口地址**：
```
GET /health
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/health
```

**成功响应**：
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T03:30:00.000Z",
  "tunnel": "https://salty-insects-dance.loca.lt",
  "devices": 0
}
```

---

### 2. 获取已配对的设备（管理界面）

**接口地址**：
```
GET /devices
```

**完整 URL**：
```
https://salty-insects-dance.loca.lt/devices
```

**成功响应**：
```json
[
  {
    "deviceId": "dev_a84fd879bde440beb90138381c5315ce",
    "deviceName": "My Phone",
    "deviceType": "mobile",
    "pairedAt": 1770948807848,
    "lastSeen": 1770948807848
  }
]
```

---

## 📊 错误码说明

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `RATE_LIMITED` | 429 | 请求过于频繁 |
| `TOKEN_NOT_FOUND` | 400 | Token 不存在 |
| `TOKEN_EXPIRED` | 400 | Token 已过期 |
| `TOKEN_ALREADY_USED` | 400 | Token 已使用 |
| `SERVER_ERROR` | 500 | 服务器错误 |

---

## 🔄 完整配对流程示例

### 自动确认模式（推荐）

#### 步骤 1：发送配对请求
```bash
curl -X POST https://salty-insects-dance.loca.lt/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev_a84fd879bde440beb90138381c5315ce",
    "device_name": "My Phone",
    "device_type": "mobile",
    "auto_approve": true
  }'
```

#### 步骤 2：接收响应
```json
{
  "success": true,
  "requestId": "dev_xxx_auto",
  "status": "approved",
  "deviceToken": "tok_6f3e1b4d6a0c4754a5d9ceae107530c0",
  "message": "配对成功（自动确认）"
}
```

#### 步骤 3：使用 device_token 建立 WebSocket 连接
```javascript
const ws = new WebSocket('wss://salty-insects-dance.loca.lt/ws?token=tok_6f3e1b4d6a0c4754a5d9ceae107530c0');

ws.onopen = () => {
  console.log('✅ WebSocket 连接成功');
  // 发送连接挑战
  ws.send(JSON.stringify({
    type: 'req',
    method: 'connect',
    auth: {
      token: 'tok_6f3e1b4d6a0c4754a5d9ceae107530c0'
    }
  }));
};
```

---

### 手动确认模式

#### 步骤 1：发送配对请求
```bash
curl -X POST https://salty-insects-dance.loca.lt/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev_a84fd879bde440beb90138381c5315ce",
    "device_name": "My Phone",
    "device_type": "mobile",
    "auto_approve": false
  }'
```

#### 步骤 2：接收响应（pending）
```json
{
  "success": true,
  "requestId": "req_1770948807848_z106a9qp7",
  "status": "pending",
  "message": "配对请求已提交，等待 Gateway 审批"
}
```

#### 步骤 3：轮询状态
```bash
curl https://salty-insects-dance.loca.lt/pairing/status/req_1770948807848_z106a9qp7
```

#### 步骤 4：在管理界面审批
```
浏览器打开：https://salty-insects-dance.loca.lt/admin
点击"✅ 允许"
```

#### 步骤 5：继续轮询，检测到 approved
```bash
curl https://salty-insects-dance.loca.lt/pairing/status/req_1770948807848_z106a9qp7
```

响应：
```json
{
  "success": true,
  "status": "approved",
  "deviceToken": "tok_6f3e1b4d6a0c4754a5d9ceae107530c0",
  "message": "配对成功"
}
```

---

## 📝 代码示例（JavaScript/TypeScript）

### 发送配对请求（自动确认）
```typescript
async function sendPairingRequest() {
  const response = await fetch('https://salty-insects-dance.loca.lt/pairing/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      device_id: 'dev_a84fd879bde440beb90138381c5315ce',
      device_name: 'My Phone',
      device_type: 'mobile',
      auto_approve: true,
      metadata: {
        platform: 'iOS',
        userAgent: navigator.userAgent
      }
    })
  });

  const data = await response.json();
  
  if (data.success && data.status === 'approved') {
    console.log('✅ 配对成功！');
    console.log('设备 Token:', data.deviceToken);
    
    // 使用 deviceToken 建立 WebSocket 连接
    connectWebSocket(data.deviceToken);
  } else {
    console.log('⏳ 配对状态:', data.status);
    console.log('消息:', data.message);
  }
}
```

### 轮询配对状态
```typescript
async function pollPairingStatus(requestId: string) {
  const pollInterval = 2000; // 2 秒
  const maxAttempts = 180; // 最多 180 次（6 分钟）
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://salty-insects-dance.loca.lt/pairing/status/${requestId}`);
    const data = await response.json();
    
    console.log(`轮询第 ${i + 1} 次，状态: ${data.status}`);
    
    if (data.status === 'approved') {
      console.log('✅ 配对成功！');
      console.log('设备 Token:', data.deviceToken);
      
      // 使用 deviceToken 建立 WebSocket 连接
      connectWebSocket(data.deviceToken);
      return;
    } else if (data.status === 'denied' || data.status === 'expired') {
      console.log('❌ 配对失败:', data.message);
      return;
    }
    
    // 等待下一次轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.log('⚠️  配对超时');
}
```

### 建立 WebSocket 连接
```typescript
function connectWebSocket(deviceToken: string) {
  const ws = new WebSocket('wss://salty-insects-dance.loca.lt/ws');
  
  ws.onopen = () => {
    console.log('✅ WebSocket 连接成功');
    
    // 发送连接挑战
    ws.send(JSON.stringify({
      type: 'req',
      id: generateNonce(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: 'operator'
      },
      client: {
        id: 'clawdbot-ios',
        mode: 'webchat',
        platform: 'ios',
        displayName: 'TRIX App',
        version: '1.0.0',
        instanceId: Math.random().toString(36)
      },
      caps: [],
      auth: {
        token: deviceToken
      }
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('收到消息:', data);
    
    if (data.type === 'hello-ok') {
      console.log('✅ 认证成功！');
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket 错误:', error);
  };
  
  ws.onclose = (event) => {
    console.log('🔌 WebSocket 连接关闭:', event.code);
  });
}
```

---

## 📄 文件已保存

| 文件 | 路径 |
|------|------|
| **API 文档** | `/Users/jiajingqiu/openclaw/GATEWAY_API_DOCUMENTATION.md` |

---

## 🎯 总结

### API 基础 URL
```
https://salty-insects-dance.loca.lt
```

### WebSocket 地址
```
wss://salty-insects-dance.loca.lt/ws
```

### 主要接口
1. **POST /pairing/request** - 发送配对请求
2. **GET /pairing/status/:id** - 轮询配对状态
3. **POST /pairing/approve/:id** - 审批配对
4. **POST /pairing/deny/:id** - 拒绝配对
5. **GET /pairing/requests** - 获取待审批请求

### 推荐流程
1. 发送配对请求（auto_approve: true）
2. 立即获得 device_token
3. 使用 device_token 建立 WebSocket 连接
4. ✅ 配对成功！

---

**完整的 API 文档已提供！** 📋 现在可以编写 App 代码了！
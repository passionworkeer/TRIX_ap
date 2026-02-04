# TRIX App 与 Clawbot 对话核心原理及移动端部署分析

## 📡 核心通信原理

### 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        当前架构                               │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐                              ┌──────────────┐
│              │      WebSocket (ws://)       │              │
│  TRIX App    │◄────────────────────────────►│  Clawbot     │
│  (浏览器)     │   ws://192.168.101.4:18789   │  Gateway     │
│              │                              │              │
└──────────────┘                              └──────────────┘
      ▲                                              ▲
      │                                              │
      │ HTTP (加载页面)                               │ 调用 AI 模型
      │                                              │
      ▼                                              ▼
┌──────────────┐                              ┌──────────────┐
│              │                              │              │
│  Vite Server │                              │  GLM-4.7     │
│  :3000       │                              │  (本地模型)   │
│              │                              │              │
└──────────────┘                              └──────────────┘
```

### 2. 通信流程详解

#### 阶段 1: 加载应用
```
1. 用户访问: http://192.168.101.4:3000/
2. Vite Server 返回: index.html + React App (打包后的 JS)
3. 浏览器加载并运行 React 应用
```

#### 阶段 2: 建立 WebSocket 连接 (App 启动时)
```typescript
// 在 App.tsx 中，WebSocketProvider 自动启动
<WebSocketProvider>  // ← 全局 Context
  <App />
</WebSocketProvider>

// WebSocketContext.tsx 中
useEffect(() => {
  // 🔌 自动连接到 Clawbot Gateway
  const socket = new WebSocket('ws://192.168.101.4:18789');
  
  socket.onopen = () => {
    // 发送握手认证
    socket.send(JSON.stringify({
      type: 'req',
      method: 'connect',
      params: {
        role: 'operator',
        client: {
          id: 'clawdbot-ios',      // ← 必须参数
          mode: 'webchat',          // ← 必须参数
          platform: 'ios',          // ← 必须参数
        },
        auth: { token: AUTH_TOKEN }
      }
    }));
  };
}, []);
```

#### 阶段 3: 用户发送消息
```typescript
// ChatDetail.tsx 中
const handleSend = () => {
  sendMessage(input); // ← 调用 Context 方法
};

// WebSocketContext.tsx 中
const sendMessage = (text: string) => {
  // 1. 生成唯一 streamId
  const streamId = `stream-${Date.now()}-${randomId}`;
  setCurrentStreamId(streamId);
  
  // 2. 发送到 Clawbot Gateway
  socket.send(JSON.stringify({
    type: 'req',
    method: 'agent',
    params: {
      message: text,
      idempotencyKey: `${Date.now()}-${randomId}` // ← 防重复
    }
  }));
};
```

#### 阶段 4: 接收 AI 回复（流式）
```typescript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // 过滤系统噪音
  if (data.event === 'tick' || data.payload?.stream === 'lifecycle') {
    return; // 忽略
  }
  
  // 提取 AI 文本增量
  if (data.payload?.stream === 'assistant' && data.payload.data?.delta) {
    const delta = data.payload.data.delta; // 例如: "你"
    
    // 累积到 fullResponse
    responseBuffer += delta; // "你" → "你好" → "你好，" → ...
    setFullResponse(responseBuffer);
  }
};
```

#### 阶段 5: UI 显示（打字机效果）
```typescript
// ChatDetail.tsx 中
useEffect(() => {
  if (!fullResponse || !currentStreamId) return;
  
  setMessages(prev => {
    const existingIndex = prev.findIndex(msg => msg.id === currentStreamId);
    
    if (existingIndex !== -1) {
      // ✅ 更新同一气泡
      prev[existingIndex].text = fullResponse;
    } else {
      // ✅ 创建新气泡
      prev.push({
        id: currentStreamId,
        sender: 'bot',
        text: fullResponse
      });
    }
    return [...prev];
  });
}, [fullResponse, currentStreamId]);

// 结果: 单个气泡内文本逐渐增长 → 打字机效果 ✅
```

---

## 🔑 核心技术点

### 1. WebSocket 长连接
- **协议**: `ws://` (未加密) 或 `wss://` (加密)
- **特点**: 
  - 双向实时通信
  - 保持连接状态
  - 低延迟（毫秒级）
- **关键**: 浏览器原生支持 `WebSocket` API

### 2. Clawbot Gateway 协议
```typescript
// 认证握手
{
  type: 'req',
  method: 'connect',
  params: {
    role: 'operator',
    client: {
      id: 'clawdbot-ios',    // 硬编码 - 网关识别标识
      mode: 'webchat',        // 硬编码 - 会话模式
      platform: 'ios',        // 硬编码 - 平台标识
    }
  }
}

// 发送消息
{
  type: 'req',
  method: 'agent',
  params: {
    message: '用户输入',
    idempotencyKey: 'unique-id' // 防止重复提交
  }
}

// 接收回复（流式增量）
{
  type: 'event',
  event: 'agent',
  payload: {
    stream: 'assistant',
    data: {
      delta: '文'  // 每次返回几个字
    }
  }
}
```

### 3. 环境变量配置
```bash
# .env 文件
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789  # Gateway 地址
VITE_PC_AUTH_TOKEN=your-token-here              # 认证 Token
```

**关键**: Vite 在构建时会将 `import.meta.env.VITE_*` 替换为实际值

---

## 📱 移动端部署可行性分析

### ❌ 当前架构的问题

#### 问题 1: 局域网 IP 依赖
```
当前配置: ws://192.168.101.4:18789
          ↑ 这是你电脑的局域网 IP
```

**现象**:
- ✅ 在电脑浏览器: 可以访问（同一局域网）
- ✅ 在手机浏览器: 可以访问（连接同一 WiFi）
- ❌ 打包成 iOS App: **无法访问**（需要公网地址或特殊配置）

#### 问题 2: WebSocket 跨域限制
```
iOS App (file:// 或 https://)
   ↓
   试图连接到: ws://192.168.101.4:18789
   ↓
   浏览器安全策略拦截 ❌
```

#### 问题 3: Gateway 绑定本地
```bash
# Clawbot Gateway 默认配置
监听地址: 0.0.0.0:18789  # 允许局域网访问
但是: 只在你的电脑上运行
```

---

## 🚀 移动端部署解决方案

### 方案 1: 云服务器部署 Gateway (推荐 ⭐⭐⭐⭐⭐)

#### 架构
```
┌──────────────┐                              ┌──────────────┐
│              │   wss://your-domain.com      │              │
│  iOS App     │◄────────────────────────────►│  Gateway     │
│ (手机上)      │     (HTTPS + WSS 加密)        │ (云服务器)    │
│              │                              │              │
└──────────────┘                              └──────────────┘
                                                     ▲
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │   GLM-4.7    │
                                              │  (云端 GPU)   │
                                              └──────────────┘
```

#### 步骤
1. **租用云服务器** (例如: 阿里云、腾讯云、AWS)
   ```bash
   # 推荐配置
   - 操作系统: Ubuntu 22.04
   - GPU: NVIDIA T4 或更高 (运行 GLM-4.7)
   - 内存: 16GB+
   - 带宽: 5Mbps+
   ```

2. **部署 Clawbot Gateway**
   ```bash
   # SSH 连接到服务器
   ssh root@your-server-ip
   
   # 安装 Clawbot
   pip install openclaw-cn
   
   # 启动 Gateway (监听公网)
   openclaw-cn gateway --host 0.0.0.0 --port 18789
   ```

3. **配置 Nginx 反向代理 + SSL**
   ```nginx
   # /etc/nginx/sites-available/clawbot
   server {
       listen 443 ssl;
       server_name your-domain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location /ws {
           proxy_pass http://127.0.0.1:18789;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

4. **更新 App 配置**
   ```bash
   # .env
   VITE_PC_WEBSOCKET_URL=wss://your-domain.com/ws  # ← 改为 wss://
   VITE_PC_AUTH_TOKEN=your-token
   ```

5. **打包 iOS App**
   ```bash
   # 使用 Capacitor
   npm install @capacitor/core @capacitor/ios
   npx cap init
   npx cap add ios
   npm run build
   npx cap sync
   npx cap open ios  # 在 Xcode 中打包
   ```

**优点**:
- ✅ 任何地方都能访问
- ✅ HTTPS/WSS 加密安全
- ✅ 符合 App Store 审核要求
- ✅ 稳定可靠

**缺点**:
- ❌ 需要服务器成本 (约 ¥200-500/月)
- ❌ 需要域名和 SSL 证书
- ❌ 需要一定运维知识

---

### 方案 2: 使用内网穿透 (开发/测试用 ⭐⭐⭐)

#### 架构
```
┌──────────────┐                              ┌──────────────┐
│              │   wss://xxx.ngrok.io         │              │
│  iOS App     │◄────────────────────────────►│   Ngrok      │
│              │                              │   (中转)      │
└──────────────┘                              └──────────────┘
                                                     ▲
                                                     │ 隧道
                                                     ▼
                                              ┌──────────────┐
                                              │   Gateway    │
                                              │  (你的电脑)   │
                                              └──────────────┘
```

#### 步骤
1. **安装 Ngrok**
   ```bash
   # 下载: https://ngrok.com/download
   # 或使用其他工具: frp, serveo, localhost.run
   ```

2. **启动 Clawbot Gateway**
   ```bash
   openclaw-cn gateway
   # 监听 localhost:18789
   ```

3. **创建隧道**
   ```bash
   ngrok http 18789
   # 输出:
   # Forwarding: https://abc123.ngrok.io -> http://localhost:18789
   ```

4. **更新配置**
   ```bash
   # .env
   VITE_PC_WEBSOCKET_URL=wss://abc123.ngrok.io
   ```

**优点**:
- ✅ 快速测试
- ✅ 无需服务器
- ✅ 免费（有流量限制）

**缺点**:
- ❌ 每次重启 URL 会变
- ❌ 不稳定
- ❌ 有流量限制
- ❌ 不适合生产环境

---

### 方案 3: 本地网络 + mDNS (局域网专用 ⭐⭐)

#### 架构
```
同一 WiFi 网络:
┌──────────────┐                              ┌──────────────┐
│              │   ws://gateway.local:18789   │              │
│  iOS App     │◄────────────────────────────►│   Gateway    │
│ (手机)        │                              │  (电脑)       │
└──────────────┘                              └──────────────┘
```

#### 步骤
1. **启用 mDNS**
   ```bash
   # macOS (已内置)
   # Windows: 安装 Bonjour Print Services
   ```

2. **配置 Gateway 主机名**
   ```bash
   # 在路由器中设置静态 IP
   # 或使用 hostname: gateway.local
   ```

3. **更新配置**
   ```bash
   # .env
   VITE_PC_WEBSOCKET_URL=ws://gateway.local:18789
   ```

**优点**:
- ✅ 无需公网
- ✅ 低延迟
- ✅ 免费

**缺点**:
- ❌ 只能在同一 WiFi 下使用
- ❌ 离开家/办公室就无法使用
- ❌ 移动网络无法访问

---

### 方案 4: 混合云方案 (企业级 ⭐⭐⭐⭐)

#### 架构
```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │  WSS    │              │  内网   │              │
│  iOS App     │────────►│  API Gateway │────────►│   Gateway    │
│              │         │  (云服务器)   │  VPN    │  (本地强算力)│
└──────────────┘         └──────────────┘         └──────────────┘
```

- API Gateway 在云端处理认证和负载均衡
- 实际计算在本地机器（避免云端 GPU 成本）
- 通过 VPN/内网穿透连接

---

## 🎯 推荐方案

### 个人使用/开发测试
```
方案 2 (Ngrok) → 快速验证功能
```

### 正式发布 iOS App
```
方案 1 (云服务器) → 稳定、合规、可扩展
```

### 成本优化
```
方案 1 (轻量云) + 按需启动
- 使用 Serverless 架构
- 用户请求时唤醒 Gateway
- 空闲时自动休眠
```

---

## 📋 iOS App 打包检查清单

### 1. 网络配置
```xml
<!-- Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>  <!-- 强制使用 HTTPS/WSS -->
</dict>
```

### 2. 权限申请
```xml
<!-- 如果使用摄像头/麦克风 -->
<key>NSCameraUsageDescription</key>
<string>用于拍照发送给 AI</string>
<key>NSMicrophoneUsageDescription</key>
<string>用于语音输入</string>
```

### 3. 环境变量
```typescript
// 构建时替换
const WS_URL = import.meta.env.VITE_PC_WEBSOCKET_URL;
// 在 iOS App 中变成:
const WS_URL = "wss://your-domain.com/ws"; // 硬编码的值
```

### 4. WebSocket 兼容性
```typescript
// iOS Safari 原生支持 WebSocket
const socket = new WebSocket('wss://...');
// ✅ 无需 polyfill
```

---

## 🔒 安全建议

### 1. 使用 WSS (WebSocket Secure)
```
ws://  → 明文传输 ❌
wss:// → TLS 加密 ✅
```

### 2. Token 认证
```typescript
// 不要硬编码 Token
const token = await getSecureToken(); // 从 Keychain 读取
```

### 3. 证书验证
```typescript
// iOS 会自动验证 SSL 证书
// 确保使用正规 CA 签发的证书 (Let's Encrypt)
```

---

## 📊 性能对比

| 方案 | 延迟 | 成本 | 稳定性 | 适用场景 |
|------|------|------|--------|----------|
| 方案 1 (云服务器) | 50-200ms | ¥200-500/月 | ⭐⭐⭐⭐⭐ | 正式发布 |
| 方案 2 (Ngrok) | 100-500ms | 免费 | ⭐⭐⭐ | 测试开发 |
| 方案 3 (mDNS) | 10-50ms | 免费 | ⭐⭐⭐⭐ | 局域网专用 |
| 方案 4 (混合云) | 50-150ms | ¥100-300/月 | ⭐⭐⭐⭐ | 企业使用 |

---

## ✅ 总结

### 当前状态
- ✅ Web 浏览器访问: **完美工作**
- ✅ 同一 WiFi 下手机浏览器: **完美工作**
- ❌ 打包成 iOS App (使用局域网 IP): **无法工作**

### 移动端部署必须满足
1. **公网可访问的 WebSocket 服务器**
   - 云服务器部署 Gateway
   - 或使用内网穿透工具

2. **使用 WSS (加密 WebSocket)**
   - iOS App Store 要求 HTTPS/WSS
   - 需要 SSL 证书

3. **正确的 CORS 和安全配置**
   - Gateway 允许跨域请求
   - Token 安全存储

### 推荐路径
```
1. 开发阶段: 使用 Ngrok 快速测试
2. 测试阶段: 部署到云服务器 (使用测试域名)
3. 正式发布: 购买域名 + SSL 证书 + 稳定云服务器
```

---

**简而言之**: 
当前实现**在 Web 浏览器中完美工作**，但要打包成 iOS App，**必须将 Clawbot Gateway 部署到公网服务器**，并使用 `wss://` 加密连接。最简单的方式是使用 Ngrok 进行快速测试，正式发布则需要云服务器。

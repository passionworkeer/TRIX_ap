# 🎯 TRIX App 核心原理 - 快速理解

## 📡 当前工作原理（一句话版本）

**你的电脑上运行 Clawbot Gateway → 浏览器通过 WebSocket 连接 Gateway → 实时接收 AI 流式回复。**

---

## 🔍 技术栈

```
前端:
- React + TypeScript
- Vite (开发服务器)
- WebSocket API (原生支持)

后端:
- Clawbot Gateway (Python)
- GLM-4.7 本地模型
- WebSocket 协议
```

---

## 🌐 通信流程（5 步）

### 1️⃣ 用户打开应用
```
浏览器访问: http://192.168.101.4:3000/
Vite 返回: React App (HTML + JS)
```

### 2️⃣ App 自动连接 Gateway
```typescript
// WebSocketContext.tsx (App 启动时执行)
const socket = new WebSocket('ws://192.168.101.4:18789');

socket.send({
  method: 'connect',
  params: {
    id: 'clawdbot-ios',    // 硬编码
    mode: 'webchat',        // 硬编码
    platform: 'ios',        // 硬编码
    auth: { token: '...' }
  }
});
```

### 3️⃣ 用户发送消息
```typescript
// 用户输入: "你好"
sendMessage("你好");

// 发送到 Gateway:
{
  method: 'agent',
  params: {
    message: "你好",
    idempotencyKey: "unique-id" // 防重复
  }
}
```

### 4️⃣ Gateway 返回流式回复
```typescript
// Gateway 逐字返回:
{ payload: { stream: 'assistant', data: { delta: '你' } } }
{ payload: { stream: 'assistant', data: { delta: '好' } } }
{ payload: { stream: 'assistant', data: { delta: '，' } } }
{ payload: { stream: 'assistant', data: { delta: '我' } } }
{ payload: { stream: 'assistant', data: { delta: '是' } } }
{ payload: { stream: 'assistant', data: { delta: 'AI' } } }

// 前端累积: "你" → "你好" → "你好，" → "你好，我" → "你好，我是AI"
```

### 5️⃣ UI 显示打字机效果
```typescript
// ChatDetail.tsx
useEffect(() => {
  // 每次 fullResponse 更新，查找该 streamId 的气泡
  const bubble = messages.find(m => m.id === currentStreamId);
  
  if (bubble) {
    bubble.text = fullResponse; // 更新同一气泡
  } else {
    messages.push({ id: currentStreamId, text: fullResponse }); // 创建新气泡
  }
}, [fullResponse, currentStreamId]);

// 结果: 单个气泡内文本逐渐增长 ✅
```

---

## ✅ 当前可以做什么

```
✓ 在电脑浏览器访问 (localhost:3000)
✓ 在手机浏览器访问 (192.168.101.4:3000，同一 WiFi)
✓ 实时对话，流式打字机效果
✓ 语音输入 (Web Speech API)
✓ 拍照发送 (MediaDevices API)
✓ 切换页面时连接保持 (全局 WebSocket)
```

---

## ❌ 当前无法做什么

```
✗ 打包成 iOS App 后无法连接 (原因如下)
```

### 为什么无法打包成 iOS App？

#### 原因 1: 局域网 IP 限制
```
当前配置: ws://192.168.101.4:18789
          ↑ 这是你电脑在局域网的 IP

问题:
- 只在同一 WiFi 下可访问
- 离开这个 WiFi 就失效
- 使用移动数据无法访问
```

#### 原因 2: iOS 安全策略
```
iOS App Store 审核要求:
- 必须使用 HTTPS/WSS (加密)
- 不能使用 ws:// (明文)
- 不能使用 IP 地址 (必须是域名)
```

#### 原因 3: Gateway 只在本地
```
Clawbot Gateway 运行在你的电脑上
→ 电脑关机，Gateway 就停止
→ 手机无法访问
```

---

## 🚀 如何打包成 iOS App？

### 方案 1: 快速测试（Ngrok）⚡

**适合**: 验证功能、开发测试

```bash
# 1. 启动 Gateway
openclaw-cn gateway

# 2. 创建公网隧道
ngrok http 18789
# 输出: https://abc123.ngrok.io

# 3. 更新配置
# .env
VITE_PC_WEBSOCKET_URL=wss://abc123.ngrok.io

# 4. 打包 App
npm run build
npx cap add ios
npx cap open ios
```

**优点**: 5 分钟搞定，免费  
**缺点**: URL 会变，不稳定

---

### 方案 2: 云服务器部署（推荐）⭐

**适合**: 正式发布、长期使用

```bash
# 1. 租云服务器 (腾讯云/阿里云)
# 配置: Ubuntu 22.04 + GPU

# 2. 部署 Gateway
ssh root@your-server
pip install openclaw-cn
openclaw-cn gateway --host 0.0.0.0

# 3. 配置 Nginx + SSL
# 获得: wss://your-domain.com/ws

# 4. 更新 App 配置
VITE_PC_WEBSOCKET_URL=wss://your-domain.com/ws

# 5. 打包发布
npm run build
npx cap sync ios
# 在 Xcode 中提交到 App Store
```

**优点**: 稳定、安全、合规  
**缺点**: 每月约 ¥200-500 成本

---

## 📊 对比表格

| 场景 | 当前方案 | Ngrok | 云服务器 |
|------|----------|-------|----------|
| 电脑浏览器 | ✅ | ✅ | ✅ |
| 手机浏览器 (同 WiFi) | ✅ | ✅ | ✅ |
| 手机浏览器 (任何网络) | ❌ | ✅ | ✅ |
| iOS App | ❌ | ✅ | ✅ |
| 稳定性 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 成本 | 免费 | 免费 | ¥200-500/月 |
| 适用场景 | 本地开发 | 快速测试 | 正式发布 |

---

## 🎯 核心原理总结

### 关键点 1: WebSocket 长连接
```
传统 HTTP: 一问一答，连接即断
WebSocket: 建立后保持连接，双向实时通信
```

### 关键点 2: 流式传输
```
传统方式: 等待完整回复 → 一次性显示
流式方式: 逐字接收 → 打字机效果
```

### 关键点 3: ID 绑定机制
```
问题: React 快速更新导致重复气泡
解决: 每次回复生成唯一 streamId
     → 使用 streamId 精确查找并更新同一气泡
```

### 关键点 4: 全局 Context
```
问题: 切换页面，WebSocket 断开
解决: 将连接提升到 App 根组件
     → 全局单例，页面切换不影响
```

---

## 📚 相关文档

### 必读文档
1. **DEPLOYMENT_ARCHITECTURE.md** - 完整架构分析
   - WebSocket 协议详解
   - 4 种部署方案对比
   - 移动端部署可行性

2. **MOBILE_TESTING_GUIDE.md** - Ngrok 快速测试
   - 详细步骤（5 分钟验证）
   - 调试技巧
   - 常见问题排查

### 技术文档
3. **WEBSOCKET_REFACTOR.md** - WebSocket 重构说明
4. **STREAM_BUBBLE_FIX.md** - 流式回复修复
5. **HOW_TO_START.md** - 本地开发启动指南

---

## ❓ 常见问题

### Q1: 为什么 Web 浏览器可以，iOS App 不行？
**A**: Web 浏览器访问 `192.168.101.4`（局域网 IP）没问题，但 iOS App 需要公网地址（域名 + SSL）。

### Q2: 必须买云服务器吗？
**A**: 不一定。快速测试可用 Ngrok（免费），正式发布才需要云服务器。

### Q3: Ngrok 每次 URL 都变怎么办？
**A**: 升级到 Ngrok Pro ($8/月) 获得固定域名，或直接部署云服务器。

### Q4: 部署云服务器需要多少钱？
**A**: 
- 轻量服务器（无 GPU）: ¥50-100/月
- GPU 服务器（运行 GLM-4.7）: ¥200-500/月
- 按需启动可降低成本

### Q5: 数据安全吗？
**A**: 
- 当前方案: 局域网传输，相对安全
- Ngrok: 数据经过 Ngrok 服务器，需信任第三方
- 云服务器 + SSL: 端到端加密，最安全

---

## 🎉 总结

### 一句话总结
**当前 TRIX App 通过 WebSocket 连接本地 Clawbot Gateway，实现实时 AI 对话，在浏览器中完美工作，但要打包成 iOS App 需要将 Gateway 部署到公网（云服务器或 Ngrok）。**

### 推荐路径
```
1️⃣ 继续在浏览器中开发和测试 ✅
2️⃣ 使用 Ngrok 快速验证 iOS App 可行性 ⚡
3️⃣ 如果决定正式发布，部署到云服务器 🚀
```

### 下一步
```bash
# 想快速测试 iOS App？
1. 安装 Ngrok: https://ngrok.com/download
2. 运行: ngrok http 18789
3. 更新: VITE_PC_WEBSOCKET_URL=wss://xxx.ngrok.io
4. 打包: npx cap add ios && npx cap open ios

# 想正式发布？
阅读: DEPLOYMENT_ARCHITECTURE.md (完整部署方案)
```

---

**有疑问？查看上述文档或继续提问！** 🤗

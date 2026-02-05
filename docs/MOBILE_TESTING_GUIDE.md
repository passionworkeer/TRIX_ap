# 🚀 快速移动端测试指南 (使用 Ngrok)

## 目标
在不部署云服务器的情况下，快速验证 iOS App 是否能正常连接 Clawbot Gateway。

---

## 📋 准备工作

### 1. 确保本地环境正常
```bash
# 测试 Clawbot Gateway 是否正常运行
openclaw-cn gateway

# 预期输出:
# Gateway 已启动在 ws://0.0.0.0:18789
```

### 2. 安装 Ngrok
```bash
# 方式 1: 下载安装包
# https://ngrok.com/download

# 方式 2: 使用 Chocolatey (Windows)
choco install ngrok

# 方式 3: 使用 Homebrew (macOS)
brew install ngrok/ngrok/ngrok
```

### 3. 注册 Ngrok 账号 (免费)
```bash
# 访问: https://dashboard.ngrok.com/signup
# 获取 authtoken

# 配置 authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

---

## 🔧 步骤 1: 启动 Gateway

```bash
# 在终端 1 中
cd E:\desktop\trix-3d-companion
openclaw-cn gateway

# 确认输出包含:
# ✅ Gateway listening on 0.0.0.0:18789
```

---

## 🌐 步骤 2: 创建公网隧道

```bash
# 在终端 2 中
ngrok http 18789

# 输出示例:
# Session Status                online
# Account                       your@email.com (Plan: Free)
# Forwarding                    https://abc123.ngrok.io -> http://localhost:18789
#                               ↑↑↑ 这就是你的公网地址
```

**重要**: 复制 `https://abc123.ngrok.io` 这个地址！

---

## 📝 步骤 3: 更新前端配置

```bash
# 编辑 .env 文件
VITE_PC_WEBSOCKET_URL=wss://abc123.ngrok.io
#                      ↑↑↑ 注意是 wss:// (不是 https://)
VITE_PC_AUTH_TOKEN=your-token-here
```

**注意事项:**
- Ngrok 的 HTTPS 隧道自动支持 WebSocket Upgrade
- `https://abc123.ngrok.io` → WebSocket 使用 `wss://abc123.ngrok.io`
- 每次重启 Ngrok，URL 会变化（免费版）

---

## 🏗️ 步骤 4: 构建并测试

### 测试 1: Web 浏览器验证
```bash
# 在终端 3 中
npm run build
npm run preview

# 访问:
# http://localhost:4173/
# 或
# https://abc123.ngrok.io  (如果你也为 Vite 创建了隧道)
```

**测试点:**
- [ ] 页面加载成功
- [ ] WebSocket 连接状态显示 "已连接"
- [ ] 发送消息，收到 AI 回复
- [ ] 流式回复正常显示（单个气泡）

### 测试 2: 手机浏览器验证
```bash
# 在手机浏览器中访问:
https://abc123.ngrok.io

# 或者为 Vite 也创建隧道:
ngrok http 4173  # 另开一个终端
# 访问输出的地址
```

---

## 📱 步骤 5: 打包成 iOS App (Capacitor)

### 5.1 安装 Capacitor
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios
npx cap init
```

**配置提示:**
- App name: `TRIX`
- App ID: `com.yourname.trix`
- Web directory: `dist`

### 5.2 构建并同步
```bash
# 构建 Web 应用
npm run build

# 添加 iOS 平台
npx cap add ios

# 同步文件到 iOS 项目
npx cap sync ios
```

### 5.3 配置 iOS 项目

编辑 `ios/App/App/Info.plist`，确保允许网络请求:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>ngrok.io</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <false/>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSExceptionRequiresForwardSecrecy</key>
            <false/>
        </dict>
    </dict>
</dict>
```

### 5.4 在 Xcode 中打开
```bash
npx cap open ios
```

### 5.5 在模拟器/真机上测试
1. 选择目标设备（iPhone 模拟器或真机）
2. 点击 Run (⌘R)
3. App 启动后，测试聊天功能

---

## 🔍 调试技巧

### 查看 iOS App 的 WebSocket 日志

在 Xcode 中打开 Safari 开发者工具:
```
Safari → 开发 → [你的 iPhone] → WebView
```

或者在代码中添加日志:
```typescript
// WebSocketContext.tsx
socket.onopen = () => {
  console.log('✅ WebSocket 已连接到:', WS_URL);
  alert('✅ WebSocket 已连接'); // 测试用
};

socket.onerror = (error) => {
  console.error('❌ WebSocket 错误:', error);
  alert('❌ WebSocket 连接失败'); // 测试用
};
```

### 常见问题排查

#### 问题 1: WebSocket 连接失败
```
检查清单:
- [ ] Ngrok 是否正在运行? (终端 2)
- [ ] Gateway 是否正在运行? (终端 1)
- [ ] .env 中的 URL 是否正确? (wss://...)
- [ ] Ngrok 的 URL 是否过期? (免费版 8 小时)
```

#### 问题 2: CORS 错误
```
Ngrok 会自动处理 CORS，但如果还是报错:
- 确认使用的是 wss:// 而不是 ws://
- 检查 Gateway 是否允许跨域请求
```

#### 问题 3: SSL 证书错误
```
Ngrok 的证书是合法的，不应该有问题
如果报错，检查:
- iOS 设置 → 通用 → 关于 → 证书信任设置
- 确认 Ngrok 的证书被信任
```

---

## 📊 验证检查清单

### Web 浏览器测试 ✅
- [ ] 访问 Ngrok URL，页面加载成功
- [ ] WebSocket 状态显示 "🟢 已连接"
- [ ] 发送消息，收到 AI 回复
- [ ] 流式回复显示为单个气泡
- [ ] 语音输入正常工作
- [ ] 拍照功能正常工作

### 手机浏览器测试 ✅
- [ ] 在 Safari/Chrome 中访问 Ngrok URL
- [ ] WebSocket 连接成功
- [ ] 聊天功能正常
- [ ] 触摸交互流畅

### iOS App 测试 ✅
- [ ] App 启动成功
- [ ] WebSocket 自动连接
- [ ] 聊天界面正常显示
- [ ] 发送消息、接收回复正常
- [ ] 流式打字机效果正常
- [ ] 语音输入（如果已授权麦克风权限）
- [ ] 拍照功能（如果已授权相机权限）

---

## ⚠️ Ngrok 免费版限制

```
限制项:
- URL 每次重启会变化
- 连接数限制: 40 connections/min
- 隧道数限制: 1 个在线隧道
- 会话时长: 8 小时自动断开

解决方法:
- 升级到 Ngrok Pro ($8/月):
  - 固定域名
  - 无连接数限制
  - 永久在线
- 或使用其他工具: frp, serveo, localtunnel
```

---

## 🎯 下一步

### 如果测试成功 ✅
```
说明:
- 核心通信逻辑正确
- iOS App 可以正常工作
- 可以考虑部署到云服务器
```

### 如果测试失败 ❌
```
调试步骤:
1. 检查 Ngrok 隧道是否正常 (访问 http://localhost:4040 查看日志)
2. 检查 Gateway 日志是否有错误
3. 查看浏览器/App 的 Network 面板
4. 确认 .env 配置是否正确
```

---

## 🚀 生产环境部署建议

测试成功后，推荐使用云服务器:

```bash
# 1. 租用云服务器 (腾讯云/阿里云)
# 2. 安装 Clawbot
pip install openclaw-cn

# 3. 使用 systemd 自动启动
sudo nano /etc/systemd/system/clawbot.service

# 4. 配置 Nginx + Let's Encrypt SSL
sudo apt install nginx certbot python3-certbot-nginx

# 5. 更新 .env
VITE_PC_WEBSOCKET_URL=wss://your-domain.com/ws
```

详细步骤见 `DEPLOYMENT_ARCHITECTURE.md` 文档。

---

## 📚 相关文档

- `DEPLOYMENT_ARCHITECTURE.md` - 完整架构和部署方案
- `WEBSOCKET_REFACTOR.md` - WebSocket 重构说明
- `STREAM_BUBBLE_FIX.md` - 流式回复修复说明
- `HOW_TO_START.md` - 本地开发启动指南

---

**总结**: 使用 Ngrok 可以在 **5 分钟内**验证 iOS App 是否能正常连接 Clawbot Gateway，无需购买服务器。如果测试成功，说明核心逻辑没问题，可以放心部署到云服务器。

# 云端 Relay Server 部署指南

## 📋 部署步骤

### 方案 A: 使用 SSH 手动部署（推荐）

#### 1. 准备文件

在本地电脑上，将要上传的文件准备好：

```bash
# 文件位置
e:\desktop\trix-3d-companion\bridge\relay_server_with_bridge.py
```

#### 2. 上传文件到服务器

使用 SCP 或 SFTP 上传文件：

```bash
# 使用 SCP 上传
scp e:\desktop\trix-3d-companion\bridge\relay_server_with_bridge.py root@47.243.55.130:/root/nanobot/

# 或使用 SFTP 客户端（如 WinSCP、FileZilla）
```

#### 3. SSH 登录到服务器

```bash
ssh root@47.243.55.130
```

#### 4. 在服务器上安装依赖

```bash
# 安装 Python 依赖
pip3 install websockets aiohttp asyncio

# 安装 PM2（进程管理器）
npm install -g pm2
```

#### 5. 启动服务

```bash
# 进入目录
cd /root/nanobot

# 使用 PM2 启动（推荐）
pm2 start relay_server_with_bridge.py --name relay-server --interpreter python3

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

#### 6. 验证服务状态

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs relay-server

# 查看实时日志
pm2 logs relay-server --lines 100
```

### 方案 B: 使用自动化部署脚本

#### 1. 上传部署脚本

```bash
# 上传两个文件
scp e:\desktop\trix-3d-companion\bridge\relay_server_with_bridge.py root@47.243.55.130:/root/nanobot/
scp e:\desktop\trix-3d-companion\bridge\deploy_cloud_server.sh root@47.243.55.130:/root/nanobot/
```

#### 2. 运行部署脚本

```bash
# SSH 登录
ssh root@47.243.55.130

# 给脚本执行权限
cd /root/nanobot
chmod +x deploy_cloud_server.sh

# 运行脚本
./deploy_cloud_server.sh
```

---

## 🔧 本地 Bridge 配置修改

部署云端服务器后，需要修改本地 Bridge 的连接地址：

### 修改 `openclaw-bridge.js`

```javascript
// 云端 Relay Server 地址
const RELAY_SERVER_URL = 'ws://47.243.55.130:8765';
// 备选: 'wss://m.jmtrick.com'
```

### 重启本地 Bridge

```bash
cd e:\desktop\trix-3d-companion\bridge

# 停止旧进程
pm2 stop openclaw-bridge
pm2 delete openclaw-bridge

# 启动新进程
pm2 start openclaw-bridge.js --name openclaw-bridge

# 查看日志验证连接
pm2 logs openclaw-bridge
```

---

## 🌐 App 端配置修改

### 修改 `.env` 文件

```bash
# e:\desktop\trix-3d-companion\.env

# 云端 Relay Server
VITE_CLAWBOT_CHANNEL_URL=ws://47.243.55.130:8765
# 备选: wss://m.jmtrick.com
```

### 重启 App

```bash
cd e:\desktop\trix-3d-companion

# 停止当前运行的 App（Ctrl+C）
# 重新启动
npm run dev
```

---

## 🧪 三端联通测试

### 1. 验证云端服务器

```bash
# SSH 登录服务器
ssh root@47.243.55.130

# 查看 Relay Server 日志
pm2 logs relay-server

# 应该看到类似输出:
# ✅ Relay Server 已启动: ws://0.0.0.0:8765
# ✅ OpenClaw Bridge 注册成功 (v1.0.0)
# 📨 收到 App 消息: 你好
# 📤 转发消息到 OpenClaw Bridge...
# 📨 收到 Bridge 响应: 你好！我是...
```

### 2. 验证本地 Bridge

```bash
# 本地电脑
pm2 logs openclaw-bridge

# 应该看到类似输出:
# [Bridge] ✅ 已连接到云端 Relay Server
# [Bridge] 📨 收到 App 消息: 你好
# [Bridge] 调用 OpenClaw Gateway (尝试 1/4)
# [Bridge] ✅ OpenClaw 响应成功: 你好！我是...
# [Bridge] 📤 发送 AI 响应回云端...
```

### 3. 测试 App

1. 打开浏览器访问: http://localhost:5175
2. 登录并进入 Clawbot 聊天页面
3. 发送测试消息: "你好 OpenClaw"
4. **预期**: <1 秒收到 AI 响应

---

## 📊 性能监控

### 云端服务器监控

```bash
# PM2 监控
pm2 monit

# 资源使用情况
pm2 status

# 日志查看
pm2 logs relay-server --lines 50
```

### 本地 Bridge 监控

```bash
# PM2 监控
pm2 monit

# 资源使用情况
pm2 status

# 日志查看
pm2 logs openclaw-bridge --lines 50
```

---

## 🐛 故障排查

### 问题 1: Bridge 无法连接云端服务器

**症状**:
```
[Bridge] ❌ 连接失败: connect ECONNREFUSED
```

**解决方案**:
1. 检查云端服务器是否运行: `ping 47.243.55.130`
2. 检查端口是否开放: `telnet 47.243.55.130 8765`
3. 检查服务器防火墙: `sudo ufw status`
4. 开放端口: `sudo ufw allow 8765`

### 问题 2: 云端服务器未识别 Bridge

**症状**: Bridge 连接成功但服务器无响应

**解决方案**:
1. 检查 `relay_server_with_bridge.py` 是否正确运行
2. 查看服务器日志: `pm2 logs relay-server`
3. 确认 Bridge 注册事件被处理

### 问题 3: App 无法连接云端服务器

**症状**: App 显示连接失败

**解决方案**:
1. 检查 `.env` 文件配置
2. 检查浏览器控制台错误（F12）
3. 确认云端服务器运行正常

---

## 📝 端口说明

| 端口 | 用途 | 位置 |
|------|------|------|
| 18789 | OpenClaw Gateway | 本地电脑 |
| 8765 | Relay Server | 云端服务器 |
| 5175 | Web App | 本地电脑 |

---

## 🔐 安全建议

1. **生产环境**:
   - 使用 WSS (WebSocket Secure) 而不是 WS
   - 配置防火墙只允许特定 IP 访问
   - 添加 API 密钥认证
   - 启用速率限制

2. **Token 保护**:
   - 不要在代码中硬编码 Token
   - 使用环境变量存储敏感信息
   - 定期轮换 Token

---

## 📞 技术支持

如遇问题，请检查以下日志：

1. **云端 Relay Server**: `pm2 logs relay-server`
2. **本地 Bridge**: `pm2 logs openclaw-bridge`
3. **OpenClaw Gateway**: 查看 OpenClaw 控制台
4. **App 浏览器**: F12 → Console 标签

---

**部署完成！** 🎉

系统现在应该完全联通：
- **App** → **云端 Relay Server** → **本地 Bridge** → **OpenClaw Gateway**

# 🚀 生产环境部署指南

## 📋 部署架构

```
┌─────────────────┐
│  📱 手机 App     │ ◄─── 4G/5G/WiFi ───┐
│  http://47.243.55.130                 │
└────────┬────────┘                    │
         │                             │
         ▼                             │
┌─────────────────┐                    │
│  ☁️ 云端服务器   │                    │
│  47.243.55.130   │                    │
│  ├─ App (Nginx) │                    │
│  └─ Relay Server│ ◄─────────────────┘
└────────┬────────┘   ▲
         │            │ WebSocket
         │            │ Bridge连接
         ▼            │
┌─────────────────┐   │
│  💻 你的电脑     │───┘
│  ├─ Bridge      │
│  └─ OpenClaw    │
└─────────────────┘
```

---

## 🎯 部署目标

实现类似 WhatsApp Web 的扫码配对体验：

1. ✅ **手机 App 通过 4G/5G 访问** - 不限制网络
2. ✅ **OpenClaw 在本地电脑运行** - AI推理本地化
3. ✅ **扫码/配对码配对** - 简单快捷
4. ✅ **跨网络使用** - 不需要同一WiFi

---

## 📝 部署步骤

### 方式一: 自动部署（推荐）

#### Windows 用户

双击运行一键部署脚本：

```
e:\desktop\trix-3d-companion\bridge\一键部署.bat
```

脚本会自动完成：
- ✅ 上传 Relay Server 到云端
- ✅ 在云端启动 Relay Server
- ✅ 配置并启动本地 Bridge
- ✅ 验证连接状态

#### Linux/Mac 用户

```bash
cd e:/desktop/trix-3d-companion/bridge
chmod +x 一键部署.sh
./一键部署.sh
```

---

### 方式二: 手动部署

#### 步骤 1: 上传文件到服务器

```bash
# 上传 Relay Server
scp e:\desktop\trix-3d-companion\bridge\relay_server_with_bridge.py root@47.243.55.130:/root/nanobot/

# 上传部署脚本
scp e:\desktop\trix-3d-companion\bridge\deploy_production.sh root@47.243.55.130:/root/nanobot/
```

#### 步骤 2: SSH 登录服务器

```bash
ssh root@47.243.55.130
```

#### 步骤 3: 在服务器上执行部署

```bash
cd /root/nanobot

# 给脚本执行权限
chmod +x deploy_production.sh

# 运行部署脚本
./deploy_production.sh
```

#### 步骤 4: 验证服务状态

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs relay-server

# 检查端口监听
netstat -tuln | grep 8765
```

#### 步骤 5: 配置本地 Bridge

```bash
cd e:\desktop\trix-3d-companion\bridge

# 停止旧的 Bridge
pm2 stop openclaw-bridge 2>nul
pm2 delete openclaw-bridge 2>nul

# 启动生产模式 Bridge
set NODE_ENV=production
pm2 start openclaw-bridge.js --name openclaw-bridge

# 查看日志验证连接
pm2 logs openclaw-bridge
```

---

## 🔧 配置说明

### 云端 Relay Server 配置

**文件**: `relay_server_with_bridge.py`

- **端口**: 8765
- **协议**: WebSocket (ws://)
- **功能**:
  - 接收手机 App 消息
  - 转发到本地 Bridge
  - 接收本地 Bridge 响应
  - 转发回手机 App

### 本地 Bridge 配置

**文件**: `openclaw-bridge.js`

- **环境变量**: `NODE_ENV=production`
- **连接目标**: `ws://47.243.55.130:8765`
- **本地 API**: `http://127.0.0.1:18789`

### App 配置

**文件**: `.env.production`

```bash
VITE_CLAWBOT_CHANNEL_URL=ws://47.243.55.130:8765
```

---

## 🧪 测试验证

### 1. 测试云端 Relay Server

```bash
# SSH 到服务器
ssh root@47.243.55.130

# 查看服务状态
pm2 status relay-server

# 查看实时日志
pm2 logs relay-server --lines 50
```

**预期输出**:
```
✅ Relay Server 已启动: ws://0.0.0.0:8765
📋 等待 Bridge 和 App 连接...
```

### 2. 测试本地 Bridge

```bash
# 查看本地 Bridge 日志
pm2 logs openclaw-bridge

# 或直接运行查看输出
cd e:\desktop\trix-3d-companion\bridge
set NODE_ENV=production
node openclaw-bridge.js
```

**预期输出**:
```
[Bridge] 🚀 正在连接云端 Relay Server: ws://47.243.55.130:8765
[Bridge] ✅ 已连接到云端 Relay Server
```

### 3. 测试手机 App

1. 打开手机浏览器
2. 访问: `http://47.243.55.130`
3. 登录并进入 Clawbot 聊天页面
4. 配对 OpenClaw（扫码或输入配对码）
5. 发送测试消息

**预期结果**:
- ✅ App 连接到云端 Relay Server
- ✅ 本地 Bridge 收到消息
- ✅ OpenClaw 生成响应
- ✅ 响应返回到手机 App

---

## 📱 配对流程（类似 WhatsApp）

### 方式一: 二维码配对

1. **手机 App**:
   - 进入配对页面
   - 显示二维码

2. **电脑端 OpenClaw**:
   - 运行配对命令
   - 扫描手机二维码
   - 确认配对

3. **完成**:
   - 手机和电脑配对成功
   - 可以开始使用

### 方式二: 配对码配对

1. **手机 App**:
   - 进入配对页面
   - 显示 6 位配对码（如: ABC123）

2. **电脑端**:
   - 运行配对命令
   - 输入配对码

3. **完成**:
   - 配对成功
   - 可以使用

---

## 🔐 安全配置

### 防火墙配置

```bash
# 在服务器上开放 8765 端口
sudo ufw allow 8765/tcp

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 8765 -j ACCEPT
sudo iptables-save
```

### SSL/TLS（可选，推荐）

如果需要使用 WSS（WebSocket Secure）：

```bash
# 安装 Nginx
sudo apt install nginx

# 配置 SSL 证书（Let's Encrypt）
sudo certbot --nginx -d your-domain.com

# Nginx 配置示例
location /ws/ {
    proxy_pass http://localhost:8765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 🐛 故障排查

### 问题 1: Bridge 无法连接云端

**症状**: `[Bridge] ❌ 连接失败`

**解决方案**:
```bash
# 1. 检查服务器是否运行
ping 47.243.55.130

# 2. 检查端口是否开放
telnet 47.243.55.130 8765

# 3. 检查防火墙
ssh root@47.243.55.130 "sudo ufw status"

# 4. 开放端口
ssh root@47.243.55.130 "sudo ufw allow 8765"
```

### 问题 2: 手机无法连接服务器

**症状**: App 显示连接失败

**解决方案**:
1. 检查手机网络
2. 确认服务器 IP 正确
3. 检查 Nginx/Apache 配置
4. 查看服务器日志

### 问题 3: OpenClaw 无响应

**症状**: App 发送消息后无响应

**解决方案**:
```bash
# 1. 检查 OpenClaw 是否运行
netstat -ano | findstr :18789

# 2. 检查 Bridge 日志
pm2 logs openclaw-bridge

# 3. 测试 OpenClaw API
curl http://127.0.0.1:18789/v1/chat/completions
```

---

## 📊 监控命令

### 云端服务器

```bash
# 服务状态
ssh root@47.243.55.130 "pm2 status"

# 实时日志
ssh root@47.243.55.130 "pm2 logs relay-server"

# 资源监控
ssh root@47.243.55.130 "pm2 monit"
```

### 本地电脑

```bash
# Bridge 状态
pm2 status openclaw-bridge

# 实时日志
pm2 logs openclaw-bridge

# 资源监控
pm2 monit
```

---

## 🎉 部署完成检查清单

- [ ] 云端 Relay Server 运行正常
- [ ] 本地 Bridge 连接到云端
- [ ] OpenClaw Gateway 运行正常
- [ ] 手机可以访问服务器 IP
- [ ] App 可以连接到 Relay Server
- [ ] 配对功能正常工作
- [ ] 消息收发正常

---

## 📞 技术支持

如遇问题：

1. 检查日志（云端 + 本地）
2. 查看防火墙配置
3. 验证网络连接
4. 查看端口监听状态

---

**部署完成！** 🎉

现在你可以：
1. 📱 手机通过 4G/5G 访问 App
2. 💻 OpenClaw 在本地电脑运行
3. 🔗 扫码/配对码快速配对
4. ⚡ 享受跨网络的 AI 聊天体验！

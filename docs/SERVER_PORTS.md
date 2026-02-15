# 服务器端口分配说明

## 📊 端口分配表

| 服务名称 | 端口 | 协议 | 说明 |
|---------|------|------|------|
| **Clawbot Channel** | **8765** | Socket.io (WebSocket) | ✅ **当前使用** - Clawbot 配对和消息服务 |
| Nanobot Cloud | 8766 | WebSocket | ⏸️ 未使用 - Nanobot 备用服务 |
| 未知 Python 服务 | 5001 | HTTP | ⚠️ 占用中 - 用途不明 |
| Clawbot Gateway | 18789 | WebSocket | 🏠 本地服务 - Tailscale 内网 |

---

## ✅ 当前配置（2026-02-15）

### Clawbot Channel（端口 8765）

**服务器地址：** `ws://TRIX_SERVER_HOST:8765`

**状态：** ✅ 运行中

**进程信息：**
```
PID: 347352
命令: node /opt/clawbot-channel/server.js
目录: /opt/clawbot-channel
```

**环境变量：**
```bash
VITE_CLAWBOT_CHANNEL_URL=ws://TRIX_SERVER_HOST:8765
```

**用途：**
- App 与 Clawbot 的配对服务
- 消息中转服务
- 文件上传服务

---

### Nanobot Cloud（端口 8766）

**服务器地址：** `ws://TRIX_SERVER_HOST:8766`

**状态：** ⏸️ 未运行

**目录：** `/opt/nanobot-cloud`

**环境变量：**
```bash
VITE_NANOBOT_SERVER_URL=ws://TRIX_SERVER_HOST:8766
```

**用途：**
- Nanobot 备用配对服务（Python 实现）
- 目前未使用

---

## 🚨 已修复的端口冲突

### 问题描述
之前 **nanobot-cloud** 和 **clawbot-channel** 都配置为 **8765 端口**，导致潜在的端口冲突。

### 解决方案
1. ✅ 修改 `/opt/nanobot-cloud/cloud_server_advanced.py` 的端口为 **8766**
2. ✅ 更新前端配置 `VITE_NANOBOT_SERVER_URL=ws://TRIX_SERVER_HOST:8766`
3. ✅ 更新 `NanobotBridge.ts` 默认端口为 **8766**

### 修改记录
```bash
# 服务器端
/opt/nanobot-cloud/cloud_server_advanced.py
  - PORT = 8765
  + PORT = 8766  # 修改为 8766 避免与 clawbot-channel 冲突

# 前端
.env
  - VITE_NANOBOT_SERVER_URL=ws://TRIX_SERVER_HOST:8765
  + VITE_NANOBOT_SERVER_URL=ws://TRIX_SERVER_HOST:8766

src/services/NanobotBridge.ts
  - this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'ws://TRIX_SERVER_HOST:8765';
  + this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'ws://TRIX_SERVER_HOST:8766';
```

---

## 🔍 端口检查命令

### 查看端口占用
```bash
# 查看所有相关端口
netstat -tlnp | grep -E '(8765|8766|5001|18789)'

# 详细查看 8765 端口
lsof -i :8765

# 查看监听端口
ss -tlnp | grep 8765
```

### 查看进程
```bash
# 查看 node 进程
ps aux | grep node

# 查看 python 进程
ps aux | grep python

# 查看 PM2 管理的进程
pm2 list
```

---

## 📝 服务管理

### Clawbot Channel

```bash
# 查看状态
pm2 status clawbot-channel

# 查看日志
pm2 logs clawbot-channel

# 重启服务
pm2 restart clawbot-channel

# 停止服务
pm2 stop clawbot-channel
```

### Nanobot Cloud（如果需要启动）

```bash
# 启动 nanobot（在后台）
cd /opt/nanobot-cloud
nohup python3 cloud_server_advanced.py > /var/log/nanobot.log 2>&1 &

# 或使用 systemd
systemctl start nanobot-cloud

# 查看日志
tail -f /var/log/nanobot.log
```

---

## ⚠️ 注意事项

1. **不要同时运行** clawbot-channel 和 nanobot-cloud 在同一端口
2. **App 默认连接** `8765` (clawbot-channel)
3. **Nanobot 备用** `8766` (未启动)
4. **端口 5001** 被未知 Python 服务占用，需进一步调查
5. **本地 Gateway** `18789` 仅在内网可访问

---

## 🔧 未来改进

1. 考虑使用 **Nginx 反向代理** 统一管理端口
2. 使用 **Docker 容器** 隔离不同服务
3. 添加 **健康检查** 监控服务状态
4. 实现 **自动故障转移** (Failover)

---

**最后更新：** 2026-02-15
**更新人员：** Claude Sonnet 4.5
**状态：** ✅ 端口冲突已解决

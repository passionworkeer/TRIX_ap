# Nanobot 云端配对完整集成指南

> **版本**: 2.0
> **最后更新**: 2026-02-14
> **目标**: 实现 App ↔ 云端服务器 ↔ 本地 Nanobot 的三端实时通信

---

## 目录

1. [架构概览](#1-架构概览)
2. [快速启动](#2-快速启动)
3. [云端服务器配置](#3-云端服务器配置)
4. [本地 Nanobot 配置](#4-本地-nanobot-配置)
5. [App 前端配置](#5-app-前端配置)
6. [消息协议](#6-消息协议)
7. [连通测试](#7-连通测试)
8. [常见问题](#8-常见问题)

---

## 1. 架构概览

### 三端通信架构

```
┌─────────────────┐                    ┌─────────────────┐
│   手机 App      │                    │   阿里云服务器   │
│  (React/Vue)    │◄───WebSocket──────►│  (Python/WS)    │
│                 │    ws://47.243...   │   :8765         │
└─────────────────┘                    └────────┬────────┘
                                                │
                                        WebSocket
                                                │
                                       ┌────────▼────────┐
                                       │  本地 Nanobot   │
                                       │  (Python Flask) │
                                       │  localhost:5000 │
                                       └─────────────────┘
```

### 通信流程

```
1. 本地 Nanobot → 云端：注册设备 + 配对码
2. App → 云端：输入配对码配对
3. App → 云端 → Nanobot：发送消息
4. Nanobot → 云端 → App：AI 回复
```

### 当前实现状态

| 端 | 状态 | 地址 |
|----|------|------|
| 云端服务器 | ✅ 运行中 | `ws://TRIX_SERVER_HOST:8765` |
| 本地 Nanobot | ⏳ 待启动 | `http://localhost:5000` |
| App 前端 | ⏳ 待启动 | `http://localhost:5173` |

---

## 2. 快速启动

### 2.1 三端启动命令

**云端服务器（已完成）**:
```bash
ssh root@TRIX_SERVER_HOST
python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &
```

**本地 Nanobot**:
```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
# 访问 http://localhost:5000 查看配对码
```

**App 前端**:
```bash
cd e:\desktop\trix-3d-companion
npm run dev
# 访问 http://localhost:5173
```

### 2.2 配对流程

1. 打开 Nanobot Web 界面 (`http://localhost:5000`)
2. 查看左侧显示的 8 位配对码（如 `A1B2C3D4`）
3. 在 App 中进入"配对"功能
4. 输入配对码，点击"连接"
5. 配对成功后即可开始对话

---

## 3. 云端服务器配置

### 3.1 服务器信息

| 配置项 | 值 |
|--------|-----|
| 服务器 IP | `TRIX_SERVER_HOST` |
| WebSocket 端口 | `8765` |
| 完整地址 | `ws://TRIX_SERVER_HOST:8765` |
| 服务文件 | `/root/cloud_server.py` |
| 日志文件 | `/tmp/cloud_server.log` |

### 3.2 安装依赖

```bash
ssh root@TRIX_SERVER_HOST

# 安装 Python 和 websockets
apt update
apt install -y python3 python3-pip
pip3 install websockets

# 验证安装
python3 -c "import websockets; print('OK')"
```

### 3.3 启动服务器

**方式 A - 直接运行（测试）**:
```bash
python3 /root/cloud_server.py
```

**方式 B - 后台运行（推荐）**:
```bash
nohup python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &

# 查看日志
tail -f /tmp/cloud_server.log

# 查看进程
ps aux | grep cloud_server
```

**方式 C - systemd 服务（生产环境）**:
```bash
# 创建服务文件
cat > /etc/systemd/system/cloud-server.service << 'EOF'
[Unit]
Description=Nanobot Cloud Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/python3 /root/cloud_server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动
systemctl daemon-reload
systemctl enable cloud-server
systemctl start cloud-server
systemctl status cloud-server
```

### 3.4 验证服务器

```bash
# 检查端口监听
netstat -tuln | grep 8765
# 应该看到: tcp 0.0.0.0:8765 LISTEN

# 查看实时日志
tail -f /tmp/cloud_server.log
```

---

## 4. 本地 Nanobot 配置

### 4.1 配置信息

| 配置项 | 值 |
|--------|-----|
| 项目路径 | `e:\desktop\nanobot\nanobot` |
| Web 界面 | `http://localhost:5000` |
| 配置文件 | `web_interface_final.py` |
| 云端地址 | `ws://TRIX_SERVER_HOST:8765/nanobot/ws` (L18) |

### 4.2 检查配置

打开 `e:\desktop\nanobot\nanobot\web_interface_final.py`，确认第 18 行：

```python
CLOUD_SERVER = 'ws://TRIX_SERVER_HOST:8765/nanobot/ws'
```

### 4.3 启动 Nanobot

```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

看到以下输出表示成功：
```
* Running on http://127.0.0.1:5000
* Running on http://localhost:5000
```

### 4.4 验证连接

访问 `http://localhost:5000`，检查：
- ✅ 左侧边栏显示"云端已连接"
- ✅ 显示 8 位配对码
- ✅ 显示有效期（默认 3600 秒）

---

## 5. App 前端配置

### 5.1 配置信息

| 配置项 | 值 |
|--------|-----|
| 项目路径 | `e:\desktop\trix-3d-companion` |
| 配置文件 | `src/services/NanobotBridge.ts` |
| 云端地址 | `ws://TRIX_SERVER_HOST:8765` (L49) |
| 配对界面 | `src/screens/NanobotPairing.tsx` |

### 5.2 检查配置

打开 `src/services/NanobotBridge.ts`，确认第 49 行：

```typescript
this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'ws://TRIX_SERVER_HOST:8765';
```

### 5.3 启动前端

```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

访问 `http://localhost:5173`

---

## 6. 消息协议

### WebSocket 消息类型

#### 设备 → 云端

| 类型 | 说明 | 发送方 |
|------|------|--------|
| `register` | 设备注册 | App + Nanobot |
| `register_pairing` | 注册配对码 | Nanobot |
| `app_pairing` | 配对请求 | App |
| `chat_message` | 发送消息 | App |
| `chat_response` | AI 回复 | Nanobot |
| `ping` | 心跳 | 双方 |

#### 云端 → 设备

| 类型 | 说明 |
|------|------|
| `register_success` | 注册成功 |
| `pairing_registered` | 配对码注册成功 |
| `pairing_success` | 配对成功 |
| `pairing_failed` | 配对失败 |
| `chat_message` | 转发消息 |
| `chat_response` | 转发回复 |
| `error` | 错误信息 |
| `pong` | 心跳响应 |

### 消息示例

**设备注册**:
```json
{
  "type": "register",
  "device_id": "app_xxxxxx",
  "device_type": "mobile_app"
}
```

**配对码注册**:
```json
{
  "type": "register_pairing",
  "code": "A1B2C3D4",
  "device_id": "nanobot_local_xxxxxx"
}
```

**App 配对**:
```json
{
  "type": "app_pairing",
  "code": "A1B2C3D4",
  "device_id": "app_xxxxxx"
}
```

**发送消息**:
```json
{
  "type": "chat_message",
  "device_id": "app_xxxxxx",
  "message": "你好",
  "msg_id": "1234567890"
}
```

---

## 7. 连通测试

### 测试 1：云端服务器

```bash
# 检查进程
ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server"

# 检查端口
ssh root@TRIX_SERVER_HOST "netstat -tuln | grep 8765"
```

### 测试 2：本地 Nanobot 连接云端

打开 `http://localhost:5000`，检查：
- ✅ 显示"云端已连接"
- ✅ 显示配对码

### 测试 3：App 配对

1. 在 App 中进入配对功能
2. 输入 Nanobot 显示的配对码
3. 点击"连接到 Nanobot"

成功标志：
- ✅ 界面显示"配对成功"
- ✅ 浏览器控制台显示连接成功日志

### 测试 4：端到端消息

1. 在 App 中发送"你好"
2. 检查 Nanobot Web 界面是否收到消息
3. 检查 App 是否收到 AI 回复

### 日志查看

**云端日志**:
```bash
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server.log"
```

**App 日志**: 浏览器 F12 控制台

---

## 8. 常见问题

### Q1: 云端服务器启动失败

**错误**: `ModuleNotFoundError: No module named 'websockets'`

**解决**:
```bash
pip3 install websockets
```

### Q2: 端口被占用

**错误**: `OSError: Address already in use`

**解决**:
```bash
# 查找占用进程
lsof -i :8765
# 停止进程
kill -9 <PID>
```

### Q3: Nanobot 无法连接云端

**检查清单**:
1. ✅ 云端服务器是否运行？`ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server"`
2. ✅ 防火墙是否开放端口？
3. ✅ 配置文件地址是否正确？

### Q4: App 无法配对

**检查清单**:
1. ✅ 配对码是否正确？
2. ✅ 云端服务器是否运行？
3. ✅ 浏览器控制台是否有错误？

### Q5: 配对成功但无法收发消息

**原因**:
1. 本地 Nanobot 未运行
2. 设备 ID 不匹配
3. 消息转发失败

**解决**:
- 检查 Nanobot 是否运行
- 查看云端日志
- 重新配对

### Q6: 如何重启云端服务器？

```bash
ssh root@TRIX_SERVER_HOST

# systemd 方式
systemctl restart cloud-server

# nohup 方式
pkill -f cloud_server.py
nohup python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &
```

### Q7: 配对码在哪里查看？

- **Nanobot Web 界面**: `http://localhost:5000`
- **云端日志**: `ssh root@TRIX_SERVER_HOST "journalctl -u cloud-server | grep '配对码'"`

---

## 附录：当前实现分析

### 与理想实现的对比

| 维度 | 当前实现 | 理想实现 | 差异 |
|------|---------|---------|------|
| 连接方式 | ✅ WebSocket | ✅ WebSocket | 一致 |
| 配对方式 | ⚠️ 手动输入配对码 | QR 码扫码 | 体验差异 |
| 数据持久化 | ❌ 内存存储 | ✅ 数据库存储 | ⚠️ 关键差异 |
| 安全性 | ⚠️ 无加密 | ✅ TLS/SSL | 需改进 |

### 改进建议

**P0 - 必须实现**:
- 添加 SQLite 数据库持久化配对关系
- 防止服务器重启后配对丢失

**P1 - 高优先级**:
- 实现 QR 码配对提升用户体验
- 集成 Supabase Auth 身份认证

**P2 - 中优先级**:
- 配置 SSL/TLS 加密
- 实现 Token 认证机制

---

## 相关文档

- [部署指南](deployment/DEPLOY.md) - 服务器部署详细步骤
- [HTTPS 配置](deployment/HTTPS_SETUP_GUIDE.md) - SSL 证书配置
- [Clawbot 集成](guides/CLAWBOT_INTEGRATION_GUIDE.md) - 另一种配对方案

---

*文档整合自: NANOBOT_CONFIG_STATUS.md, NANOBOT_THREE_WAY_CONNECTION_GUIDE.md, CLOUD_SERVER_AND_APP_IMPLEMENTATION.md, IMPLEMENTATION_COMPARISON.md*

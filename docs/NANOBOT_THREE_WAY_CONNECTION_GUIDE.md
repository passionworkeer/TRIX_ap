# Nanobot 三端连通配置指南

> **目标**: 确保 Nanobot 本地、云端服务器、App 前端三端完全连通

---

## 📋 目录

1. [架构概览](#架构概览)
2. [配置信息汇总](#配置信息汇总)
3. [云端服务器配置](#云端服务器配置)
4. [本地 Nanobot 配置](#本地-nanobot-配置)
5. [App 前端配置](#app-前端配置)
6. [连通测试](#连通测试)
7. [常见问题](#常见问题)

---

## 架构概览

### 三端架构图

```
┌─────────────────────────────────────────────────────┐
│           Nanobot 三端通信架构                      │
├─────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐     WebSocket      ┌──────────────┐   │
│  │ 本地 Nanobot  │◄──────────────────►│  云端服务器    │   │
│  │ Windows 本地  │    ws://TRIX_SERVER_HOST│  TRIX_SERVER_HOST  │   │
│  │ :5000        │                   │  :8765        │   │
│  └──────────────┘                   └──────┬───────┘   │
│                                              │             │
│                                              │ WebSocket │
│                                              ▼             │
│                                       ┌──────────────┐   │
│                                       │ App 前端     │   │
│                                       │ trix-3d-     │   │
│                                       │ companion    │   │
│                                       │ http://47.   │   │
│                                       │ 243.55.130   │   │
│                                       └──────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────┘

通信流程：
1. 本地 Nanobot → 云端：注册设备、注册配对码
2. App → 云端：使用配对码配对
3. App → 云端 → 本地 Nanobot：发送消息
4. 本地 Nanobot → 云端 → App：返回回复
```

---

## 配置信息汇总

### 云端服务器

| 配置项 | 值 |
|--------|-----|
| **服务器 IP** | `TRIX_SERVER_HOST` |
| **WebSocket 端口** | `8765` |
| **WebSocket 路径** | `/nanobot/ws` |
| **完整地址** | `ws://TRIX_SERVER_HOST:8765/nanobot/ws` |
| **服务器文件** | `/root/cloud_server.py` |

### 本地 Nanobot

| 配置项 | 值 |
|--------|-----|
| **项目路径** | `e:\desktop\nanobot\nanobot` |
| **Web 界面** | `http://localhost:5000` |
| **WebSocket 地址** | `ws://TRIX_SERVER_HOST:8765/nanobot/ws` |
| **配置文件** | `e:\desktop\nanobot\nanobot\web_interface_final.py` (L18) |
| **设备类型** | `nanobot_local` |

### App 前端

| 配置项 | 值 |
|--------|-----|
| **项目路径** | `e:\desktop\trix-3d-companion` |
| **WebSocket 服务** | `NanobotBridge.ts` |
| **环境变量** | `VITE_NANOBOT_SERVER_URL` (可选，默认使用云端） |
| **设备类型** | `mobile_app` |
| **配对界面** | `src/screens/NanobotPairing.tsx` |

---

## 云端服务器配置

### 步骤 1：检查服务器文件

**连接服务器**：
```bash
ssh root@TRIX_SERVER_HOST
```

**检查文件是否存在**：
```bash
ls -la /root/cloud_server.py
```

如果不存在，从以下位置上传：
- 本地：`e:\desktop\trix-3d-companion\server\cloud_server.py`

### 步骤 2：安装 Python 依赖

```bash
# 更新系统
apt update

# 安装 Python 3 和 websockets
apt install -y python3 python3-pip

# 安装 websockets 库
pip3 install websockets

# 验证安装
python3 -c "import websockets; print('websockets 已安装')"
```

### 步骤 3：启动云端服务器

**方式 A - 直接运行（测试）**：
```bash
cd /root
python3 cloud_server.py
```

**方式 B - 后台运行（推荐）**：
```bash
# 使用 nohup 后台运行
nohup python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &

# 查看日志
tail -f /tmp/cloud_server.log

# 查看进程
ps aux | grep cloud_server

# 停止服务器
pkill -f cloud_server.py
```

**方式 C - 使用 systemd（生产环境）**：

创建服务文件：
```bash
nano /etc/systemd/system/cloud-server.service
```

添加内容：
```ini
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
```

启用服务：
```bash
# 重载 systemd
systemctl daemon-reload

# 启用服务（开机自启）
systemctl enable cloud-server

# 启动服务
systemctl start cloud-server

# 查看状态
systemctl status cloud-server

# 查看日志
journalctl -u cloud-server -f
```

### 步骤 4：检查端口监听

```bash
# 检查 8765 端口是否在监听
netstat -tuln | grep 8765

# 或使用 ss
ss -tuln | grep 8765
```

应该看到类似输出：
```
tcp   0.0.0.0:8765   0.0.0.0:*   LISTEN
```

### 步骤 5：配置防火墙（如果启用）

```bash
# 如果使用 ufw
ufw allow 8765/tcp

# 如果使用 firewalld
firewall-cmd --permanent --add-port=8765/tcp
firewall-cmd --reload

# 阿里云安全组
# 在阿里云控制台添加 8765 端口入站规则
```

---

## 本地 Nanobot 配置

### 步骤 1：检查云端连接配置

**打开配置文件**：
```
e:\desktop\nanobot\nanobot\web_interface_final.py
```

**找到第 18 行**：
```python
CLOUD_SERVER = 'ws://TRIX_SERVER_HOST/nanobot/ws'  # WebSocket地址
```

**确认配置正确**：
- ✅ IP 地址正确：`TRIX_SERVER_HOST`
- ✅ 端口正确：`8765`
- ✅ 路径正确：`/nanobot/ws`
- ✅ 协议正确：`ws://`

### 步骤 2：启动本地 Nanobot

**在 Windows 命令行中**：
```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

**看到以下输出表示成功**：
```
 * Running on http://127.0.0.1:5000
 * Running on http://localhost:5000
```

**访问 Web 界面**：
```
http://localhost:5000
```

### 步骤 3：验证云端连接

**在 Nanobot Web 界面中**：

1. 打开浏览器访问 `http://localhost:5000`
2. 查看左侧边栏的"配对码"部分
3. 如果显示 **"云端已连接"**，说明连接成功
4. 应该能看到一个 8 位配对码（如：`A1B2C3D4`）

**检查连接日志**：
```
正在连接云端: ws://TRIX_SERVER_HOST:8765/nanobot/ws...
设备注册: nanobot_local_xxxxxx
配对码注册: A1B2C3D4 (Nanobot: nanobot_local_xxxxxx)
```

---

## App 前端配置

### 步骤 1：检查环境变量

**查看环境变量配置**：
```bash
cd e:\desktop\trix-3d-companion
cat .env.local | grep NANOBOT
```

**或检查默认配置**：
```typescript
// 文件：src/services/NanobotBridge.ts (L49)
this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'ws://TRIX_SERVER_HOST:8765';
```

**确认配置正确**：
- ✅ IP 地址正确：`TRIX_SERVER_HOST`
- ✅ 端口正确：`8765`
- ✅ 协议正确：`ws://` 或 `wss://`（如果配置了 SSL）

### 步骤 2：启动前端开发服务器

```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

访问 `http://localhost:5173`

### 步骤 3：进入配对界面

**在 App 中**：

1. 点击进入"配对"功能
2. 应该看到 Nanobot 配对界面（`src/screens/NanobotPairing.tsx`）
3. 输入云端显示的配对码

**配对界面应该显示**：
- ✅ 配对码输入框（8 位大写字母+数字）
- ✅ "连接到 Nanobot"按钮
- ✅ 连接状态提示

---

## 连通测试

### 测试 1：云端服务器运行状态

**在服务器上**：
```bash
ps aux | grep cloud_server
```

**预期输出**：
```
root     12345  ... python3 /root/cloud_server.py
```

**检查端口**：
```bash
netstat -tuln | grep 8765
```

**预期输出**：
```
tcp   0.0.0.0:8765   0.0.0.0:*   LISTEN
```

---

### 测试 2：本地 Nanobot 连接云端

**检查本地 Nanobot 日志**：

在 Nanobot Web 界面 (`http://localhost:5000`) 中，应该看到：

```
✓ 云端已连接
✓ 配对码：A1B2C3D4
✓ 有效期：3600 秒（1 小时）
```

**或检查命令行输出**：
```
正在连接云端: ws://TRIX_SERVER_HOST:8765/nanobot/ws...
设备注册成功
配对码已发送到云端
```

---

### 测试 3：App 连接云端并配对

**在 App 中**：

1. 访问 `http://localhost:5173`
2. 进入"配对"功能
3. 输入 Nanobot 显示的配对码
4. 点击"连接到 Nanobot"

**成功标志**：
- ✅ 界面显示"配对成功"
- ✅ 可以看到 Nanobot 的设备信息
- ✅ 浏览器控制台显示：
  ```
  [NanobotBridge] 设备注册成功: app_xxxxxx
  [NanobotBridge] 配对成功: A1B2C3D4
  [NanobotBridge] WebSocket 已连接
  ```

---

### 测试 4：端到端消息测试

**在 App 中发送消息**：

1. 进入与 Nanobot 的聊天界面
2. 发送消息："你好"
3. 等待回复（应该很快）

**检查流程**：

1. **App 发送**：
   ```
   [NanobotBridge] 消息已发送: 1234567890
   ```

2. **本地 Nanobot Web 界面**：
   - 应该收到消息："你好"
   - AI 会生成回复
   - 回复会发送回云端

3. **App 收到回复**：
   ```
   [NanobotBridge] 收到回复: {msg_id: "1234567890", response: "你好！我是 Nanobot..."}
   ```

---

### 测试 5：云端服务器日志验证

**在服务器上查看实时日志**：

```bash
# 如果使用 systemd
journalctl -u cloud-server -f

# 如果使用 nohup
tail -f /tmp/cloud_server.log
```

**应该看到完整的通信日志**：
```log
2026-02-14 12:00:00 - INFO - 云服务器初始化完成 (内存存储模式)
2026-02-14 12:00:05 - INFO - 设备注册: nanobot_local_xxxxxx (nanobot_local)
2026-02-14 12:00:06 - INFO - 配对码注册: A1B2C3D4 (Nanobot: nanobot_local_xxxxxx)
2026-02-14 12:00:10 - INFO - 设备注册: app_xxxxxx (mobile_app)
2026-02-14 12:00:11 - INFO - 配对成功: A1B2C3D4 (App: app_xxxxxx, Nanobot: nanobot_local_xxxxxx)
2026-02-14 12:00:15 - INFO - 消息转发: app_xxxxxx -> nanobot_local_xxxxxx
2026-02-14 12:00:16 - INFO - 回复转发: nanobot_local_xxxxxx -> app_xxxxxx
```

---

## 常见问题

### Q1: 云端服务器启动失败

**错误**：
```
ModuleNotFoundError: No module named 'websockets'
```

**解决**：
```bash
pip3 install websockets
```

---

### Q2: 端口被占用

**错误**：
```
OSError: [Errno 98] Address already in use
```

**解决**：
```bash
# 查找占用进程
lsof -i :8765

# 停止进程
kill -9 <PID>

# 或更换端口
# 修改 cloud_server.py 第 31 行
PORT = 8766  # 改成其他端口
```

---

### Q3: 本地 Nanobot 无法连接云端

**症状**：
- Nanobot Web 界面显示"云端未连接"
- 配对码无法生成

**检查清单**：

1. ✅ 云端服务器是否运行？
   ```bash
   ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server"
   ```

2. ✅ 防火墙是否开放 8765 端口？
   ```bash
   ssh root@TRIX_SERVER_HOST "ufw status | grep 8765"
   ```

3. ✅ 本地配置文件地址是否正确？
   ```python
   # e:\desktop\nanobot\nanobot\web_interface_final.py L18
   CLOUD_SERVER = 'ws://TRIX_SERVER_HOST:8765/nanobot/ws'
   ```

4. ✅ 网络是否可达？
   ```bash
   # 在本地 Windows 命令行
   telnet TRIX_SERVER_HOST 8765
   ```

---

### Q4: App 无法连接云端

**症状**：
- App 界面显示"连接错误"
- 配对失败

**检查清单**：

1. ✅ 云端服务器是否运行？
2. ✅ 环境变量是否正确？
   ```typescript
   // src/services/NanobotBridge.ts L49
   this.serverUrl = 'ws://TRIX_SERVER_HOST:8765';
   ```
3. ✅ 浏览器控制台错误？
   ```
   按 F12 打开控制台查看错误信息
   ```

4. ✅ WebSocket 连接地址？
   ```javascript
   // 应该是
   ws://TRIX_SERVER_HOST:8765
   // 不是
   ws://TRIX_SERVER_HOST/nanobot/ws  (注意路径)
   ```

---

### Q5: 配对成功但无法收发消息

**症状**：
- 配对显示成功
- 发送消息无响应

**原因分析**：

1. **本地 Nanobot 未运行**
   - 检查：`http://localhost:5000` 是否可访问
   - 启动：`python e:\desktop\nanobot\nanobot\web_interface_final.py`

2. **设备 ID 不匹配**
   - 检查云端日志中的配对映射
   - 重新配对

3. **消息转发失败**
   - 检查云端服务器日志
   - 查看错误信息

---

### Q6: 如何重启云端服务器？

```bash
ssh root@TRIX_SERVER_HOST

# 如果使用 systemd
systemctl restart cloud-server

# 如果使用 nohup
pkill -f cloud_server.py
nohup python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &

# 验证重启成功
ps aux | grep cloud_server
```

---

### Q7: 如何查看云端服务器实时日志？

```bash
ssh root@TRIX_SERVER_HOST

# systemd 方式（推荐）
journalctl -u cloud-server -f

# nohup 方式
tail -f /tmp/cloud_server.log

# 或查看最后 100 行
tail -n 100 /tmp/cloud_server.log
```

---

### Q8: 配对码在哪里查看？

**本地 Nanobot Web 界面**：
1. 访问 `http://localhost:5000`
2. 查看左侧"配对码"部分
3. 应该显示类似：`A1B2C3D4`

**云端服务器日志**：
```bash
ssh root@TRIX_SERVER_HOST "journalctl -u cloud-server | grep '配对码注册'"
```

---

### Q9: 如何清除旧配对？

**在 App 中**：
```typescript
// 清除配对信息
localStorage.removeItem('nanobot_pairing_code');
localStorage.removeItem('nanobot_device_id');
localStorage.removeItem('nanobot_connected');

// 重新加载页面
location.reload();
```

**在云端服务器**（需要修改代码）：
- 重启服务器会清除内存中的所有配对
- 或添加 `/api/pairing/reset` 接口

---

### Q10: 支持多个 App 同时配对？

**支持**！云端服务器设计为支持：

1. ✅ 多个设备可以同时注册
2. ✅ 每个设备有独立的 `device_id`
3. ✅ 每次配对生成新的配对码
4. ✅ 支持多个 App 同时连接同一个 Nanobot

**测试步骤**：
1. 在 App1 中配对 Nanobot
2. 在 App2 中配对同一个 Nanobot（使用相同的配对码）
3. 两个 App 应该都能收到消息

---

## 快速参考命令

### 云端服务器

```bash
# SSH 连接
ssh root@TRIX_SERVER_HOST

# 启动服务器
python3 /root/cloud_server.py

# 后台运行
nohup python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &

# 查看日志
tail -f /tmp/cloud_server.log

# 停止服务器
pkill -f cloud_server.py

# 查看进程
ps aux | grep cloud_server

# 查看端口
netstat -tuln | grep 8765
```

### 本地 Nanobot

```bash
# 启动
python e:\desktop\nanobot\nanobot\web_interface_final.py

# 访问 Web 界面
# http://localhost:5000
```

### App 前端

```bash
# 启动开发服务器
cd e:\desktop\trix-3d-companion
npm run dev

# 访问
# http://localhost:5173
```

---

## 通信协议速查

### WebSocket 消息类型

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `register` | 设备→云端 | 设备注册 |
| `register_pairing` | Nanobot→云端 | 注册配对码 |
| `app_pairing` | App→云端 | App 配对请求 |
| `pairing_success` | 云端→设备 | 配对成功通知 |
| `chat_message` | App→云端 | 发送消息 |
| `chat_response` | Nanobot→云端 | AI 回复 |
| `ping`/`pong` | 双向 | 心跳保活 |

### 设备 ID 格式

| 设备类型 | 格式 | 示例 |
|---------|------|------|
| Nanobot | `nanobot_local_<8位>` | `nanobot_local_a1b2c3d4` |
| App | `app_<随机36位>` | `app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

---

## 总结

### 配置完成标志

- ✅ **云端服务器**：运行在 `TRIX_SERVER_HOST:8765`
- ✅ **本地 Nanobot**：连接到云端，显示配对码
- ✅ **App 前端**：使用配对码成功配对
- ✅ **消息测试**：App 发送消息，收到 Nanobot 回复

### 日常使用流程

1. **启动云端服务器**（如果没有运行）：
   ```bash
   ssh root@TRIX_SERVER_HOST "systemctl start cloud-server"
   ```

2. **启动本地 Nanobot**：
   ```bash
   python e:\desktop\nanobot\nanobot\web_interface_final.py
   ```

3. **启动 App 前端**：
   ```bash
   cd e:\desktop\trix-3d-companion
   npm run dev
   ```

4. **开始使用**：
   - 在 App 中配对 Nanobot
   - 发送消息测试
   - 享受 AI 对话体验！

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-14
**维护者**: Claude Sonnet 4.5

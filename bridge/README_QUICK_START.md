# 🚀 服务器快速部署指南

## ⚡ 最简单的部署方法（3分钟完成）

### 步骤1：SSH登录服务器

在你的本地电脑打开PowerShell或CMD，执行：

```bash
ssh root@47.243.55.130
```

### 步骤2：复制粘贴以下命令（一次性完成）

直接复制下面整段命令粘贴到SSH终端：

```bash
mkdir -p /root/nanobot && cd /root/nanobot && cat > relay_server.py << 'EOF'
#!/usr/bin/env python3
import asyncio, json, logging, uuid
from datetime import datetime
import websockets

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s')
logger = logging.getLogger(__name__)

class RelayServer:
    def __init__(self):
        self.bridges = {}
        self.apps = {}

    async def handle_connection(self, websocket, path):
        conn_id = str(uuid.uuid4())
        logger.info(f"新连接: {conn_id}")
        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get('type')
                if msg_type == 'bridge_register':
                    self.bridges[conn_id] = {'socket': websocket}
                    logger.info("Bridge注册成功")
                    await websocket.send(json.dumps({'type': 'bridge_registered', 'success': True}))
                elif msg_type == 'app_register':
                    self.apps[conn_id] = {'socket': websocket}
                    logger.info("App注册成功")
                    await websocket.send(json.dumps({'type': 'app_registered', 'success': True}))
                elif msg_type == 'app_message':
                    content = data.get('content', '')
                    logger.info(f"App消息: {content[:30]}...")
                    for bridge in self.bridges.values():
                        try: await bridge['socket'].send(json.dumps({'type': 'app_message', 'content': content}))
                        except: pass
                elif msg_type == 'bot_message':
                    content = data.get('content', '')
                    logger.info(f"Bridge响应: {content[:30]}...")
                    for app in self.apps.values():
                        try: await app['socket'].send(json.dumps({'type': 'bot_message', 'content': content}))
                        except: pass
                elif msg_type == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
        except Exception as e:
            logger.error(f"错误: {e}")
        finally:
            self.bridges.pop(conn_id, None)
            self.apps.pop(conn_id, None)

async def main():
    server = RelayServer()
    async with websockets.serve(server.handle_connection, '0.0.0.0', 8765):
        logger.info("Relay Server已启动: ws://0.0.0.0:8765")
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
EOF
pip3 install websockets aiohttp -q && pm2 stop relay-server 2>/dev/null; pm2 delete relay-server 2>/dev/null; pm2 start relay_server.py --name relay-server --interpreter python3 && pm2 save && sleep 2 && pm2 status relay-server
```

**就这么简单！** ✅

### 步骤3：开放防火墙端口（如果需要）

```bash
# 方法1：使用ufw
sudo ufw allow 8765/tcp

# 方法2：使用firewalld
sudo firewall-cmd --permanent --add-port=8765/tcp
sudo firewall-cmd --reload

# 方法3：使用iptables
sudo iptables -I INPUT -p tcp --dport 8765 -j ACCEPT
sudo iptables-save
```

### 步骤4：验证服务运行

```bash
# 查看服务状态
pm2 status relay-server

# 查看日志
pm2 logs relay-server

# 检查端口
netstat -tuln | grep 8765
```

---

## 🏠 本地电脑配置

### 启动本地Bridge

打开新的PowerShell窗口：

```powershell
cd e:\desktop\trix-3d-companion\bridge

# 方式1：直接运行（查看日志）
node openclaw-bridge.js

# 方式2：使用PM2（后台运行）
pm2 start openclaw-bridge.js --name openclaw-bridge
pm2 logs openclaw-bridge
```

**预期输出**：
```
[Bridge] 🚀 正在连接云端 Relay Server: ws://47.243.55.130:8765
[Bridge] ✅ 已连接到云端 Relay Server
```

### 确保OpenClaw运行

```powershell
# 检查是否运行
netstat -ano | findstr :18789

# 如果没有运行，启动它
start /B node "C:\nodejs_global\node_modules\openclaw-cn\dist\index.js"
```

---

## 📱 手机测试

1. 打开手机浏览器
2. 访问：**http://47.243.55.130**
3. 登录并进入Clawbot聊天页面
4. 发送测试消息：**"你好 OpenClaw"**

**预期结果**：<1秒收到AI回复！⚡

---

## 🔍 验证完整链路

### 服务器端

```bash
ssh root@47.243.55.130 "pm2 logs relay-server --lines 10"
```

**预期输出**：
```
✅ Relay Server已启动: ws://0.0.0.0:8765
新连接: xxx
Bridge注册成功
App注册成功
App消息: 你好
Bridge响应: 你好！我是...
```

### 本地Bridge

```powershell
pm2 logs openclaw-bridge --lines 10
```

**预期输出**：
```
[Bridge] ✅ 已连接到云端 Relay Server
[Bridge] 📨 收到 App 消息: 你好
[Bridge] ✅ OpenClaw 响应成功: 你好！我是...
[Bridge] 📤 发送 AI 响应回云端
```

---

## 🎯 完整架构

```
📱 手机 (4G/5G/WiFi)
  ↓
☁️ 47.243.55.130
  ├─ Web App (Nginx)
  └─ Relay Server (:8765) ←→ 本地Bridge
                              ↓
                          🤖 OpenClaw (localhost:18789)
```

---

## 📊 部署检查清单

- [ ] 服务器Relay Server运行中
- [ ] 本地Bridge连接到云端
- [ ] OpenClaw Gateway运行中
- [ ] 防火墙端口8765已开放
- [ ] 手机可以访问服务器IP
- [ ] App可以连接Relay Server
- [ ] 消息收发正常

---

## 🐛 故障排查

### Bridge无法连接

```powershell
# 测试服务器连通性
ping 47.243.55.130

# 测试端口
telnet 47.243.55.130 8765
```

### 手机无法访问

```bash
# 检查Nginx/Apache
systemctl status nginx

# 重启Web服务器
systemctl restart nginx
```

### OpenClaw无响应

```powershell
# 检查OpenClaw
netstat -ano | findstr :18789

# 重启OpenClaw
# 停止旧进程，重新启动
```

---

## ✅ 完成！

**部署完成！** 🎉

现在你可以：
- 📱 通过手机4G/5G访问App
- 💻 OpenClaw在本地电脑运行
- 🔗 扫码快速配对
- ⚡ 享受跨网络AI聊天！

---

**快速命令参考**：

```bash
# 服务器
pm2 status relay-server
pm2 logs relay-server
pm2 restart relay-server

# 本地
pm2 status openclaw-bridge
pm2 logs openclaw-bridge
pm2 restart openclaw-bridge
```

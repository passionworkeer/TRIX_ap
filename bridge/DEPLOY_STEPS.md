# 🚀 服务器部署完整指南

## 📋 部署步骤（由于SSH需要密码，需手动操作）

### 方式一：使用SCP + SSH手动部署

#### 步骤1：上传文件到服务器

在本地电脑打开PowerShell或CMD，执行：

```bash
# 上传Relay Server
scp e:\desktop\trix-3d-companion\bridge\relay_server_with_bridge.py root@47.243.55.130:/root/nanobot/

# 上传部署脚本
scp e:\desktop\trix-3d-companion\bridge\SERVER_DEPLOY_MANUAL.sh root@47.243.55.130:/root/nanobot/
```

#### 步骤2：SSH登录服务器

```bash
ssh root@47.243.55.130
```

#### 步骤3：执行部署脚本

```bash
cd /root/nanobot
chmod +x SERVER_DEPLOY_MANUAL.sh
./SERVER_DEPLOY_MANUAL.sh
```

---

### 方式二：完全手动部署（最简单）

#### 步骤1：SSH登录服务器

```bash
ssh root@47.243.55.130
```

#### 步骤2：创建并启动Relay Server

```bash
# 创建目录
mkdir -p /root/nanobot
cd /root/nanobot

# 创建Relay Server文件
cat > relay_server_with_bridge.py << 'EOFPYTHON'
#!/usr/bin/env python3
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict
import websockets

# 配置
PORT = 8765
HOST = '0.0.0.0'

# 日志
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s')
logger = logging.getLogger(__name__)

class RelayServer:
    def __init__(self):
        self.bridges: Dict[str, dict] = {}
        self.apps: Dict[str, dict] = {}

    async def handle_connection(self, websocket, path):
        connection_id = str(uuid.uuid4())
        logger.info(f"🔌 新连接: {connection_id}")

        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get('type')

                # Bridge注册
                if msg_type == 'bridge_register':
                    self.bridges[connection_id] = {
                        'socket': websocket,
                        'connected_at': datetime.now().isoformat()
                    }
                    logger.info(f"✅ Bridge注册: {connection_id}")
                    await websocket.send(json.dumps({
                        'type': 'bridge_registered',
                        'success': True
                    }))

                # App注册
                elif msg_type == 'app_register':
                    self.apps[connection_id] = {
                        'userId': data.get('userId'),
                        'socket': websocket
                    }
                    logger.info(f"✅ App注册: {data.get('userId')}")
                    await websocket.send(json.dumps({
                        'type': 'app_registered',
                        'success': True
                    }))

                # App消息 → Bridge
                elif msg_type == 'app_message':
                    content = data.get('content', '')
                    logger.info(f"📨 App消息: {content[:50]}...")

                    # 转发到所有Bridge
                    for bridge_id, bridge_info in self.bridges.items():
                        try:
                            await bridge_info['socket'].send(json.dumps({
                                'type': 'app_message',
                                'content': content,
                                'messageId': data.get('messageId')
                            }))
                        except:
                            pass

                # Bridge消息 → App
                elif msg_type == 'bot_message':
                    content = data.get('content', '')
                    logger.info(f"📨 Bridge响应: {content[:50]}...")

                    # 转发到所有App
                    for app_id, app_info in self.apps.items():
                        try:
                            await app_info['socket'].send(json.dumps({
                                'type': 'bot_message',
                                'content': content,
                                'timestamp': int(datetime.now().timestamp() * 1000)
                            }))
                        except:
                            pass

                # 心跳
                elif msg_type == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))

        except Exception as e:
            logger.error(f"连接错误: {e}")
        finally:
            if connection_id in self.bridges:
                del self.bridges[connection_id]
                logger.info(f"🔌 Bridge断开: {connection_id}")
            if connection_id in self.apps:
                del self.apps[connection_id]
                logger.info(f"🔌 App断开: {connection_id}")

async def main():
    server = RelayServer()
    logger.info(f"🚀 Relay Server启动: {HOST}:{PORT}")

    async with websockets.serve(server.handle_connection, HOST, PORT):
        logger.info(f"✅ Relay Server已启动: ws://0.0.0.0:{PORT}")
        await asyncio.Future()

if __name__ == '__main__':
    print("""
╔════════════════════════════════════════════════════════╗
║        Cloud Relay Server (Production)                 ║
╠════════════════════════════════════════════════════════╣
║  Port:     8765                                       ║
║  Status:   Starting...                                ║
╚════════════════════════════════════════════════════════╝
    """)
    asyncio.run(main())
EOFPYTHON

# 安装依赖
pip3 install websockets

# 启动服务
pm2 start relay_server_with_bridge.py --name relay-server --interpreter python3
pm2 save

# 查看状态
pm2 status
```

#### 步骤4：开放防火墙端口

```bash
# 如果使用ufw
sudo ufw allow 8765/tcp

# 如果使用firewalld
sudo firewall-cmd --permanent --add-port=8765/tcp
sudo firewall-cmd --reload

# 如果使用iptables
sudo iptables -A INPUT -p tcp --dport 8765 -j ACCEPT
sudo iptables-save
```

#### 步骤5：验证服务

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

### 步骤1：启动本地Bridge

在本地电脑PowerShell中执行：

```powershell
cd e:\desktop\trix-3d-companion\bridge

# 方式1：直接运行（查看日志）
node openclaw-bridge.js

# 方式2：使用PM2（后台运行）
pm2 start openclaw-bridge.js --name openclaw-bridge
pm2 logs openclaw-bridge
```

### 步骤2：验证Bridge连接

Bridge应该显示：

```
[Bridge] 🚀 正在连接云端 Relay Server: ws://47.243.55.130:8765
[Bridge] ✅ 已连接到云端 Relay Server
```

### 步骤3：确保OpenClaw运行

```powershell
# 检查OpenClaw是否运行
netstat -ano | findstr :18789

# 如果没有运行，启动它
start /B node "C:\nodejs_global\node_modules\openclaw-cn\dist\index.js"
```

---

## 📱 手机端测试

### 步骤1：访问App

在手机浏览器中打开：

```
http://47.243.55.130
```

### 步骤2：登录并配对

1. 登录你的账号
2. 进入Clawbot聊天页面
3. 扫描二维码或输入配对码
4. 确认配对

### 步骤3：测试聊天

发送消息：**"你好 OpenClaw"**

预期响应：**<1秒收到AI回复**

---

## 🔍 验证完整链路

### 1. 检查云端Relay Server

```bash
ssh root@47.243.55.130 "pm2 logs relay-server --lines 20"
```

预期输出：
```
✅ Relay Server已启动: ws://0.0.0.0:8765
🔌 新连接: xxx
✅ Bridge注册: xxx
✅ App注册: xxx
📨 App消息: 你好
📨 Bridge响应: 你好！我是...
```

### 2. 检查本地Bridge

```powershell
pm2 logs openclaw-bridge --lines 20
```

预期输出：
```
[Bridge] ✅ 已连接到云端 Relay Server
[Bridge] 📨 收到 App 消息: 你好
[Bridge] 调用 OpenClaw Gateway (尝试 1/4)
[Bridge] ✅ OpenClaw 响应成功: 你好！我是...
[Bridge] 📤 发送 AI 响应回云端
```

### 3. 测试OpenClaw API

```powershell
curl -X POST http://127.0.0.1:18789/v1/chat/completions ^
  -H "Authorization: Bearer 3162c7078b7fa574271f483401729cac57f309cd2a507dd7" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"zai/glm-4.7\",\"messages\":[{\"role\":\"user\",\"content\":\"测试\"}],\"stream\":false}"
```

---

## 🎯 完整消息流测试

```
📱 手机
  ↓ "你好"
☁️ 云端Relay Server (47.243.55.130:8765)
  ↓ 转发消息
💻 本地Bridge (你的电脑)
  ↓ HTTP POST
🤖 OpenClaw Gateway (localhost:18789)
  ↓ AI生成响应
💻 本地Bridge
  ↓ Socket.IO
☁️ 云端Relay Server
  ↓ Socket.IO
📱 手机收到回复
```

---

## 🐛 故障排查

### 问题1：Bridge无法连接云端

**检查**：
```powershell
# 测试服务器连通性
ping 47.243.55.130

# 测试端口
telnet 47.243.55.130 8765
```

**解决**：
- 检查防火墙
- 确认Relay Server运行
- 查看服务器日志

### 问题2：手机无法访问App

**检查**：
```bash
# 在服务器上检查Nginx/Apache
systemctl status nginx
# 或
systemctl status apache2
```

**解决**：
- 确认Web服务器运行
- 检查端口80/443
- 查看Nginx/Apache日志

### 问题3：OpenClaw无响应

**检查**：
```powershell
# 检查OpenClaw进程
netstat -ano | findstr :18789

# 测试API
curl http://127.0.0.1:18789
```

**解决**：
- 重启OpenClaw Gateway
- 检查Token配置
- 查看OpenClaw日志

---

## 📞 快速命令参考

### 云端服务器

```bash
# SSH登录
ssh root@47.243.55.130

# 查看Relay Server状态
pm2 status relay-server

# 查看实时日志
pm2 logs relay-server

# 重启服务
pm2 restart relay-server

# 停止服务
pm2 stop relay-server
```

### 本地电脑

```powershell
# 启动Bridge
cd e:\desktop\trix-3d-companion\bridge
node openclaw-bridge.js

# 使用PM2
pm2 start openclaw-bridge.js --name openclaw-bridge
pm2 logs openclaw-bridge
pm2 restart openclaw-bridge

# 检查OpenClaw
netstat -ano | findstr :18789
```

---

## ✅ 部署完成检查清单

- [ ] 云端Relay Server运行正常
- [ ] 本地Bridge连接到云端
- [ ] OpenClaw Gateway运行正常
- [ ] 手机可以访问服务器IP
- [ ] App可以连接Relay Server
- [ ] 配对功能正常
- [ ] 消息收发正常

---

**部署完成！** 🎉

现在你可以通过手机访问 **http://47.243.55.130** 来使用App了！

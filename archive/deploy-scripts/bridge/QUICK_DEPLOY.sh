#!/bin/bash
# ============================================================
# 快速部署脚本 - 在服务器上直接执行
# ============================================================
# SSH登录后执行: curl -sSL http://your-server/deploy.sh | bash
# 或直接复制粘贴此脚本内容

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     OpenClaw Gateway Bridge - 快速部署                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 1. 安装依赖
echo "[1/5] 安装Python依赖..."
pip3 install websockets aiohttp -q 2>/dev/null || pip3 install websockets aiohttp
echo "✅ 依赖安装完成"
echo ""

# 2. 创建Relay Server
echo "[2/5] 创建Relay Server..."
cd /root/nanobot

cat > relay_server_simple.py << 'EOFPY'
#!/usr/bin/env python3
import asyncio
import json
import logging
import uuid
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
        logger.info(f"🔌 新连接: {conn_id}")

        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get('type')

                if msg_type == 'bridge_register':
                    self.bridges[conn_id] = {'socket': websocket}
                    logger.info(f"✅ Bridge注册")
                    await websocket.send(json.dumps({'type': 'bridge_registered', 'success': True}))

                elif msg_type == 'app_register':
                    self.apps[conn_id] = {'socket': websocket, 'userId': data.get('userId')}
                    logger.info(f"✅ App注册: {data.get('userId')}")
                    await websocket.send(json.dumps({'type': 'app_registered', 'success': True}))

                elif msg_type == 'app_message':
                    content = data.get('content', '')
                    logger.info(f"📨 App消息: {content[:30]}...")
                    for bridge in self.bridges.values():
                        try:
                            await bridge['socket'].send(json.dumps({'type': 'app_message', 'content': content}))
                        except:
                            pass

                elif msg_type == 'bot_message':
                    content = data.get('content', '')
                    logger.info(f"📨 Bridge响应: {content[:30]}...")
                    for app in self.apps.values():
                        try:
                            await app['socket'].send(json.dumps({'type': 'bot_message', 'content': content}))
                        except:
                            pass

                elif msg_type == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))

        except Exception as e:
            logger.error(f"错误: {e}")
        finally:
            self.bridges.pop(conn_id, None)
            self.apps.pop(conn_id, None)
            logger.info(f"🔌 断开连接: {conn_id}")

async def main():
    server = RelayServer()
    logger.info(f"🚀 Relay Server启动: 0.0.0.0:8765")
    async with websockets.serve(server.handle_connection, '0.0.0.0', 8765):
        logger.info(f"✅ 已启动: ws://0.0.0.0:8765")
        await asyncio.Future()

if __name__ == '__main__':
    print("""
╔════════════════════════════════════════════════════════╗
║        Cloud Relay Server                              ║
╠════════════════════════════════════════════════════════╣
║  Port:     8765                                       ║
║  Status:   Starting...                                ║
╚════════════════════════════════════════════════════════╝
""")
    asyncio.run(main())
EOFPYTHON

echo "✅ Relay Server创建完成"
echo ""

# 3. 停止旧服务
echo "[3/5] 停止旧服务..."
pm2 stop relay-server 2>/dev/null || true
pm2 delete relay-server 2>/dev/null || true
echo "✅ 旧服务已清理"
echo ""

# 4. 启动服务
echo "[4/5] 启动Relay Server..."
pm2 start relay_server_simple.py --name relay-server --interpreter python3
pm2 save
echo "✅ 服务已启动"
echo ""

# 5. 验证状态
echo "[5/5] 验证服务状态..."
sleep 2
pm2 status relay-server
echo ""

# 6. 检查端口
echo "检查端口监听..."
if command -v netstat &> /dev/null; then
    netstat -tuln | grep 8765 && echo "✅ 端口8765已监听" || echo "⚠️ 端口未监听"
fi
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║                  🎉 部署完成！                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 常用命令:"
echo "  pm2 status relay-server"
echo "  pm2 logs relay-server"
echo "  pm2 restart relay-server"
echo ""
echo "🔗 配置信息:"
echo "  WebSocket: ws://TRIX_SERVER_HOST:8765"
echo ""
echo "📱 下一步:"
echo "  1. 本地电脑运行: cd e:\\desktop\\trix-3d-companion\\bridge && node openclaw-bridge.js"
echo "  2. 手机访问: http://TRIX_SERVER_HOST"
echo "  3. 在App中配对OpenClaw"
echo ""

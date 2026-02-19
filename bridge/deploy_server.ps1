# 服务器部署辅助脚本
# 使用方法：在PowerShell中运行 .\deploy_server.ps1

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     OpenClaw Gateway Bridge - 服务器部署工具          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$SERVER = "47.243.55.130"
$USER = "root"

Write-Host "正在连接服务器: $SERVER ..." -ForegroundColor Yellow
Write-Host ""

# 方法1：使用Windows内置的ssh
Write-Host "请输入SSH密码（如果提示）:" -ForegroundColor Green

# 创建临时脚本
$tempScript = @"
mkdir -p /root/nanobot && cd /root/nanobot && cat > relay_server.py << 'EOFPYTHON'
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
EOFPYTHON

pip3 install websockets aiohttp -q
pm2 stop relay-server 2>/dev/null; pm2 delete relay-server 2>/dev/null
pm2 start relay_server.py --name relay-server --interpreter python3
pm2 save
sleep 2
pm2 status relay-server
netstat -tuln | grep 8765
echo "部署完成！"
"@

# 保存到临时文件
$tempScript | Out-File -FilePath "$env:TEMP\deploy_relay_server.sh" -Encoding UTF8

# 上传并执行
Write-Host "正在上传并执行部署脚本..." -ForegroundColor Yellow
scp "$env:TEMP\deploy_relay_server.sh" "${USER}@${SERVER}:/tmp/deploy.sh"
ssh "${USER}@${SERVER}" "bash /tmp/deploy.sh"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  部署完成！                             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 本地Bridge已经在运行" -ForegroundColor White
Write-Host "2. 手机访问: http://$SERVER" -ForegroundColor White
Write-Host "3. 在App中配对OpenClaw" -ForegroundColor White
Write-Host ""
Write-Host "常用命令:" -ForegroundColor Cyan
Write-Host "  查看服务状态: ssh $USER@$SERVER 'pm2 status relay-server'" -ForegroundColor Gray
Write-Host "  查看日志:     ssh $USER@$SERVER 'pm2 logs relay-server'" -ForegroundColor Gray
Write-Host ""

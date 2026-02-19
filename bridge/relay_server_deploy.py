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

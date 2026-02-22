#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云端 Relay Server - 完整版本（支持 OpenClaw Bridge）
部署在 47.243.55.130:8765

运行方式：
1. 安装依赖: pip install websockets asyncio aiohttp
2. 运行: python relay_server_with_bridge.py
3. 或使用 PM2: pm2 start relay_server_with_bridge.py --name relay-server
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Set
import aiohttp

# ==================== 日志配置 ====================

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==================== 配置 ====================

PORT = 8765
HOST = '0.0.0.0'

# ==================== Relay Server 类 ====================

class RelayServer:
    def __init__(self):
        # 连接管理
        self.connections: Dict[str, any] = {}  # socket_id -> WebSocket
        self.devices: Dict[str, dict] = {}     # device_id -> device_info
        self.bridges: Dict[str, dict] = {}     # bridge_id -> bridge_info

        # 统计
        self.stats = {
            'total_connections': 0,
            'active_connections': 0,
            'messages_forwarded': 0
        }

    async def register_bridge(self, websocket, bridge_id: str, data: dict):
        """注册 OpenClaw Bridge"""
        bridge_type = data.get('type')
        version = data.get('version', '1.0.0')

        if bridge_type != 'openclaw':
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '仅支持 openclaw 类型的 Bridge'
            }, ensure_ascii=False))
            return

        # 存储 Bridge 信息
        self.bridges[bridge_id] = {
            'type': bridge_type,
            'version': version,
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'status': 'online'
        }

        self.connections[bridge_id] = websocket
        self.devices[bridge_id] = {
            'type': 'openclaw_bridge',
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'version': version
        }

        logger.info(f"✅ OpenClaw Bridge 注册成功 (v{version}, ID: {bridge_id})")

        await websocket.send(json.dumps({
            'type': 'bridge_registered',
            'bridge_id': bridge_id,
            'success': True,
            'message': 'Bridge 注册成功'
        }, ensure_ascii=False))

    async def register_app(self, websocket, device_id: str, data: dict):
        """注册 App 设备"""
        user_id = data.get('userId')

        self.connections[device_id] = websocket
        self.devices[device_id] = {
            'type': 'mobile_app',
            'userId': user_id,
            'connection': websocket,
            'connected_at': datetime.now().isoformat()
        }

        logger.info(f"✅ App 注册成功 (用户: {user_id}, ID: {device_id})")

        await websocket.send(json.dumps({
            'type': 'app_registered',
            'device_id': device_id,
            'success': True,
            'message': 'App 注册成功'
        }, ensure_ascii=False))

    async def handle_app_message(self, websocket, device_id: str, data: dict):
        """处理 App 消息（转发到 OpenClaw Bridge）"""
        content = data.get('content') or data.get('message', '')
        message_id = data.get('messageId') or data.get('msg_id', str(uuid.uuid4()))
        user_id = data.get('userId', 'unknown')

        logger.info(f"📨 收到 App 消息: {content[:50]}... (from: {user_id})")

        # 查找可用的 OpenClaw Bridge
        openclaw_bridge = self.find_openclaw_bridge()

        if not openclaw_bridge:
            logger.warning(f"⚠️ 未找到可用的 OpenClaw Bridge")

            await websocket.send(json.dumps({
                'type': 'bot_message',
                'content': 'AI 助手离线。请确保本地电脑运行着 openclaw-bridge.js',
                'contentType': 'text',
                'timestamp': int(datetime.now().timestamp() * 1000),
                'error': True,
                'messageId': message_id
            }, ensure_ascii=False))
            return

        # 转发消息到本地 Bridge
        logger.info(f"📤 转发消息到 OpenClaw Bridge...")
        try:
            await openclaw_bridge['connection'].send(json.dumps({
                'type': 'app_message',
                'content': content,
                'messageId': message_id,
                'userId': user_id,
                'device_id': device_id,
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False))
            self.stats['messages_forwarded'] += 1
        except Exception as e:
            logger.error(f"转发消息失败: {e}")

    async def handle_bot_message(self, websocket, data: dict):
        """转发来自 Bridge 的 AI 响应回 App"""
        content = data.get('content', '')
        message_id = data.get('messageId') or data.get('msg_id')
        error = data.get('error', False)

        logger.info(f"📨 收到 Bridge 响应: {content[:50]}...")

        # 广播给所有 App 连接
        for device_id, device_info in self.devices.items():
            if device_info.get('type') == 'mobile_app':
                try:
                    await device_info['connection'].send(json.dumps({
                        'type': 'bot_message' if not error else 'error',
                        'content': content,
                        'contentType': 'text',
                        'messageId': message_id,
                        'timestamp': int(datetime.now().timestamp() * 1000),
                        'error': error
                    }, ensure_ascii=False))
                    logger.info(f"📤 转发响应到 App: {device_info.get('userId', 'unknown')}")
                except Exception as e:
                    logger.error(f"发送消息到 App 失败: {e}")

    def find_openclaw_bridge(self):
        """查找可用的 OpenClaw Bridge"""
        for bridge_id, bridge_info in self.bridges.items():
            if bridge_info.get('status') == 'online':
                return bridge_info

        # 如果没有在 bridges 字典中找到，从 devices 中查找
        for device_id, device_info in self.devices.items():
            if device_info.get('type') == 'openclaw_bridge':
                # 同步到 bridges 字典
                self.bridges[device_id] = device_info
                return device_info

        return None

    async def handle_connection(self, websocket, path):
        """处理 WebSocket 连接"""
        self.stats['total_connections'] += 1
        self.stats['active_connections'] += 1

        connection_id = str(uuid.uuid4())
        logger.info(f"🔌 新连接: {connection_id}")

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_type = data.get('type')

                    # Bridge 注册
                    if message_type == 'bridge_register':
                        await self.register_bridge(websocket, connection_id, data)

                    # App 注册
                    elif message_type == 'app_register':
                        await self.register_app(websocket, connection_id, data)

                    # App 消息
                    elif message_type == 'app_message':
                        await self.handle_app_message(websocket, connection_id, data)

                    # Bot 消息（来自 Bridge）
                    elif message_type == 'bot_message':
                        await self.handle_bot_message(websocket, data)

                    # 心跳
                    elif message_type == 'ping':
                        await websocket.send(json.dumps({'type': 'pong'}))

                    else:
                        logger.warning(f"未知消息类型: {message_type}")

                except json.JSONDecodeError:
                    logger.error(f"JSON 解析失败: {message}")
                except Exception as e:
                    logger.error(f"处理消息错误: {e}")

        except Exception as e:
            logger.error(f"连接错误: {e}")
        finally:
            # 清理连接
            self.stats['active_connections'] -= 1

            if connection_id in self.connections:
                del self.connections[connection_id]

            if connection_id in self.devices:
                device_type = self.devices[connection_id].get('type')
                del self.devices[connection_id]
                logger.info(f"🔌 {device_type} 断开: {connection_id}")

            if connection_id in self.bridges:
                del self.bridges[connection_id]
                logger.info(f"🔌 Bridge 断开: {connection_id}")

    async def print_stats(self):
        """定期打印统计信息"""
        while True:
            await asyncio.sleep(60)
            logger.info(f"📊 统计: {self.stats}")

# ==================== 主程序 ====================

async def main():
    server = RelayServer()

    # 启动统计任务
    asyncio.create_task(server.print_stats())

    # 启动 WebSocket 服务器
    logger.info(f"🚀 Relay Server 启动中...")
    logger.info(f"📡 监听: {HOST}:{PORT}")

    async with websockets.serve(server.handle_connection, HOST, PORT):
        logger.info(f"✅ Relay Server 已启动: ws://0.0.0.0:{PORT}")
        logger.info(f"📋 等待 Bridge 和 App 连接...")

        # 保持运行
        await asyncio.Future()  # 永不返回

if __name__ == '__main__':
    print("""
╔═══════════════════════════════════════════════════════╗
║     Cloud Relay Server (OpenClaw Bridge Support)     ║
╠═══════════════════════════════════════════════════════╣
║  Port:         8765                                  ║
║  Mode:         Bridge + App                          ║
║  Status:       Starting...                           ║
╚═══════════════════════════════════════════════════════╝
    """)

    try:
        import websockets
        asyncio.run(main())
    except ImportError:
        print("❌ 错误: 未安装 websockets 库")
        print("请运行: pip install websockets")
        exit(1)
    except KeyboardInterrupt:
        print("\n🛑 服务器停止")

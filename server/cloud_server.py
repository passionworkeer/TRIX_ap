#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nanobot 云端配对服务器 (MVP 版本)
部署在阿里云: TRIX_SERVER_HOST

特点:
- 无 Redis 依赖，使用内存存储
- 支持配对码注册和验证
- 消息转发 (App <-> Nanobot)
"""

import asyncio
import websockets
import json
import uuid
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Set
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 配置
PAIRING_CODE_EXPIRE = 3600  # 配对码过期时间 (1小时)
PORT = 8765  # WebSocket 端口


class CloudServer:
    def __init__(self):
        # WebSocket 连接管理
        # device_id -> websocket
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}

        # 配对关系: code -> {device_id, app_device_id, status, created_at}
        self.pairings: Dict[str, dict] = {}

        # 设备信息: device_id -> {type, connection, pairing_code}
        self.devices: Dict[str, dict] = {}

        # 反向索引: nanobot_device_id -> pairing_code
        self.nanobot_to_code: Dict[str, str] = {}

        # App 到 Nanobot 的映射: app_device_id -> nanobot_device_id
        self.app_to_nanobot: Dict[str, str] = {}

        logger.info("云服务器初始化完成 (内存存储模式)")

    async def register_device(self, websocket, data: dict) -> str:
        """注册设备"""
        device_id = data.get('device_id')
        device_type = data.get('device_type', 'unknown')

        if not device_id:
            device_id = str(uuid.uuid4())[:8]

        self.connections[device_id] = websocket
        self.devices[device_id] = {
            'type': device_type,
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'pairing_code': None
        }

        logger.info(f"设备注册: {device_id} ({device_type})")

        await websocket.send(json.dumps({
            'type': 'register_success',
            'device_id': device_id,
            'message': '设备注册成功'
        }))

        return device_id

    async def register_pairing(self, websocket, data: dict, device_id: str):
        """注册配对码 (本地 Nanobot 调用)"""
        code = data.get('code')

        if not code:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '配对码不能为空'
            }))
            return

        # 存储配对关系
        pairing_data = {
            'code': code,
            'device_id': device_id,  # Nanobot 的 device_id
            'status': 'waiting',  # waiting, connected
            'created_at': datetime.now().isoformat(),
            'app_device_id': None
        }

        self.pairings[code] = pairing_data
        self.nanobot_to_code[device_id] = code

        # 更新设备信息
        if device_id in self.devices:
            self.devices[device_id]['pairing_code'] = code

        logger.info(f"配对码注册: {code} (Nanobot: {device_id})")

        await websocket.send(json.dumps({
            'type': 'pairing_registered',
            'code': code,
            'expires_in': PAIRING_CODE_EXPIRE
        }))

    async def handle_app_pairing(self, websocket, data: dict, app_device_id: str):
        """处理 App 配对请求"""
        code = data.get('code')
        client_info = data.get('client_info', {})

        if not code:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码不能为空'
            }))
            return

        # 查找配对码
        pairing = self.pairings.get(code)

        if not pairing:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码无效或已过期'
            }))
            logger.warning(f"配对失败: 配对码 {code} 不存在")
            return

        # 检查是否过期
        created_at = datetime.fromisoformat(pairing['created_at'])
        if datetime.now() - created_at > timedelta(seconds=PAIRING_CODE_EXPIRE):
            del self.pairings[code]
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码已过期'
            }))
            logger.warning(f"配对失败: 配对码 {code} 已过期")
            return

        # 更新配对关系
        pairing['status'] = 'connected'
        pairing['app_device_id'] = app_device_id
        pairing['connected_at'] = datetime.now().isoformat()
        pairing['client_info'] = client_info

        # 建立 App -> Nanobot 映射
        nanobot_device_id = pairing['device_id']
        self.app_to_nanobot[app_device_id] = nanobot_device_id

        # 更新 App 设备信息
        self.devices[app_device_id] = {
            'type': 'mobile_app',
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'pairing_code': code,
            'paired_nanobot': nanobot_device_id
        }

        # 通知本地 Nanobot 配对成功
        if nanobot_device_id in self.connections:
            await self.connections[nanobot_device_id].send(json.dumps({
                'type': 'pairing_success',
                'code': code,
                'client_info': client_info,
                'app_device_id': app_device_id
            }))
            logger.info(f"已通知 Nanobot {nanobot_device_id} 配对成功")

        logger.info(f"配对成功: {code} (App: {app_device_id}, Nanobot: {nanobot_device_id})")

        await websocket.send(json.dumps({
            'type': 'pairing_success',
            'code': code,
            'nanobot_device_id': nanobot_device_id,
            'message': '配对成功'
        }))

    async def forward_chat_message(self, websocket, data: dict, app_device_id: str):
        """转发聊天消息 (App -> Nanobot)"""
        message = data.get('message')
        msg_id = data.get('msg_id', str(uuid.uuid4()))
        message_type = data.get('message_type', 'text')
        media_url = data.get('media_url')

        # 查找 App 对应的 Nanobot
        nanobot_device_id = self.app_to_nanobot.get(app_device_id)

        if not nanobot_device_id:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '未配对，无法发送消息'
            }))
            return

        # 转发消息到 Nanobot
        if nanobot_device_id in self.connections:
            forward_data = {
                'type': 'chat_message',
                'message': message,
                'msg_id': msg_id,
                'message_type': message_type,
                'from_device_id': app_device_id,
                'timestamp': datetime.now().isoformat()
            }
            if media_url:
                forward_data['media_url'] = media_url

            await self.connections[nanobot_device_id].send(json.dumps(forward_data))
            logger.info(f"消息转发: App {app_device_id} -> Nanobot {nanobot_device_id}")
        else:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Nanobot 离线'
            }))
            logger.warning(f"Nanobot {nanobot_device_id} 离线，消息发送失败")

    async def forward_chat_response(self, websocket, data: dict, nanobot_device_id: str):
        """转发聊天回复 (Nanobot -> App)"""
        msg_id = data.get('msg_id')
        response = data.get('response')

        # 查找 Nanobot 对应的 App
        code = self.nanobot_to_code.get(nanobot_device_id)
        if not code:
            logger.warning(f"Nanobot {nanobot_device_id} 没有关联的配对码")
            return

        pairing = self.pairings.get(code)
        if not pairing:
            logger.warning(f"配对码 {code} 不存在")
            return

        app_device_id = pairing.get('app_device_id')
        if not app_device_id:
            logger.warning(f"配对码 {code} 没有关联的 App")
            return

        # 转发回复到 App
        if app_device_id in self.connections:
            await self.connections[app_device_id].send(json.dumps({
                'type': 'chat_response',
                'msg_id': msg_id,
                'response': response,
                'timestamp': datetime.now().isoformat()
            }))
            logger.info(f"回复转发: Nanobot {nanobot_device_id} -> App {app_device_id}")
        else:
            logger.warning(f"App {app_device_id} 离线，回复发送失败")

    async def handle_heartbeat(self, websocket):
        """处理心跳"""
        await websocket.send(json.dumps({'type': 'pong'}))

    async def handle_websocket(self, websocket, path):
        """处理 WebSocket 连接"""
        device_id = None

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type')

                    if msg_type == 'register':
                        device_id = await self.register_device(websocket, data)

                    elif msg_type == 'register_pairing':
                        if not device_id:
                            device_id = await self.register_device(websocket, {'device_id': data.get('device_id'), 'device_type': 'nanobot'})
                        await self.register_pairing(websocket, data, device_id)

                    elif msg_type == 'app_pairing':
                        if not device_id:
                            device_id = await self.register_device(websocket, {'device_id': data.get('device_id'), 'device_type': 'mobile_app'})
                        await self.handle_app_pairing(websocket, data, device_id)

                    elif msg_type == 'chat_message':
                        # 来自 App 的消息
                        if not device_id:
                            device_id = data.get('device_id')
                        await self.forward_chat_message(websocket, data, device_id)

                    elif msg_type == 'chat_response':
                        # 来自 Nanobot 的回复
                        if not device_id:
                            device_id = data.get('device_id')
                        await self.forward_chat_response(websocket, data, device_id)

                    elif msg_type == 'ping':
                        await self.handle_heartbeat(websocket)

                    else:
                        logger.warning(f"未知消息类型: {msg_type}")

                except json.JSONDecodeError:
                    logger.error(f"无效的 JSON: {message}")
                except Exception as e:
                    logger.error(f"处理消息错误: {e}", exc_info=True)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"连接关闭: {device_id}")
        finally:
            # 清理连接
            if device_id:
                if device_id in self.connections:
                    del self.connections[device_id]
                if device_id in self.devices:
                    del self.devices[device_id]

                # 如果是 Nanobot，清理配对关系
                if device_id in self.nanobot_to_code:
                    code = self.nanobot_to_code[device_id]
                    if code in self.pairings:
                        del self.pairings[code]
                    del self.nanobot_to_code[device_id]
                    logger.info(f"清理 Nanobot {device_id} 的配对码 {code}")

                # 如果是 App，清理映射
                if device_id in self.app_to_nanobot:
                    del self.app_to_nanobot[device_id]
                    logger.info(f"清理 App {device_id} 的映射")

    async def cleanup_expired_pairings(self):
        """清理过期的配对码"""
        while True:
            await asyncio.sleep(300)  # 每 5 分钟清理一次

            now = datetime.now()
            expired_codes = []

            for code, pairing in self.pairings.items():
                created_at = datetime.fromisoformat(pairing['created_at'])
                if now - created_at > timedelta(seconds=PAIRING_CODE_EXPIRE):
                    expired_codes.append(code)

            for code in expired_codes:
                del self.pairings[code]
                logger.info(f"清理过期配对码: {code}")

    async def start(self):
        """启动服务器"""
        # 启动清理任务
        asyncio.create_task(self.cleanup_expired_pairings())

        # 启动 WebSocket 服务器
        async with websockets.serve(self.handle_websocket, '0.0.0.0', PORT):
            logger.info(f"WebSocket 服务器启动: ws://0.0.0.0:{PORT}")
            await asyncio.Future()  # 永久运行


if __name__ == '__main__':
    server = CloudServer()
    asyncio.run(server.start())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云端 Relay Server Bridge 扩展
将此代码集成到现有的 cloud_server.py 中
"""

import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# ==================== Bridge 注册 ====================

async def register_bridge(self, websocket, data: dict):
    """注册 OpenClaw Bridge 设备"""
    bridge_type = data.get('type')
    version = data.get('version', '1.0.0')
    bridge_id = data.get('bridge_id', f"bridge_{str(uuid.uuid4())[:8]}")

    if bridge_type != 'openclaw':
        await websocket.send(json.dumps({
            'type': 'error',
            'message': '仅支持 openclaw 类型的 Bridge'
        }))
        return

    # 存储Bridge信息
    self.bridges[bridge_id] = {
        'type': bridge_type,
        'version': version,
        'connection': websocket,
        'connected_at': datetime.now().isoformat(),
        'status': 'online'
    }

    # 更新连接映射
    self.connections[bridge_id] = websocket
    self.devices[bridge_id] = {
        'type': 'openclaw_bridge',
        'connection': websocket,
        'connected_at': datetime.now().isoformat(),
        'version': version
    }

    logger.info(f"[Relay Server] ✅ OpenClaw Bridge 注册成功 (v{version}, ID: {bridge_id})")

    await websocket.send(json.dumps({
        'type': 'bridge_registered',
        'bridge_id': bridge_id,
        'success': True,
        'message': 'Bridge 注册成功'
    }))


# ==================== App 消息处理（支持 Bridge）====================

async def handle_app_message_with_bridge(self, websocket, data: dict):
    """处理 App 消息（优先使用 Bridge，回退到 Nanobot）"""
    app_device_id = data.get('device_id')
    message = data.get('message') or data.get('content')
    msg_id = data.get('msg_id') or data.get('messageId', str(uuid.uuid4()))
    user_id = data.get('userId')

    logger.info(f"[Relay Server] 📨 收到 App 消息: {message[:50]}... (from: {app_device_id})")

    # 🎯 优先查找可用的 OpenClaw Bridge
    openclaw_bridge = find_openclaw_bridge(self)

    if openclaw_bridge:
        # 使用 Bridge 模式
        logger.info(f"[Relay Server] 📤 转发消息到 OpenClaw Bridge...")

        # 发送消息到 Bridge
        await openclaw_bridge['connection'].send(json.dumps({
            'type': 'app_message',
            'content': message,
            'messageId': msg_id,
            'userId': user_id,
            'device_id': app_device_id,
            'timestamp': datetime.now().isoformat()
        }))

    else:
        # 回退到传统 Nanobot 模式
        logger.info(f"[Relay Server] ⚠️ 未找到可用的 OpenClaw Bridge，回退到 Nanobot 模式")

        # 调用原有的 forward_chat_message 逻辑
        await self.forward_chat_message(websocket, data)


# ==================== Bot 消息转发（来自 Bridge）====================

async def forward_bot_message(self, websocket, data: dict):
    """转发来自 Bridge 的 AI 响应回 App"""
    content = data.get('content')
    msg_id = data.get('messageId') or data.get('msg_id')
    error = data.get('error', False)

    logger.info(f"[Relay Server] 📨 收到 Bridge 响应: {content[:50]}...")

    # 查找对应的 App 连接（通过消息 ID 追踪）
    # 这里需要实现消息追踪机制
    # 简化版：广播给所有 App 连接

    app_connections = [
        conn for device_id, conn in self.connections.items()
        if self.devices.get(device_id, {}).get('type') == 'mobile_app'
    ]

    for app_conn in app_connections:
        try:
            await app_conn.send(json.dumps({
                'type': 'bot_message' if not error else 'error',
                'content': content,
                'contentType': 'text',
                'messageId': msg_id,
                'timestamp': datetime.now().isoformat(),
                'error': error
            }))
        except Exception as e:
            logger.error(f"[Relay Server] 发送消息到 App 失败: {e}")


# ==================== 辅助函数 ====================

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


# ==================== 集成到现有 CloudServer 类 ====================

"""
在现有的 CloudServer 类中添加以下代码：

class CloudServer:
    def __init__(self):
        # ... 现有代码 ...

        # 添加 Bridge 管理
        self.bridges: Dict[str, dict] = {}

    async def handle_message(self, websocket, data: dict):
        # ... 现有代码 ...

        message_type = data.get('type')

        # 添加新的事件处理
        if message_type == 'bridge_register':
            await self.register_bridge(websocket, data)
        elif message_type == 'app_message':
            await self.handle_app_message_with_bridge(websocket, data)
        elif message_type == 'bot_message':
            await self.forward_bot_message(websocket, data)
        # ... 其他事件处理 ...

    # 将上面的方法添加到类中
"""

print("""
╔═══════════════════════════════════════════════════════╗
║  云端 Relay Server Bridge 扩展安装指南               ║
╠═══════════════════════════════════════════════════════╣
║  1. 将此文件中的方法添加到 CloudServer 类            ║
║  2. 在 __init__ 中添加: self.bridges = {}            ║
║  3. 在 handle_message 中添加新事件处理               ║
║  4. 重启云端服务器                                   ║
╚═══════════════════════════════════════════════════════╝
""")

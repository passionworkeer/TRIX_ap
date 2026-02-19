#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nanobot 云端配对服务器 (完整版)
部署在阿里云: 47.243.55.130

新增功能:
- SQLite 数据库持久化
- QR 码配对支持
- Supabase 用户认证
- SSL/TLS 加密支持
"""

import asyncio
import websockets
import json
import uuid
import time
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Set
import logging
import qrcode
import io
import base64
import ssl
import hashlib

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 配置
PAIRING_CODE_EXPIRE = 3600  # 配对码过期时间 (1小时)
PORT = 8765  # WebSocket 端口
DB_PATH = '/tmp/nanobot.db'  # SQLite 数据库路径
USE_SSL = False  # 是否使用 SSL（需要配置证书）

# Supabase 配置（从环境变量读取）
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')


class Database:
    """SQLite 数据库管理"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 支持字典访问
        return conn

    def init_db(self):
        """初始化数据库表"""
        conn = self.get_connection()
        c = conn.cursor()

        # 配对关系表
        c.execute('''
            CREATE TABLE IF NOT EXISTS pairings (
                code TEXT PRIMARY KEY,
                nanobot_device_id TEXT NOT NULL,
                app_device_id TEXT,
                user_id TEXT,
                status TEXT DEFAULT 'waiting',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                connected_at TIMESTAMP,
                expires_at TIMESTAMP,
                client_info TEXT
            )
        ''')

        # 设备表
        c.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                device_type TEXT NOT NULL,
                user_id TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_online BOOLEAN DEFAULT 1
            )
        ''')

        # 用户绑定表
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_bindings (
                user_id TEXT,
                nanobot_device_id TEXT,
                bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                PRIMARY KEY (user_id, nanobot_device_id)
            )
        ''')

        conn.commit()
        conn.close()
        logger.info(f"✅ 数据库初始化完成: {self.db_path}")

    def save_pairing(self, code: str, nanobot_device_id: str):
        """保存配对码"""
        conn = self.get_connection()
        c = conn.cursor()

        expires_at = datetime.now() + timedelta(seconds=PAIRING_CODE_EXPIRE)

        c.execute('''
            INSERT OR REPLACE INTO pairings
            (code, nanobot_device_id, status, created_at, expires_at)
            VALUES (?, ?, 'waiting', ?, ?)
        ''', (code, nanobot_device_id, datetime.now().isoformat(), expires_at.isoformat()))

        conn.commit()
        conn.close()
        logger.info(f"💾 配对码已保存: {code} -> {nanobot_device_id}")

    def update_pairing(self, code: str, app_device_id: str, user_id: str, client_info: dict):
        """更新配对关系（App 配对成功）"""
        conn = self.get_connection()
        c = conn.cursor()

        c.execute('''
            UPDATE pairings
            SET app_device_id = ?,
                user_id = ?,
                status = 'connected',
                connected_at = ?,
                client_info = ?
            WHERE code = ?
        ''', (app_device_id, user_id, datetime.now().isoformat(), json.dumps(client_info), code))

        # 同时保存用户绑定关系
        c.execute('''
            SELECT nanobot_device_id FROM pairings WHERE code = ?
        ''', (code,))
        row = c.fetchone()

        if row:
            nanobot_device_id = row['nanobot_device_id']
            c.execute('''
                INSERT OR REPLACE INTO user_bindings
                (user_id, nanobot_device_id, bound_at, status)
                VALUES (?, ?, ?, 'active')
            ''', (user_id, nanobot_device_id, datetime.now().isoformat()))

        conn.commit()
        conn.close()
        logger.info(f"💾 配对关系已更新: {code} -> User:{user_id}")

    def get_pairing(self, code: str) -> Optional[dict]:
        """查询配对关系"""
        conn = self.get_connection()
        c = conn.cursor()

        c.execute('SELECT * FROM pairings WHERE code = ?', (code,))
        row = c.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def get_pairing_by_user(self, user_id: str) -> Optional[dict]:
        """根据用户ID查询配对关系"""
        conn = self.get_connection()
        c = conn.cursor()

        c.execute('''
            SELECT p.* FROM pairings p
            JOIN user_bindings ub ON p.nanobot_device_id = ub.nanobot_device_id
            WHERE ub.user_id = ? AND ub.status = 'active'
            ORDER BY p.connected_at DESC
            LIMIT 1
        ''', (user_id,))
        row = c.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def get_pairing_by_nanobot(self, nanobot_device_id: str) -> Optional[dict]:
        """根据 Nanobot 设备ID查询配对关系"""
        conn = self.get_connection()
        c = conn.cursor()

        c.execute('''
            SELECT * FROM pairings
            WHERE nanobot_device_id = ? AND status = 'connected'
            ORDER BY connected_at DESC
            LIMIT 1
        ''', (nanobot_device_id,))
        row = c.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def cleanup_expired_pairings(self):
        """清理过期的配对码"""
        conn = self.get_connection()
        c = conn.cursor()

        c.execute('''
            DELETE FROM pairings
            WHERE status = 'waiting' AND expires_at < ?
        ''', (datetime.now().isoformat(),))

        deleted = c.rowcount
        conn.commit()
        conn.close()

        if deleted > 0:
            logger.info(f"🧹 已清理 {deleted} 个过期配对码")


class CloudServer:
    def __init__(self):
        # WebSocket 连接管理
        # device_id -> websocket
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}

        # 设备信息: device_id -> {type, connection, pairing_code}
        self.devices: Dict[str, dict] = {}

        # App 到 Nanobot 的映射: app_device_id -> nanobot_device_id
        self.app_to_nanobot: Dict[str, str] = {}

        # 数据库
        self.db = Database(DB_PATH)

        logger.info("✅ 云服务器初始化完成 (SQLite + QR码 + Supabase认证)")

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

        logger.info(f"📱 设备注册: {device_id} ({device_type})")

        await websocket.send(json.dumps({
            'type': 'register_success',
            'device_id': device_id,
            'message': '设备注册成功'
        }))

        return device_id

    async def register_pairing(self, websocket, data: dict, device_id: str):
        """注册配对码 (本地 Nanobot 调用) - 支持 QR 码"""
        code = data.get('code')

        if not code:
            # 自动生成配对码
            code = self.generate_pairing_code()

        # 保存到数据库
        self.db.save_pairing(code, device_id)

        # 生成 QR 码
        qr_code_data = self.generate_qr_code(code, device_id)

        logger.info(f"🔗 配对码注册: {code} (Nanobot: {device_id})")

        # 发送给 Nanobot
        await websocket.send(json.dumps({
            'type': 'pairing_registered',
            'code': code,
            'qr_code': qr_code_data,  # Base64 编码的 QR 码图片
            'pairing_url': f"nanobot://pair?code={code}&device={device_id}",
            'expires_in': PAIRING_CODE_EXPIRE
        }))

    def generate_pairing_code(self) -> str:
        """生成配对码"""
        import random
        import string
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    def generate_qr_code(self, code: str, device_id: str) -> str:
        """生成 QR 码（Base64 编码）"""
        # QR 码内容（可以是 URL 或 JSON）
        qr_data = json.dumps({
            'action': 'pair',
            'code': code,
            'device_id': device_id,
            'server': f"ws://47.243.55.130:{PORT}"
        })

        # 生成 QR 码
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)

        # 转换为图片
        img = qr.make_image(fill_color="black", back_color="white")

        # 转换为 Base64
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return f"data:image/png;base64,{img_str}"

    async def handle_app_pairing(self, websocket, data: dict, app_device_id: str):
        """处理 App 配对请求（支持扫码和手动输入）"""
        code = data.get('code')
        user_id = data.get('user_id')  # Supabase User ID
        client_info = data.get('client_info', {})

        if not code:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码不能为空'
            }))
            return

        # 如果没有 user_id，尝试从 Supabase Token 获取
        if not user_id:
            auth_token = data.get('auth_token')
            if auth_token:
                user_id = await self.verify_supabase_token(auth_token)
                if not user_id:
                    await websocket.send(json.dumps({
                        'type': 'pairing_failed',
                        'message': '用户认证失败'
                    }))
                    return

        # 查询配对码（从数据库）
        pairing = self.db.get_pairing(code)

        if not pairing:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码无效或已过期'
            }))
            logger.warning(f"❌ 配对失败: 配对码 {code} 不存在")
            return

        # 检查是否过期
        expires_at = datetime.fromisoformat(pairing['expires_at'])
        if datetime.now() > expires_at:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码已过期'
            }))
            logger.warning(f"❌ 配对失败: 配对码 {code} 已过期")
            return

        # 更新配对关系到数据库
        self.db.update_pairing(code, app_device_id, user_id or 'anonymous', client_info)

        # 建立 App -> Nanobot 映射（内存）
        nanobot_device_id = pairing['nanobot_device_id']
        self.app_to_nanobot[app_device_id] = nanobot_device_id

        # 更新 App 设备信息
        self.devices[app_device_id] = {
            'type': 'mobile_app',
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'pairing_code': code,
            'paired_nanobot': nanobot_device_id,
            'user_id': user_id
        }

        # 通知本地 Nanobot 配对成功
        if nanobot_device_id in self.connections:
            await self.connections[nanobot_device_id].send(json.dumps({
                'type': 'pairing_success',
                'code': code,
                'client_info': client_info,
                'app_device_id': app_device_id,
                'user_id': user_id
            }))
            logger.info(f"✅ 已通知 Nanobot {nanobot_device_id} 配对成功")

        logger.info(f"✅ 配对成功: {code} (App: {app_device_id}, Nanobot: {nanobot_device_id}, User: {user_id})")

        await websocket.send(json.dumps({
            'type': 'pairing_success',
            'code': code,
            'nanobot_device_id': nanobot_device_id,
            'user_id': user_id,
            'message': '配对成功'
        }))

    async def verify_supabase_token(self, token: str) -> Optional[str]:
        """验证 Supabase Token 并返回 User ID"""
        # TODO: 实现 Supabase Token 验证
        # 临时方案：直接返回 token 作为 user_id
        if token:
            # 实际应该调用 Supabase API 验证
            # response = requests.post(f"{SUPABASE_URL}/auth/v1/user", ...)
            return hashlib.sha256(token.encode()).hexdigest()[:16]
        return None

    async def forward_chat_message(self, websocket, data: dict, app_device_id: str):
        """转发聊天消息 (App -> Nanobot)"""
        message = data.get('message')
        msg_id = data.get('msg_id', str(uuid.uuid4()))
        message_type = data.get('message_type', 'text')
        media_url = data.get('media_url')

        # 查找 App 对应的 Nanobot（优先从数据库查询）
        nanobot_device_id = self.app_to_nanobot.get(app_device_id)

        if not nanobot_device_id:
            # 从数据库查询
            user_id = self.devices.get(app_device_id, {}).get('user_id')
            if user_id:
                pairing = self.db.get_pairing_by_user(user_id)
                if pairing:
                    nanobot_device_id = pairing['nanobot_device_id']
                    self.app_to_nanobot[app_device_id] = nanobot_device_id

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
            logger.info(f"💬 消息转发: App {app_device_id} -> Nanobot {nanobot_device_id}")
        else:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Nanobot 离线'
            }))
            logger.warning(f"⚠️ Nanobot {nanobot_device_id} 离线，消息发送失败")

    async def forward_chat_response(self, websocket, data: dict, nanobot_device_id: str):
        """转发聊天回复 (Nanobot -> App)"""
        msg_id = data.get('msg_id')
        response = data.get('response')

        # 从数据库查询配对关系
        pairing = self.db.get_pairing_by_nanobot(nanobot_device_id)

        if not pairing:
            logger.warning(f"⚠️ Nanobot {nanobot_device_id} 没有配对关系")
            return

        app_device_id = pairing.get('app_device_id')
        if not app_device_id:
            logger.warning(f"⚠️ Nanobot {nanobot_device_id} 没有关联的 App")
            return

        # 转发回复到 App
        if app_device_id in self.connections:
            await self.connections[app_device_id].send(json.dumps({
                'type': 'chat_response',
                'msg_id': msg_id,
                'response': response,
                'timestamp': datetime.now().isoformat()
            }))
            logger.info(f"💬 回复转发: Nanobot {nanobot_device_id} -> App {app_device_id}")
        else:
            logger.warning(f"⚠️ App {app_device_id} 离线，回复发送失败")

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
                        logger.warning(f"⚠️ 未知消息类型: {msg_type}")

                except json.JSONDecodeError:
                    logger.error(f"❌ 无效的 JSON: {message}")
                except Exception as e:
                    logger.error(f"❌ 处理消息错误: {e}", exc_info=True)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 连接关闭: {device_id}")
        finally:
            # 清理连接
            if device_id:
                if device_id in self.connections:
                    del self.connections[device_id]
                if device_id in self.devices:
                    del self.devices[device_id]

                # 如果是 App，清理映射
                if device_id in self.app_to_nanobot:
                    del self.app_to_nanobot[device_id]
                    logger.info(f"🧹 清理 App {device_id} 的映射")

    async def cleanup_expired_pairings(self):
        """定期清理过期的配对码"""
        while True:
            await asyncio.sleep(300)  # 每 5 分钟清理一次
            self.db.cleanup_expired_pairings()

    async def start(self):
        """启动服务器"""
        # 启动清理任务
        asyncio.create_task(self.cleanup_expired_pairings())

        # 配置 SSL（如果启用）
        ssl_context = None
        if USE_SSL:
            ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ssl_context.load_cert_chain('/etc/letsencrypt/live/your-domain.com/fullchain.pem',
                                       '/etc/letsencrypt/live/your-domain.com/privkey.pem')
            logger.info("🔒 SSL/TLS 已启用")

        # 启动 WebSocket 服务器
        async with websockets.serve(self.handle_websocket, '0.0.0.0', PORT, ssl=ssl_context):
            protocol = "wss" if USE_SSL else "ws"
            logger.info(f"🚀 WebSocket 服务器启动: {protocol}://0.0.0.0:{PORT}")
            await asyncio.Future()  # 永久运行


if __name__ == '__main__':
    server = CloudServer()
    asyncio.run(server.start())

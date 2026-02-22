#!/usr/bin/env python3
"""
MyApp 配对服务
部署在阿里云，负责：
1. 生成配对码
2. 管理 WebSocket 连接
3. 转发消息到 nanobot
"""

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import redis
import uuid
import json
import hmac
import hashlib
import time
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here_change_in_production'

# SocketIO 配置
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25
)

# Redis 配置（用于存储配对信息）
# 如果没有 Redis，可以用内存字典代替（重启会丢失数据）
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    USE_REDIS = True
except:
    USE_REDIS = False
    memory_store = {}
    print("[WARN] Redis 未启动，使用内存存储")

# ============== 配对码管理 ==============

def generate_pairing_code():
    """生成8位配对码"""
    return str(uuid.uuid4())[:8].upper()

def store_pairing(code, data, expire=3600):
    """存储配对信息，默认1小时过期"""
    if USE_REDIS:
        redis_client.setex(f"pairing:{code}", expire, json.dumps(data))
    else:
        memory_store[f"pairing:{code}"] = {
            'data': data,
            'expire': time.time() + expire
        }

def get_pairing(code):
    """获取配对信息"""
    if USE_REDIS:
        data = redis_client.get(f"pairing:{code}")
        return json.loads(data) if data else None
    else:
        item = memory_store.get(f"pairing:{code}")
        if item and item['expire'] > time.time():
            return item['data']
        return None

def update_pairing(code, data):
    """更新配对信息"""
    if USE_REDIS:
        ttl = redis_client.ttl(f"pairing:{code}")
        redis_client.setex(f"pairing:{code}", ttl if ttl > 0 else 3600, json.dumps(data))
    else:
        if f"pairing:{code}" in memory_store:
            memory_store[f"pairing:{code}"]['data'] = data

# ============== HTTP API ==============

@app.route('/api/pairing/generate', methods=['POST'])
def generate_code():
    """
    nanobot 调用：生成配对码

    Request: {}
    Response: {
        "success": true,
        "code": "A1B2C3D4",
        "expires_in": 3600
    }
    """
    code = generate_pairing_code()

    store_pairing(code, {
        'status': 'waiting',      # waiting, paired, expired
        'created_at': datetime.now().isoformat(),
        'nanobot_socket_id': None,
        'app_socket_id': None,
        'user_info': {}
    })

    return jsonify({
        'success': True,
        'code': code,
        'expires_in': 3600,
        'message': '请用户在App中输入此配对码'
    })

@app.route('/api/pairing/<code>/status', methods=['GET'])
def get_status(code):
    """
    查询配对状态

    Response: {
        "success": true,
        "status": "waiting|paired|expired",
        "connected": true|false
    }
    """
    pairing = get_pairing(code)
    if not pairing:
        return jsonify({'success': False, 'error': '配对码不存在或已过期'}), 404

    return jsonify({
        'success': True,
        'status': pairing['status'],
        'connected': pairing.get('app_socket_id') is not None
    })

@app.route('/api/pairing/<code>/bind', methods=['POST'])
def bind_pairing(code):
    """
    App 调用：绑定配对码

    Request: {
        "device_id": "uuid",
        "user_name": "用户昵称"
    }
    """
    pairing = get_pairing(code)
    if not pairing:
        return jsonify({'success': False, 'error': '配对码不存在或已过期'}), 404

    if pairing['status'] != 'waiting':
        return jsonify({'success': False, 'error': '配对码已被使用'}), 400

    data = request.json or {}

    # 更新配对信息
    pairing['status'] = 'paired'
    pairing['user_info'] = {
        'device_id': data.get('device_id'),
        'user_name': data.get('user_name', '未知用户'),
        'bound_at': datetime.now().isoformat()
    }
    store_pairing(code, pairing)

    # 通知 nanobot（如果已连接）
    if pairing.get('nanobot_socket_id'):
        socketio.emit('app_bound', {
            'code': code,
            'user_info': pairing['user_info']
        }, room=pairing['nanobot_socket_id'])

    return jsonify({
        'success': True,
        'message': '配对成功',
        'websocket_url': f'wss://your-domain.com/socket.io/?code={code}'
    })

# ============== WebSocket 事件 ==============

@socketio.on('connect')
def handle_connect():
    """客户端连接"""
    print(f"[WS] 客户端连接: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开"""
    print(f"[WS] 客户端断开: {request.sid}")

@socketio.on('register_nanobot')
def handle_nanobot_register(data):
    """
    nanobot 注册

    data: {
        "code": "A1B2C3D4",
        "client_type": "nanobot"
    }
    """
    code = data.get('code')
    pairing = get_pairing(code)

    if not pairing:
        emit('error', {'message': '配对码不存在'})
        return

    # 加入房间
    join_room(code)

    # 更新配对信息
    pairing['nanobot_socket_id'] = request.sid
    store_pairing(code, pairing)

    emit('registered', {
        'success': True,
        'code': code,
        'status': pairing['status']
    })

    print(f"[WS] nanobot 注册成功: {code}")

@socketio.on('register_app')
def handle_app_register(data):
    """
    App 注册

    data: {
        "code": "A1B2C3D4",
        "client_type": "app",
        "device_id": "uuid"
    }
    """
    code = data.get('code')
    pairing = get_pairing(code)

    if not pairing:
        emit('error', {'message': '配对码不存在'})
        return

    if pairing['status'] != 'paired':
        emit('error', {'message': '配对码未绑定，请先绑定'})
        return

    # 加入房间
    join_room(code)

    # 更新配对信息
    pairing['app_socket_id'] = request.sid
    store_pairing(code, pairing)

    emit('registered', {
        'success': True,
        'code': code,
        'user_info': pairing.get('user_info', {})
    })

    # 通知 nanobot App 已连接
    if pairing.get('nanobot_socket_id'):
        socketio.emit('app_connected', {
            'code': code,
            'device_id': data.get('device_id')
        }, room=pairing['nanobot_socket_id'])

    print(f"[WS] App 注册成功: {code}")

@socketio.on('message_from_app')
def handle_app_message(data):
    """
    转发 App 消息到 nanobot

    data: {
        "code": "A1B2C3D4",
        "message": "用户消息",
        "message_type": "text|image|video|file",
        "media_url": "https://..."
    }
    """
    code = data.get('code')
    pairing = get_pairing(code)

    if not pairing or not pairing.get('nanobot_socket_id'):
        emit('error', {'message': 'nanobot 未连接'})
        return

    # 转发给 nanobot
    socketio.emit('message_to_nanobot', {
        'code': code,
        'message': data.get('message'),
        'message_type': data.get('message_type', 'text'),
        'media_url': data.get('media_url'),
        'timestamp': datetime.now().isoformat()
    }, room=pairing['nanobot_socket_id'])

    print(f"[WS] 转发消息: App -> nanobot ({code})")

@socketio.on('message_from_nanobot')
def handle_nanobot_message(data):
    """
    转发 nanobot 回复到 App

    data: {
        "code": "A1B2C3D4",
        "message": "nanobot回复",
        "message_type": "text|image|video|file",
        "media_url": "https://..."
    }
    """
    code = data.get('code')
    pairing = get_pairing(code)

    if not pairing or not pairing.get('app_socket_id'):
        emit('error', {'message': 'App 未连接'})
        return

    # 转发给 App
    socketio.emit('message_to_app', {
        'code': code,
        'message': data.get('message'),
        'message_type': data.get('message_type', 'text'),
        'media_url': data.get('media_url'),
        'timestamp': datetime.now().isoformat()
    }, room=pairing['app_socket_id'])

    print(f"[WS] 转发消息: nanobot -> App ({code})")

# ============== 启动 ==============

if __name__ == '__main__':
    print("=" * 50)
    print("MyApp 配对服务启动")
    print("=" * 50)
    print(f"存储方式: {'Redis' if USE_REDIS else '内存'}")
    print("API 地址: http://0.0.0.0:5001")
    print("WebSocket: ws://0.0.0.0:5001")
    print("=" * 50)

    socketio.run(app, host='0.0.0.0', port=5001, debug=False)

# MyApp 接入 nanobot 完整指南

> 目标：将你自己的 App 作为 nanobot 的 Channel 接入，实现类似飞书/WhatsApp 的集成效果

---

## 目录

1. [架构概述](#架构概述)
2. [实现步骤](#实现步骤)
3. [代码实现](#代码实现)
4. [部署配置](#部署配置)
5. [测试验证](#测试验证)
6. [多模态支持](#多模态支持)
7. [常见问题](#常见问题)

---

## 架构概述

### 整体架构图

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   用户手机App    │         │   阿里云服务器    │         │   你的电脑       │
│                 │         │                  │         │                 │
│  ┌───────────┐  │         │  ┌────────────┐  │         │  ┌───────────┐  │
│  │  WebSocket │◄─┼────────►│  │ 配对服务    │  │         │  │ nanobot   │  │
│  │   客户端   │  │         │  │ +消息队列   │  │         │  │  Gateway  │  │
│  └───────────┘  │         │  └─────┬──────┘  │         │  └─────┬─────┘  │
│        │        │         │        │         │         │        │        │
│  ┌─────▼─────┐  │         │  ┌─────▼──────┐  │         │  ┌─────▼─────┐  │
│  │  扫码/输码  │  │         │  │  MyApp     │◄─┼────────►│  │ MyApp     │  │
│  │  配对界面   │  │         │  │  Channel   │  │ WebSocket│  │ Channel   │  │
│  └───────────┘  │         │  └────────────┘  │ (frp)   │  └───────────┘  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### 数据流向

1. **用户发送消息** → App WebSocket → 阿里云配对服务 → nanobot MyApp Channel
2. **nanobot回复** → MyApp Channel → 阿里云配对服务 → App WebSocket
3. **图片/视频** → App上传OSS → 发送URL → nanobot处理

---

## 实现步骤

### 第一步：阿里云服务端部署

#### 1.1 部署 frp 服务端

```bash
# 下载 frp
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz
tar -zxvf frp_0.52.3_linux_amd64.tar.gz
cd frp_0.52.3_linux_amd64

# 编辑 frps.toml (服务端配置)
cat > frps.toml << 'EOF'
bindPort = 7000
auth.token = "your_secure_token_here"

# WebSocket 端口
vhostHTTPPort = 8080
vhostHTTPSPort = 8443

# 仪表盘（可选）
webServer.addr = "0.0.0.0"
webServer.port = 7500
webServer.user = "admin"
webServer.password = "admin_password"
EOF

# 启动 frps
./frps -c frps.toml
```

#### 1.2 部署配对服务

```bash
# 安装依赖
pip install flask flask-socketio eventlet redis

# 创建配对服务
mkdir -p /opt/myapp-bridge
cd /opt/myapp-bridge
```

**pairing_server.py:**

```python
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
app.config['SECRET_KEY'] = 'your_secret_key_here'

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
    # 清理配对信息中的 socket_id
    # 这里简化处理，实际应该遍历查找

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
        "media_url": "https://..."  # 图片/视频URL
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
```

**systemd 服务配置:**

```ini
# /etc/systemd/system/myapp-bridge.service
[Unit]
Description=MyApp Bridge Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/myapp-bridge
Environment="PATH=/usr/local/bin:/usr/bin"
ExecStart=/usr/local/bin/python3 /opt/myapp-bridge/pairing_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
systemctl enable myapp-bridge
systemctl start myapp-bridge
systemctl status myapp-bridge
```

---

### 第二步：nanobot 自定义 Channel 实现

**myapp_channel.py:**

```python
"""
MyApp Channel for nanobot
实现类似飞书/WhatsApp 的官方 Channel 集成
"""

import asyncio
import socketio
from typing import Callable, Optional
from loguru import logger

from nanobot.channels.base import Channel
from nanobot.bus.events import InboundMessage, OutboundMessage


class MyAppChannel(Channel):
    """
    MyApp 官方 Channel
    
    功能：
    1. 通过配对码连接用户 App
    2. 支持文本、图片、视频消息
    3. 实时双向通信
    4. 自动重连
    
    配置示例 (config.json):
    {
        "channels": {
            "myapp": {
                "enabled": true,
                "server_url": "https://your-aliyun-domain.com",
                "pairing_code": "A1B2C3D4",
                "auto_generate_code": false
            }
        }
    }
    """
    
    def __init__(
        self,
        server_url: str,
        pairing_code: Optional[str] = None,
        auto_generate_code: bool = False,
        reconnect_interval: int = 5,
        max_retries: int = 10
    ):
        """
        初始化 MyApp Channel
        
        Args:
            server_url: 配对服务地址，如 https://your-domain.com
            pairing_code: 配对码，如果为 None 则自动生成
            auto_generate_code: 是否自动生成配对码
            reconnect_interval: 重连间隔（秒）
            max_retries: 最大重试次数
        """
        self.server_url = server_url.rstrip('/')
        self.pairing_code = pairing_code
        self.auto_generate_code = auto_generate_code
        self.reconnect_interval = reconnect_interval
        self.max_retries = max_retries
        
        # SocketIO 客户端
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=max_retries,
            reconnection_delay=reconnect_interval,
            reconnection_delay_max=30
        )
        
        # 回调函数
        self.message_handler: Optional[Callable] = None
        self._connected = False
        self._registered = False
        
        # 绑定事件
        self._setup_events()
    
    def _setup_events(self):
        """设置 WebSocket 事件监听"""
        
        @self.sio.on('connect')
        async def on_connect():
            logger.info(f"[MyApp] 已连接到服务器: {self.server_url}")
            self._connected = True
            
            # 注册为 nanobot 客户端
            await self.sio.emit('register_nanobot', {
                'code': self.pairing_code,
                'client_type': 'nanobot'
            })
        
        @self.sio.on('disconnect')
        async def on_disconnect():
            logger.warning("[MyApp] 与服务器断开连接")
            self._connected = False
            self._registered = False
        
        @self.sio.on('registered')
        async def on_registered(data):
            if data.get('success'):
                self._registered = True
                logger.info(f"[MyApp] 注册成功，配对码: {data.get('code')}")
                
                # 显示配对二维码（如果需要）
                if self.auto_generate_code:
                    await self._show_pairing_info(data.get('code'))
            else:
                logger.error(f"[MyApp] 注册失败: {data.get('message')}")
        
        @self.sio.on('app_connected')
        async def on_app_connected(data):
            """用户 App 已连接"""
            logger.info(f"[MyApp] 用户 App 已连接: {data.get('device_id')}")
        
        @self.sio.on('app_bound')
        async def on_app_bound(data):
            """用户完成配对绑定"""
            user_info = data.get('user_info', {})
            logger.info(f"[MyApp] 用户完成配对: {user_info.get('user_name')}")
        
        @self.sio.on('message_to_nanobot')
        async def on_message(data):
            """收到用户消息"""
            logger.debug(f"[MyApp] 收到消息: {data}")
            
            if self.message_handler:
                # 构建 InboundMessage
                msg = InboundMessage(
                    channel="myapp",
                    sender_id=data.get('device_id', 'unknown'),
                    chat_id=data.get('code'),  # 使用配对码作为 chat_id
                    content=data.get('message', ''),
                    # 处理多媒体
                    media=self._parse_media(data) if data.get('media_url') else None
                )
                
                # 调用消息处理器
                await self.message_handler(msg)
        
        @self.sio.on('error')
        async def on_error(data):
            logger.error(f"[MyApp] 错误: {data.get('message')}")
    
    def _parse_media(self, data: dict) -> list:
        """解析多媒体消息"""
        message_type = data.get('message_type', 'text')
        media_url = data.get('media_url')
        
        if not media_url:
            return []
        
        from nanobot.bus.events import Media
        
        media_type_map = {
            'image': 'image',
            'video': 'video',
            'file': 'document',
            'audio': 'audio'
        }
        
        return [Media(
            type=media_type_map.get(message_type, 'document'),
            url=media_url,
            filename=media_url.split('/')[-1] if '/' in media_url else 'file'
        )]
    
    async def _show_pairing_info(self, code: str):
        """显示配对信息（二维码或文本）"""
        import qrcode
        from io import StringIO
        
        pairing_url = f"myapp://pair?code={code}"
        
        # 生成二维码
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(pairing_url)
        qr.make(fit=True)
        
        # 打印到控制台
        print("\n" + "=" * 50)
        print("MyApp 配对信息")
        print("=" * 50)
        print(f"配对码: {code}")
        print(f"配对链接: {pairing_url}")
        print("\n请用户在 App 中输入此配对码")
        print("=" * 50 + "\n")
    
    async def _generate_pairing_code(self) -> str:
        """自动生成配对码"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.server_url}/api/pairing/generate"
            ) as resp:
                data = await resp.json()
                if data.get('success'):
                    return data.get('code')
                raise Exception(f"生成配对码失败: {data.get('error')}")
    
    # ============== Channel 接口实现 ==============
    
    async def start(self, message_handler: Callable[[InboundMessage], None]):
        """
        启动 Channel
        
        Args:
            message_handler: 消息处理回调函数
        """
        self.message_handler = message_handler
        
        # 如果需要自动生成配对码
        if self.auto_generate_code and not self.pairing_code:
            self.pairing_code = await self._generate_pairing_code()
        
        if not self.pairing_code:
            raise ValueError("必须提供 pairing_code 或启用 auto_generate_code")
        
        logger.info(f"[MyApp] 启动 Channel，配对码: {self.pairing_code}")
        
        # 连接 WebSocket
        ws_url = self.server_url.replace('https://', 'wss://').replace('http://', 'ws://')
        
        while True:
            try:
                await self.sio.connect(
                    ws_url,
                    socketio_path='/socket.io/',
                    transports=['websocket', 'polling']
                )
                
                # 保持运行
                await self.sio.wait()
                
            except Exception as e:
                logger.error(f"[MyApp] 连接失败: {e}")
                logger.info(f"[MyApp] {self.reconnect_interval}秒后重连...")
                await asyncio.sleep(self.reconnect_interval)
    
    async def send(self, message: OutboundMessage):
        """
        发送消息到用户 App
        
        Args:
            message: 要发送的消息
        """
        if not self._connected or not self._registered:
            logger.error("[MyApp] 未连接，无法发送消息")
            return
        
        # 解析 chat_id（即配对码）
        code = message.chat_id
        
        # 构建消息数据
        data = {
            'code': code,
            'message': message.content,
            'message_type': 'text',
            'timestamp': asyncio.get_event_loop().time()
        }
        
        # 处理多媒体回复
        if message.media:
            media = message.media[0]
            data['message_type'] = media.type  # image, video, etc.
            data['media_url'] = media.url
        
        try:
            await self.sio.emit('message_from_nanobot', data)
            logger.debug(f"[MyApp] 消息已发送: {code}")
        except Exception as e:
            logger.error(f"[MyApp] 发送消息失败: {e}")
    
    async def stop(self):
        """停止 Channel"""
        logger.info("[MyApp] 停止 Channel")
        if self.sio.connected:
            await self.sio.disconnect()
```

**myapp_config.py:**

```python
"""MyApp Channel 配置 Schema"""

from pydantic import BaseModel, Field
from typing import Optional


class MyAppChannelConfig(BaseModel):
    """MyApp Channel 配置"""
    
    enabled: bool = Field(default=False, description="是否启用")
    
    server_url: str = Field(
        default="",
        description="配对服务地址，如 https://your-domain.com"
    )
    
    pairing_code: Optional[str] = Field(
        default=None,
        description="配对码，留空则自动生成"
    )
    
    auto_generate_code: bool = Field(
        default=True,
        description="是否自动生成配对码"
    )
    
    reconnect_interval: int = Field(
        default=5,
        description="重连间隔（秒）"
    )
    
    max_retries: int = Field(
        default=10,
        description="最大重试次数"
    )
```

---

### 第三步：注册 Channel 到 nanobot

**修改 nanobot 源码:**

```python
# nanobot/channels/registry.py

from nanobot.channels.myapp_channel import MyAppChannel

CHANNEL_REGISTRY = {
    # ... 其他 channels
    "myapp": MyAppChannel,
}
```

**或者动态注册（推荐）:**

```python
# 在你的启动脚本中
from nanobot import bootstrap
from myapp_channel import MyAppChannel

# 注册 Channel
bootstrap.register_channel("myapp", MyAppChannel)

# 启动 nanobot
bootstrap.run()
```

---

### 第四步：配置 config.json

```json
{
  "providers": {
    "zhipu": {
      "apiKey": "your-api-key",
      "apiBase": "https://open.bigmodel.cn/api/coding/paas/v4"
    }
  },
  "agents": {
    "defaults": {
      "model": "glm-4.7",
      "maxTokens": 8192
    }
  },
  "channels": {
    "myapp": {
      "enabled": true,
      "server_url": "https://your-aliyun-domain.com",
      "pairing_code": null,
      "auto_generate_code": true,
      "reconnect_interval": 5,
      "max_retries": 10
    }
  }
}
```

---

### 第五步：App 端实现

**App WebSocket 客户端 (React Native 示例):**

```javascript
// services/MyAppBridge.js
import io from 'socket.io-client';
import { EventEmitter } from 'events';

class MyAppBridge extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.pairingCode = null;
    this.connected = false;
  }

  // 生成或输入配对码
  async generatePairingCode() {
    const response = await fetch('https://your-domain.com/api/pairing/generate', {
      method: 'POST'
    });
    const data = await response.json();
    return data.code;
  }

  // 绑定配对码
  async bindPairingCode(code, deviceId, userName) {
    const response = await fetch(`https://your-domain.com/api/pairing/${code}/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, user_name: userName })
    });
    return response.json();
  }

  // 连接 WebSocket
  connect(code) {
    this.pairingCode = code;
    
    this.socket = io('https://your-domain.com', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('WebSocket 已连接');
      this.connected = true;
      
      // 注册为 App 客户端
      this.socket.emit('register_app', {
        code: code,
        client_type: 'app',
        device_id: this.getDeviceId()
      });
    });

    this.socket.on('registered', (data) => {
      if (data.success) {
        console.log('注册成功:', data);
        this.emit('connected', data);
      }
    });

    this.socket.on('message_to_app', (data) => {
      console.log('收到 nanobot 消息:', data);
      this.emit('message', data);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket 断开');
      this.connected = false;
      this.emit('disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket 错误:', error);
      this.emit('error', error);
    });
  }

  // 发送消息
  sendMessage(message, messageType = 'text', mediaUrl = null) {
    if (!this.connected) {
      throw new Error('未连接');
    }

    this.socket.emit('message_from_app', {
      code: this.pairingCode,
      message: message,
      message_type: messageType,
      media_url: mediaUrl
    });
  }

  // 上传图片/视频
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://your-oss-endpoint.com/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    return data.url;  // 返回文件URL
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  getDeviceId() {
    // 获取设备唯一标识
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }
}

export default new MyAppBridge();
```

**App UI 组件:**

```javascript
// screens/ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import MyAppBridge from '../services/MyAppBridge';

export default function ChatScreen({ route }) {
  const { pairingCode } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    // 连接 WebSocket
    MyAppBridge.connect(pairingCode);

    MyAppBridge.on('connected', (data) => {
      setIsConnected(true);
    });

    MyAppBridge.on('message', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.message,
        type: data.message_type,
        mediaUrl: data.media_url,
        isMe: false,
        timestamp: data.timestamp
      }]);
    });

    MyAppBridge.on('disconnected', () => {
      setIsConnected(false);
    });

    return () => {
      MyAppBridge.disconnect();
    };
  }, [pairingCode]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    MyAppBridge.sendMessage(inputText, 'text');
    
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: inputText,
      type: 'text',
      isMe: true,
      timestamp: new Date().toISOString()
    }]);

    setInputText('');
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isMe ? styles.myMessage : styles.otherMessage
    ]}>
      {item.type === 'image' && item.mediaUrl && (
        <Image source={{ uri: item.mediaUrl }} style={styles.image} />
      )}
      {item.type === 'text' && (
        <Text style={styles.messageText}>{item.text}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {isConnected ? '🟢 已连接' : '🔴 未连接'}
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>发送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: { padding: 16, backgroundColor: '#1a1a1a', alignItems: 'center' },
  headerText: { color: '#fff', fontSize: 16 },
  messageContainer: { 
    maxWidth: '80%', 
    margin: 8, 
    padding: 12, 
    borderRadius: 12 
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#6366f1' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#333' },
  messageText: { color: '#fff', fontSize: 14 },
  image: { width: 200, height: 200, borderRadius: 8 },
  inputContainer: { 
    flexDirection: 'row', 
    padding: 12, 
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333'
  },
  input: { 
    flex: 1, 
    backgroundColor: '#333', 
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100
  },
  sendButton: { 
    marginLeft: 12, 
    backgroundColor: '#6366f1',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center'
  },
  sendButtonText: { color: '#fff', fontWeight: '600' }
});
```

---

## 部署配置

### 阿里云安全组配置

开放以下端口：
- `5001/tcp` - 配对服务 HTTP/WebSocket
- `7000/tcp` - frp 服务端
- `7500/tcp` - frp 仪表盘（可选）

### Nginx 反向代理（推荐）

```nginx
# /etc/nginx/sites-available/myapp-bridge
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HTTP API
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

### frp 配置（如果需要穿透到本地开发）

**阿里云 frps.toml:**
```toml
bindPort = 7000
auth.token = "your_token"

# 子域名支持
subDomainHost = "frp.your-domain.com"
```

**本地 frpc.toml:**
```toml
serverAddr = "your-aliyun-ip"
serverPort = 7000
auth.token = "your_token"

[[proxies]]
name = "myapp-bridge"
type = "http"
localPort = 5001
customDomains = ["myapp.your-domain.com"]
```

---

## 测试验证

### 1. 启动服务端

```bash
# 阿里云
python pairing_server.py

# 或使用 systemd
systemctl start myapp-bridge
```

### 2. 启动 nanobot

```bash
nanobot gateway
```

应该看到输出：
```
[MyApp] 启动 Channel，配对码: XXXX-XXXX
[MyApp] 已连接到服务器
[MyApp] 注册成功，配对码: XXXX-XXXX

MyApp 配对信息
==================================================
配对码: XXXX-XXXX
配对链接: myapp://pair?code=XXXX-XXXX

请用户在 App 中输入此配对码
==================================================
```

### 3. App 连接测试

1. 打开 App
2. 输入配对码
3. 看到 "已连接"
4. 发送消息测试

---

## 多模态支持

### 图片消息

**App 端:**
```javascript
// 选择图片
const image = await ImagePicker.pickImage();

// 上传到 OSS
const imageUrl = await MyAppBridge.uploadMedia(image);

// 发送图片消息
MyAppBridge.sendMessage('查看这张图片', 'image', imageUrl);
```

**nanobot 端:**
```python
# nanobot 自动接收 Media 对象
media = message.media[0]  # Media(type='image', url='https://...')

# 使用 vision 模型分析图片
response = await provider.chat(
    messages=[
        {"role": "user", "content": [
            {"type": "text", "text": message.content},
            {"type": "image_url", "image_url": {"url": media.url}}
        ]}
    ]
)
```

### 视频/文件

流程相同，只是 `message_type` 改为 `video` 或 `file`。

---

## 常见问题

### Q1: WebSocket 连接失败？

检查：
1. 阿里云安全组是否开放端口
2. Nginx 是否正确配置 WebSocket 代理
3. 防火墙是否拦截

### Q2: 消息发送成功但对方收不到？

检查：
1. 配对码是否正确
2. 双方是否都注册了 WebSocket
3. 查看服务端日志

### Q3: 如何支持多用户？

每个用户生成独立的配对码，nanobot 可以同时维护多个连接。

### Q4: 消息丢失怎么办？

实现消息确认机制（ACK）：
```javascript
// 发送消息后等待 ACK
MyAppBridge.sendMessage(text);
MyAppBridge.once('ack', (data) => {
  if (data.message_id === messageId) {
    console.log('消息已送达');
  }
});
```

---

## 总结

这个方案实现了：
- ✅ 类似飞书/WhatsApp 的官方 Channel 集成
- ✅ 用户零额外安装（只需要你的 App）
- ✅ 实时双向通信（WebSocket）
- ✅ 支持文本、图片、视频多模态
- ✅ 自动重连、错误恢复
- ✅ 配对码机制，安全可控

**开发工作量估计：**
- 服务端：1-2天
- nanobot Channel：0.5天
- App 端：2-3天
- 测试调优：1天

**总计：5-7天完成 MVP**

有问题随时问我！

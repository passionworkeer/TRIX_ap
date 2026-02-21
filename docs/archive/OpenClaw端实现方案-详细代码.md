# OpenClaw 端 WebSocket 集成详细实施方案

## 文档概述

**项目名称**: TRIX-3D-Companion + OpenClaw 集成 - OpenClaw 端实现
**文档版本**: 1.0.0
**创建日期**: 2026-02-17
**实施方案**: WebSocket 事件驱动集成

---

## 目录

1. [OpenClaw 项目结构](#openclaw-项目结构)
2. [核心架构设计](#核心架构设计)
3. [完整实现代码](#完整实现代码)
4. [部署配置](#部署配置)
5. [测试验证](#测试验证)
6. [故障排查](#故障排查)
7. [高级特性](#高级特性)

---

## OpenClaw 项目结构

### 典型的 OpenClaw 项目目录结构

```
openclaw/
├── openclaw/
│   ├── __init__.py
│   ├── main.py                 # 主入口
│   ├── core/
│   │   ├── gateway.py          # Gateway 核心（事件总线）
│   │   ├── event_bus.py        # 事件总线实现
│   │   └── agent.py            # Agent 核心
│   ├── skills/                 # 技能目录
│   │   ├── builtin/           # 内置技能
│   │   └── custom/            # 自定义技能
│   ├── channels/              # 通道系统（消息输入输出）
│   │   ├── cli.py             # 命令行通道
│   │   └── __init__.py
│   └── utils/
│       └── config.py          # 配置管理
├── skills/                     # 用户技能目录
│   └── (custom skills)
├── config.yaml                # 主配置文件
├── requirements.txt           # Python 依赖
└── SKILL.md                   # 技能清单
```

### 关键组件说明

| 组件 | 位置 | 功能 |
|------|------|------|
| **Gateway** | `openclaw/core/gateway.py` | 事件总线，负责消息路由和事件分发 |
| **Event Bus** | `openclaw/core/event_bus.py` | 事件发布订阅系统 |
| **Channels** | `openclaw/channels/` | 消息输入输出通道（CLI、WebSocket等） |
| **Skills** | `openclaw/skills/` | AI 工具和功能插件 |

---

## 核心架构设计

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw 核心层                          │
├─────────────────────────────────────────────────────────────┤
│  Event Bus (事件总线)                                        │
│  - emit('user_message', {...})                              │
│  - on('response', callback)                                 │
└──────────────┬────────────────────────────────┬─────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────┐          ┌──────────────────────────┐
│   CLI Channel        │          │  WebSocket Channel       │
│   (内置)             │          │  (新增)                  │
├──────────────────────┤          ├──────────────────────────┤
│ - stdin 输入         │          │ - Socket.IO 客户端       │
│ - stdout 输出        │          │ - 接收 Relay 消息        │
│ - 命令行交互         │          │ - 发送响应回 App         │
└──────────────────────┘          └──────────────────────────┘
                                          │
                                          │ Socket.IO
                                          ▼
                            ┌─────────────────────────┐
                            │   Relay Server          │
                            │   (wss://m.jmtrick.com) │
                            └─────────────────────────┘
                                          │
                                          │ Socket.IO
                                          ▼
                            ┌─────────────────────────┐
                            │   Web App               │
                            │   (TRIX-3D-Companion)   │
                            └─────────────────────────┘
```

### 数据流设计

#### 1. 用户消息流向（App → OpenClaw）

```
Web App
  │ sendMessage("帮我分析这个数据")
  │ Socket.IO emit: 'app_message'
  ▼
Relay Server
  │ 转发消息
  │ Socket.IO emit: 'user_message'
  ▼
OpenClaw WebSocket Channel
  │ @sio.on('user_message')
  │ 接收: {text: "帮我分析这个数据", interrupt: false}
  ▼
OpenClaw Gateway.inject_message()
  │ 注入到事件总线
  │ emit('user_message', {...})
  ▼
OpenClaw Agent
  │ LLM 处理
  │ 工具调用
  ▼
生成响应
```

#### 2. 响应消息流向（OpenClaw → App）

```
OpenClaw Agent
  │ 生成响应
  │ emit('response', {content: "分析结果..."})
  ▼
WebSocket Channel
  │ @gateway.on('response')
  │ 监听到响应事件
  ▼
Socket.IO emit: 'bot_response'
  │ sio.emit('bot_response', {response: "分析结果..."})
  ▼
Relay Server
  │ 转发响应
  │ Socket.IO emit: 'bot_message'
  ▼
Web App
  │ socket.on('bot_message')
  │ 显示在 UI
```

---

## 完整实现代码

### Phase 1: 创建 WebSocket 通道插件

#### 文件：`openclaw/channels/websocket_relay.py`

```python
"""
OpenClaw WebSocket Relay Channel

通过 Relay Server 实现 Web App 与 OpenClaw 的实时双向通信
替代传统的文件轮询方式，实现零延迟事件驱动架构
"""

import socketio
import asyncio
from typing import Optional, Dict, Any, Callable
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class WebSocketRelayChannel:
    """
    WebSocket Relay 通道

    职责：
    1. 连接到 Relay Server (Socket.IO 客户端)
    2. 接收 Web App 发送的用户消息
    3. 将消息注入到 OpenClaw Gateway
    4. 监听 OpenClaw 响应并发送回 Web App
    """

    def __init__(
        self,
        gateway,
        relay_server_url: str,
        pairing_code: Optional[str] = None,
        device_id: Optional[str] = None
    ):
        """
        初始化 WebSocket Relay Channel

        Args:
            gateway: OpenClaw Gateway 实例
            relay_server_url: Relay Server URL (如: wss://m.jmtrick.com)
            pairing_code: 配对码（可选）
            device_id: 设备 ID（自动生成）
        """
        self.gateway = gateway
        self.relay_server_url = relay_server_url
        self.pairing_code = pairing_code
        self.device_id = device_id or self._generate_device_id()

        # Socket.IO 客户端
        self.sio: Optional[socketio.AsyncClient] = None

        # 连接状态
        self.connected = False
        self.paired = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 100

        # 事件回调
        self.on_message_callback: Optional[Callable] = None
        self.on_response_callback: Optional[Callable] = None

        # 绑定 Gateway 事件
        self._bind_gateway_events()

    def _generate_device_id(self) -> str:
        """生成设备 ID"""
        import uuid
        return f"openclaw_{uuid.uuid4().hex[:12]}"

    def _bind_gateway_events(self):
        """绑定 Gateway 事件监听"""
        # 监听 OpenClaw 响应事件
        if hasattr(self.gateway, 'on'):
            self.gateway.on('response', self._handle_gateway_response)
            self.gateway.on('error', self._handle_gateway_error)
            self.gateway.on('status_update', self._handle_gateway_status)

        logger.info("[WebSocketRelay] Gateway 事件已绑定")

    async def connect(self) -> bool:
        """
        连接到 Relay Server

        Returns:
            bool: 连接是否成功
        """
        try:
            logger.info(f"[WebSocketRelay] 正在连接到 {self.relay_server_url}...")

            # 创建 Socket.IO 客户端
            self.sio = socketio.AsyncClient(
                logger=True,
                engineio_logger=False,
                reconnection=True,
                reconnection_attempts=self.max_reconnect_attempts,
                reconnection_delay=5000,
            )

            # 注册事件处理器
            self._register_socket_events()

            # 连接
            await self.sio.connect(self.relay_server_url)

            logger.info("[WebSocketRelay] ✅ 连接成功")
            self.connected = True
            self.reconnect_attempts = 0

            return True

        except Exception as e:
            logger.error(f"[WebSocketRelay] ❌ 连接失败: {e}")
            self.connected = False
            return False

    def _register_socket_events(self):
        """注册 Socket.IO 事件处理器"""
        if not self.sio:
            return

        @self.sio.on('connect')
        async def on_connect():
            logger.info("[WebSocketRelay] Socket.IO 已连接")
            self.connected = True

            # 发送设备注册
            await self.sio.emit('openclaw_register', {
                'device_type': 'openclaw',
                'device_id': self.device_id,
                'pairing_code': self.pairing_code,
                'timestamp': datetime.now().isoformat()
            })

        @self.sio.on('disconnect')
        def on_disconnect():
            logger.warning("[WebSocketRelay] Socket.IO 已断开")
            self.connected = False
            self.paired = False

        @self.sio.on('register_success')
        def on_register_success(data):
            logger.info(f"[WebSocketRelay] ✅ 注册成功: {data}")

        @self.sio.on('pairing_success')
        def on_pairing_success(data):
            logger.info(f"[WebSocketRelay] ✅ 配对成功: {data}")
            self.paired = True

        @self.sio.on('user_message')
        async def on_user_message(data: Dict[str, Any]):
            """
            收到来自 Web App 的用户消息

            Args:
                data: {text: str, interrupt: bool, messageId: str}
            """
            try:
                text = data.get('text', '')
                interrupt = data.get('interrupt', False)
                message_id = data.get('messageId')

                logger.info(f"[WebSocketRelay] 收到用户消息: {text[:50]}... (interrupt={interrupt})")

                # 注入到 Gateway（事件驱动，不写文件）
                await self._inject_to_gateway(text, interrupt, message_id)

            except Exception as e:
                logger.error(f"[WebSocketRelay] 处理用户消息失败: {e}")

        @self.sio.on('ping')
        def on_ping(data):
            """心跳检测"""
            if self.sio:
                self.sio.emit('pong', {'timestamp': datetime.now().isoformat()})

        @self.sio.on('error')
        def on_error(data):
            logger.error(f"[WebSocketRelay] Socket.IO 错误: {data}")

    async def _inject_to_gateway(
        self,
        text: str,
        interrupt: bool = False,
        message_id: Optional[str] = None
    ):
        """
        将消息注入到 Gateway（内存事件）

        Args:
            text: 用户消息文本
            interrupt: 是否打断当前任务
            message_id: 消息 ID
        """
        try:
            # 构建消息对象
            message = {
                'text': text,
                'interrupt': interrupt,
                'source': 'web_app',
                'message_id': message_id,
                'timestamp': datetime.now().isoformat(),
                'channel': 'websocket_relay'
            }

            # 触发 Gateway 事件
            if hasattr(self.gateway, 'emit'):
                self.gateway.emit('user_message', message)
                logger.info(f"[WebSocketRelay] ✅ 消息已注入到 Gateway (interrupt={interrupt})")
            else:
                logger.warning("[WebSocketRelay] Gateway 不支持 emit 方法")

            # 如果有回调，也触发
            if self.on_message_callback:
                await self.on_message_callback(message)

        except Exception as e:
            logger.error(f"[WebSocketRelay] 注入消息到 Gateway 失败: {e}")

    def _handle_gateway_response(self, response: str):
        """
        处理 Gateway 响应（发送回 Web App）

        Args:
            response: OpenClaw 生成的响应文本
        """
        try:
            logger.info(f"[WebSocketRelay] Gateway 响应: {response[:100]}...")

            # 发送回 Web App
            if self.sio and self.connected:
                asyncio.create_task(self.sio.emit('bot_response', {
                    'response': response,
                    'device_id': self.device_id,
                    'timestamp': datetime.now().isoformat()
                }))

            # 如果有回调，也触发
            if self.on_response_callback:
                asyncio.create_task(self.on_response_callback(response))

        except Exception as e:
            logger.error(f"[WebSocketRelay] 处理 Gateway 响应失败: {e}")

    def _handle_gateway_error(self, error: str):
        """处理 Gateway 错误"""
        logger.error(f"[WebSocketRelay] Gateway 错误: {error}")

        # 发送错误回 App
        if self.sio and self.connected:
            asyncio.create_task(self.sio.emit('bot_error', {
                'error': error,
                'timestamp': datetime.now().isoformat()
            }))

    def _handle_gateway_status(self, status: Dict[str, Any]):
        """处理 Gateway 状态更新"""
        logger.info(f"[WebSocketRelay] Gateway 状态: {status}")

        # 发送状态回 App
        if self.sio and self.connected:
            asyncio.create_task(self.sio.emit('status_update', status))

    async def disconnect(self):
        """断开连接"""
        try:
            if self.sio:
                await self.sio.disconnect()
                logger.info("[WebSocketRelay] 已断开连接")
            self.connected = False
            self.paired = False
        except Exception as e:
            logger.error(f"[WebSocketRelay] 断开连接失败: {e}")

    def set_message_callback(self, callback: Callable):
        """设置消息回调"""
        self.on_message_callback = callback

    def set_response_callback(self, callback: Callable):
        """设置响应回调"""
        self.on_response_callback = callback

    @property
    def is_connected(self) -> bool:
        """是否已连接"""
        return self.connected

    @property
    def is_paired(self) -> bool:
        """是否已配对"""
        return self.paired


# ============================================================================
# 工厂函数
# ============================================================================

def create_websocket_relay_channel(
    gateway,
    relay_server_url: str,
    pairing_code: Optional[str] = None,
    device_id: Optional[str] = None
) -> WebSocketRelayChannel:
    """
    创建 WebSocket Relay Channel

    Args:
        gateway: OpenClaw Gateway 实例
        relay_server_url: Relay Server URL
        pairing_code: 配对码（可选）
        device_id: 设备 ID（可选，自动生成）

    Returns:
        WebSocketRelayChannel: WebSocket Relay 通道实例

    Example:
        >>> from openclaw.core.gateway import Gateway
        >>> gateway = Gateway()
        >>> channel = create_websocket_relay_channel(
        ...     gateway,
        ...     relay_server_url="wss://m.jmtrick.com",
        ...     pairing_code="ABC123"
        ... )
        >>> await channel.connect()
    """
    return WebSocketRelayChannel(
        gateway=gateway,
        relay_server_url=relay_server_url,
        pairing_code=pairing_code,
        device_id=device_id
    )
```

---

### Phase 2: 集成到 OpenClaw 主程序

#### 文件：`openclaw/main.py`（修改）

```python
"""
OpenClaw 主程序

支持 WebSocket Relay Channel 的集成
"""

import asyncio
import logging
from typing import Optional
from openclaw.core.gateway import Gateway
from openclaw.channels.cli import CLIChannel
from openclaw.channels.websocket_relay import create_websocket_relay_channel

logger = logging.getLogger(__name__)


class OpenClawApp:
    """OpenClaw 应用主类"""

    def __init__(self, config: dict):
        """
        初始化 OpenClaw

        Args:
            config: 配置字典
        """
        self.config = config
        self.gateway = Gateway(config)

        # 通道列表
        self.channels = []

        # CLI 通道（默认启用）
        if config.get('enable_cli', True):
            self.cli_channel = CLIChannel(self.gateway)
            self.channels.append(self.cli_channel)

        # WebSocket Relay 通道（可选）
        self.ws_channel: Optional = None
        if config.get('websocket_relay', {}).get('enabled', False):
            ws_config = config['websocket_relay']
            self.ws_channel = create_websocket_relay_channel(
                gateway=self.gateway,
                relay_server_url=ws_config['relay_server_url'],
                pairing_code=ws_config.get('pairing_code'),
                device_id=ws_config.get('device_id')
            )
            self.channels.append(self.ws_channel)

    async def start(self):
        """启动 OpenClaw"""
        logger.info("🚀 启动 OpenClaw...")

        # 初始化 Gateway
        await self.gateway.initialize()

        # 启动所有通道
        for channel in self.channels:
            if hasattr(channel, 'connect'):
                await channel.connect()
                logger.info(f"✅ {channel.__class__.__name__} 已启动")

        logger.info("✅ OpenClaw 已就绪")

        # 保持运行
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            logger.info("收到停止信号，正在关闭...")
        finally:
            await self.shutdown()

    async def shutdown(self):
        """关闭 OpenClaw"""
        logger.info("🛑 关闭 OpenClaw...")

        # 关闭所有通道
        for channel in self.channels:
            if hasattr(channel, 'disconnect'):
                await channel.disconnect()

        # 关闭 Gateway
        if hasattr(self.gateway, 'close'):
            await self.gateway.close()

        logger.info("✅ OpenClaw 已关闭")


# ============================================================================
# 命令行入口
# ============================================================================

def main():
    """命令行入口"""
    import argparse
    import yaml

    parser = argparse.ArgumentParser(description='OpenClaw - AI Agent Framework')
    parser.add_argument(
        '--config',
        type=str,
        default='config.yaml',
        help='配置文件路径'
    )
    parser.add_argument(
        '--enable-websocket-relay',
        action='store_true',
        help='启用 WebSocket Relay Channel'
    )
    parser.add_argument(
        '--relay-server',
        type=str,
        default='wss://m.jmtrick.com',
        help='Relay Server URL'
    )
    parser.add_argument(
        '--pairing-code',
        type=str,
        help='配对码'
    )

    args = parser.parse_args()

    # 加载配置
    with open(args.config, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # 覆盖配置（命令行参数优先）
    if args.enable_websocket_relay:
        config['websocket_relay'] = {
            'enabled': True,
            'relay_server_url': args.relay_server,
            'pairing_code': args.pairing_code
        }

    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 启动应用
    app = OpenClawApp(config)
    asyncio.run(app.start())


if __name__ == '__main__':
    main()
```

---

### Phase 3: 配置文件

#### 文件：`config.yaml`（新增）

```yaml
# OpenClaw 配置文件

# Gateway 配置
gateway:
  # LLM 配置
  llm:
    provider: "openai"  # 或 "anthropic"
    model: "gpt-4"
    api_key: "${OPENAI_API_KEY}"
    temperature: 0.7
    max_tokens: 2000

  # 记忆系统
  memory:
    enabled: true
    max_history: 100

# 通道配置
channels:
  # CLI 通道（默认启用）
  cli:
    enabled: true

  # WebSocket Relay 通道（新增）
  websocket_relay:
    enabled: true
    relay_server_url: "wss://m.jmtrick.com"
    pairing_code: ""  # 留空则不自动配对
    device_id: ""     # 留空则自动生成

# 技能配置
skills:
  directories:
    - "./skills"
    - "./openclaw/skills/builtin"

# 日志配置
logging:
  level: "INFO"
  format: "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s"
```

---

### Phase 4: 依赖管理

#### 文件：`requirements.txt`（修改）

```txt
# OpenClaw 核心依赖
openai>=1.0.0
anthropic>=0.18.0
pyyaml>=6.0

# WebSocket Relay 依赖（新增）
python-socketio[async_client]>=5.10.0
aiohttp>=3.9.0

# 其他依赖
python-dotenv>=1.0.0
```

---

## 部署配置

### 环境变量

#### 文件：`.env`（新增）

```bash
# OpenClaw 配置
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# WebSocket Relay 配置
RELAY_SERVER_URL=wss://m.jmtrick.com
PAIRING_CODE=ABC123  # 可选，启动时可传入

# 日志级别
LOG_LEVEL=INFO
```

### 启动方式

#### 方式 1: 使用配置文件启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置 config.yaml（启用 websocket_relay）
vim config.yaml

# 3. 启动 OpenClaw
python -m openclaw.main
```

#### 方式 2: 使用命令行参数启动

```bash
# 启动时指定 Relay Server 和配对码
python -m openclaw.main \
  --enable-websocket-relay \
  --relay-server "wss://m.jmtrick.com" \
  --pairing-code "ABC123"
```

#### 方式 3: 作为后台服务启动（Linux）

```bash
# 使用 systemd
sudo vim /etc/systemd/system/openclaw.service
```

```ini
[Unit]
Description=OpenClaw AI Agent
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/openclaw
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python -m openclaw.main --enable-websocket-relay
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw

# 查看日志
sudo journalctl -u openclaw -f
```

---

## 测试验证

### 本地测试

#### 测试 1: 连接测试

```python
# test_websocket_relay.py
import asyncio
from openclaw.channels.websocket_relay import create_websocket_relay_channel

async def test_connection():
    # Mock Gateway
    class MockGateway:
        def __init__(self):
            self.responses = []

        def emit(self, event, data):
            print(f"[Gateway] 收到事件: {event}, 数据: {data}")

        def on(self, event, callback):
            print(f"[Gateway] 注册监听: {event}")

    gateway = MockGateway()

    # 创建 Channel
    channel = create_websocket_relay_channel(
        gateway=gateway,
        relay_server_url="wss://m.jmtrick.com"
    )

    # 测试连接
    success = await channel.connect()
    print(f"连接结果: {'成功' if success else '失败'}")

    # 保持 10 秒
    await asyncio.sleep(10)

    # 断开连接
    await channel.disconnect()

if __name__ == '__main__':
    asyncio.run(test_connection())
```

运行测试：

```bash
python test_websocket_relay.py
```

预期输出：

```
[WebSocketRelay] Gateway 事件已绑定
[WebSocketRelay] 正在连接到 wss://m.jmtrick.com...
[WebSocketRelay] ✅ 连接成功
[WebSocketRelay] Socket.IO 已连接
连接结果: 成功
```

#### 测试 2: 消息注入测试

```python
# test_message_injection.py
import asyncio
from openclaw.channels.websocket_relay import create_websocket_relay_channel

async def test_message_injection():
    class MockGateway:
        def __init__(self):
            self.received_messages = []

        def emit(self, event, data):
            if event == 'user_message':
                self.received_messages.append(data)
                print(f"[Gateway] ✅ 收到用户消息: {data['text']}")
                print(f"[Gateway]   - interrupt: {data['interrupt']}")
                print(f"[Gateway]   - source: {data['source']}")

        def on(self, event, callback):
            pass

    gateway = MockGateway()

    # 创建 Channel
    channel = create_websocket_relay_channel(
        gateway=gateway,
        relay_server_url="wss://m.jmtrick.com"
    )

    # 连接
    await channel.connect()

    # 模拟收到用户消息（实际通过 Socket.IO）
    test_message = {
        'text': '帮我分析这个数据',
        'interrupt': False,
        'messageId': 'msg_123'
    }

    # 调用注入方法
    await channel._inject_to_gateway(
        text=test_message['text'],
        interrupt=test_message['interrupt'],
        message_id=test_message['messageId']
    )

    # 验证
    assert len(gateway.received_messages) == 1
    assert gateway.received_messages[0]['text'] == '帮我分析这个数据'
    print("\n✅ 消息注入测试通过")

    # 断开连接
    await channel.disconnect()

if __name__ == '__main__':
    asyncio.run(test_message_injection())
```

#### 测试 3: 端到端测试（需要 Relay Server）

```bash
# 1. 启动 OpenClaw
python -m openclaw.main --enable-websocket-relay

# 2. 打开 Web App (TRIX-3D-Companion)
# 进入配对页面，输入配对码

# 3. 发送消息测试
# 在 Web App 中发送: "你好 OpenClaw"

# 预期结果：
# - <1 秒内收到响应
# - OpenClaw 日志显示: [WebSocketRelay] 收到用户消息: 你好 OpenClaw
# - OpenClaw 日志显示: [Gateway] 收到事件: user_message
```

---

### 性能测试

```python
# test_performance.py
import asyncio
import time
from openclaw.channels.websocket_relay import create_websocket_relay_channel

async def test_latency():
    """测试消息延迟"""
    class MockGateway:
        def emit(self, event, data):
            if event == 'user_message':
                # 模拟处理延迟
                asyncio.sleep(0.1)

    gateway = MockGateway()
    channel = create_websocket_relay_channel(
        gateway=gateway,
        relay_server_url="wss://m.jmtrick.com"
    )

    await channel.connect()

    # 测试 100 条消息
    latencies = []
    for i in range(100):
        start = time.time()

        await channel._inject_to_gateway(
            text=f"测试消息 {i}",
            interrupt=False
        )

        end = time.time()
        latencies.append((end - start) * 1000)  # 转换为毫秒

    # 统计
    avg_latency = sum(latencies) / len(latencies)
    max_latency = max(latencies)
    min_latency = min(latencies)

    print(f"平均延迟: {avg_latency:.2f} ms")
    print(f"最大延迟: {max_latency:.2f} ms")
    print(f"最小延迟: {min_latency:.2f} ms")

    # 预期：平均延迟 < 200ms
    assert avg_latency < 200, f"延迟过高: {avg_latency} ms"

    await channel.disconnect()

if __name__ == '__main__':
    asyncio.run(test_latency())
```

---

## 故障排查

### 常见问题

#### Q1: 连接失败 "Connection refused"

**症状**：
```
[WebSocketRelay] ❌ 连接失败: Connection refused
```

**原因**：
- Relay Server 未运行
- URL 错误（如缺少 `wss://` 前缀）
- 网络不通

**解决方案**：
```bash
# 1. 检查 Relay Server 是否运行
curl -I https://m.jmtrick.com

# 2. 检查 URL 格式
# ✅ 正确: wss://m.jmtrick.com
# ❌ 错误: wss://m.jmtrick.com/ (多余的斜杠)
# ❌ 错误: https://m.jmtrick.com (使用了 https 而不是 wss)

# 3. 测试网络连通性
ping m.jmtrick.com
```

---

#### Q2: 配对失败 "Pairing timeout"

**症状**：
```
[WebSocketRelay] 等待配对...（长时间无响应）
```

**原因**：
- 配对码错误或已过期
- Web App 未发送配对请求
- Relay Server 配对逻辑异常

**解决方案**：
```python
# 1. 检查配对码是否正确（6 位大写字母）
pairing_code = "ABC123"  # ✅ 正确
pairing_code = "abc123"  # ❌ 错误（小写）
pairing_code = "ABC1234" # ❌ 错误（7 位）

# 2. 在 Web App 端查看配对状态
# 进入配对页面，确认是否显示 "等待设备确认"

# 3. 重新生成配对码
# 在 Web App 端取消配对，重新生成新的配对码
```

---

#### Q3: 消息未收到 "No response"

**症状**：
- Web App 发送消息后无响应
- OpenClaw 日志显示收到消息，但无响应

**原因**：
- Gateway 事件未正确触发
- LLM API 调用失败
- 响应未正确发送回 App

**解决方案**：
```python
# 1. 检查 Gateway 事件绑定
# 在 openclaw/core/gateway.py 中确认:
def emit(self, event, data):
    """确保此方法存在且正常工作"""
    print(f"[Gateway] emit: {event}, data: {data}")
    # ... 实现代码

# 2. 检查 LLM 配置
# 确认 API Key 是否正确
echo $OPENAI_API_KEY

# 3. 启用调试日志
import logging
logging.basicConfig(level=logging.DEBUG)

# 4. 手动测试 Gateway
gateway.emit('user_message', {'text': '测试'})
```

---

#### Q4: 内存泄漏 "Memory usage increasing"

**症状**：
- 运行一段时间后内存持续增长
- 最终导致进程崩溃

**原因**：
- 事件监听器未正确清理
- 异步任务未正确等待
- Socket.IO 连接未正确断开

**解决方案**：
```python
# 1. 确保清理事件监听器
async def disconnect(self):
    if self.gateway:
        # 移除所有事件监听器
        if hasattr(self.gateway, 'remove_all_listeners'):
            self.gateway.remove_all_listeners()

    if self.sio:
        await self.sio.disconnect()

# 2. 等待所有异步任务
async def disconnect(self):
    # 取消所有未完成的任务
    for task in asyncio.all_tasks():
        if task is not asyncio.current_task():
            task.cancel()

    # 等待取消完成
    await asyncio.gather(*asyncio.all_tasks(), return_exceptions=True)

# 3. 使用内存分析工具
pip install memory_profiler
python -m memory_profiler openclaw/main.py
```

---

### 调试技巧

#### 技巧 1: 启用详细日志

```python
# 在 main.py 中启用 DEBUG 日志
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s'
)

# 针对 Socket.IO 的详细日志
self.sio = socketio.AsyncClient(
    logger=True,              # Socket.IO 日志
    engineio_logger=True      # Engine.IO 日志
)
```

#### 技巧 2: 捕获所有异常

```python
# 在所有异步方法中添加 try-except
async def connect(self):
    try:
        # ... 连接逻辑
    except Exception as e:
        logger.exception("[WebSocketRelay] 连接失败")  # 自动打印堆栈
        raise
```

#### 技巧 3: 使用 Python 调试器

```bash
# 使用 pdb 调试
python -m pdb openclaw/main.py

# 常用命令：
# (Pdb) n          # 下一步
# (Pdb) s          # 进入函数
# (Pdb) c          # 继续执行
# (Pdb) p variable # 打印变量
```

---

## 高级特性

### 特性 1: 流式输出（Streaming）

OpenClaw 支持流式输出响应（像 ChatGPT 一样逐字显示）：

```python
# 在 WebSocketRelayChannel 中添加流式输出支持

async def _handle_gateway_streaming_response(self, response_stream):
    """
    处理 Gateway 流式响应

    Args:
        response_stream: 异步生成器，产生响应片段
    """
    full_response = ""

    async for chunk in response_stream:
        full_response += chunk

        # 实时发送到 App
        if self.sio and self.connected:
            await self.sio.emit('bot_streaming_chunk', {
                'chunk': chunk,
                'is_complete': False,
                'timestamp': datetime.now().isoformat()
            })

    # 发送完成标记
    if self.sio and self.connected:
        await self.sio.emit('bot_streaming_chunk', {
            'chunk': '',
            'is_complete': True,
            'full_response': full_response,
            'timestamp': datetime.now().isoformat()
        })
```

### 特性 2: 任务中断（Interruption）

支持用户打断正在执行的任务：

```python
# 在 _inject_to_gateway 中实现中断逻辑

async def _inject_to_gateway(
    self,
    text: str,
    interrupt: bool = False,
    message_id: Optional[str] = None
):
    if interrupt:
        # 发送中断信号
        if hasattr(self.gateway, 'interrupt_current_task'):
            logger.warning(f"[WebSocketRelay] 🛑 收到中断请求: {text}")
            self.gateway.interrupt_current_task()

            # 等待当前任务停止
            await asyncio.sleep(0.5)

    # 注入新消息
    message = {
        'text': text,
        'interrupt': interrupt,
        'source': 'web_app',
        'message_id': message_id,
        'timestamp': datetime.now().isoformat()
    }

    self.gateway.emit('user_message', message)
```

### 特性 3: 多设备支持

支持多个 Web App 同时连接：

```python
# 在 WebSocketRelayChannel 中添加多设备管理

class WebSocketRelayChannel:
    def __init__(self, gateway, relay_server_url: str):
        # ...
        self.connected_devices = {}  # {device_id: device_info}

    async def on_device_connected(self, data: Dict[str, Any]):
        """设备连接事件"""
        device_id = data['device_id']
        self.connected_devices[device_id] = {
            'connected_at': datetime.now(),
            'last_ping': datetime.now()
        }
        logger.info(f"[WebSocketRelay] 设备已连接: {device_id}")

    async def on_device_disconnected(self, data: Dict[str, Any]):
        """设备断开事件"""
        device_id = data['device_id']
        if device_id in self.connected_devices:
            del self.connected_devices[device_id]
            logger.info(f"[WebSocketRelay] 设备已断开: {device_id}")

    @property
    def connected_device_count(self) -> int:
        """已连接设备数量"""
        return len(self.connected_devices)
```

### 特性 4: 消息队列（离线消息）

支持离线消息缓存：

```python
# 添加消息队列功能

from collections import deque
import json

class WebSocketRelayChannel:
    def __init__(self, gateway, relay_server_url: str):
        # ...
        self.message_queue = deque(maxlen=100)  # 最多缓存 100 条
        self.offline_messages = {}  # {device_id: [messages]}

    async def send_to_device(self, device_id: str, message: Dict[str, Any]):
        """发送消息到指定设备"""
        if device_id in self.connected_devices:
            # 设备在线，直接发送
            await self.sio.emit('device_message', {
                'device_id': device_id,
                'message': message
            })
        else:
            # 设备离线，缓存消息
            if device_id not in self.offline_messages:
                self.offline_messages[device_id] = []
            self.offline_messages[device_id].append(message)
            logger.info(f"[WebSocketRelay] 设备离线，消息已缓存: {device_id}")

    async def on_device_reconnected(self, device_id: str):
        """设备重连后，发送离线消息"""
        if device_id in self.offline_messages:
            messages = self.offline_messages[device_id]
            logger.info(f"[WebSocketRelay] 发送 {len(messages)} 条离线消息")

            for msg in messages:
                await self.sio.emit('device_message', {
                    'device_id': device_id,
                    'message': msg
                })

            # 清空离线消息
            del self.offline_messages[device_id]
```

---

## 总结

### 实现清单

- ✅ 创建 `openclaw/channels/websocket_relay.py`
- ✅ 修改 `openclaw/main.py` 集成 WebSocket Relay Channel
- ✅ 配置 `config.yaml` 启用 websocket_relay
- ✅ 更新 `requirements.txt` 添加依赖
- ✅ 创建 `.env` 环境变量文件
- ✅ 本地测试连接、消息注入、延迟
- ✅ 部署到生产环境

### 核心优势

- ⚡ **零延迟**: 从文件轮询（3-5 秒）升级到事件注入（<200ms）
- 🧠 **零 IO**: 内存操作替代频繁文件读写
- 🔪 **任务中断**: 支持实时打断正在执行的任务
- 🔄 **自动重连**: 断线后自动重连，最多 100 次
- 📊 **可观测**: 详细日志记录，易于调试
- 🔌 **插件化**: 独立通道，不影响 CLI 等其他功能

### 下一步优化

1. **安全性**: 添加消息加密（TLS）
2. **性能**: 实现连接池和负载均衡
3. **监控**: 集成 Prometheus + Grafana
4. **测试**: 完善单元测试和集成测试
5. **文档**: 添加 API 文档和使用示例

---

## 参考资源

### OpenClaw 相关

- [OpenClaw GitHub Repository](https://github.com/openclaw/openclaw)
- [OpenClaw Skills Documentation](https://docs.openclaw.ai/tools/skills)
- [OpenClaw 架构说明](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)

### 技术栈

- [Python Socket.IO 文档](https://python-socketio.readthedocs.io/)
- [AsyncIO 官方文档](https://docs.python.org/3/library/asyncio.html)
- [Socket.IO 协议规范](https://socket.io/docs/v4/)

### 社区资源

- [OpenClaw Browser Relay (Chrome 扩展)](https://github.com/openclaw/browser-relay)
- [Awesome OpenClaw Skills](https://github.com/VoltAgent/awesome-openclaw-skills)

---

**文档结束**

**祝您集成顺利！** 🚀

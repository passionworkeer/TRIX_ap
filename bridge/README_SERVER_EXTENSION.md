# 云端 Relay Server Bridge 支持扩展

## 概述

这个扩展为现有的云端 Relay Server (ws://47.243.55.130:8765) 添加 OpenClaw Bridge 支持。

## 安装步骤

### 1. 将 `cloud_server_bridge_extension.py` 上传到服务器

```bash
# 在服务器上
cd /path/to/nanobot
# 上传文件
```

### 2. 修改现有 cloud_server.py

在 `CloudServer` 类的 `__init__` 方法中添加:

```python
# Bridge 设备管理
self.bridges: Dict[str, dict] = {}  # Bridge 设备列表
```

在 `handle_message` 方法中添加 Bridge 事件处理:

```python
elif message_type == 'bridge_register':
    await self.register_bridge(websocket, data)
elif message_type == 'app_message':
    await self.handle_app_message_with_bridge(websocket, data)
elif message_type == 'bot_message':
    await self.forward_bot_message(websocket, data)
```

## 完整代码

请参考 `cloud_server_bridge_extension.py` 文件。

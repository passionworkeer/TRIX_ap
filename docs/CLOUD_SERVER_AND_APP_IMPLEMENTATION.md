# Nanobot 云端服务器 & App 完整实现文档

## 系统架构

```
┌─────────────────┐         ┌──────────────────────────┐         ┌─────────────────┐
│   手机App       │ ◄─────► │      阿里云服务器        │ ◄─────► │   本地nanobot   │
│  (React/Vue)    │ WebSocket│    (WebSocket Server)   │ WebSocket│  (Python Flask) │
│                 │         │                          │         │                 │
│  • 输入配对码   │         │  • 设备注册管理          │         │  • 生成配对码   │
│  • 发送消息     │         │  • 配对关系维护          │         │  • 执行操作     │
│  • 接收回复     │         │  • 消息转发              │         │  • 返回结果     │
└─────────────────┘         └──────────────────────────┘         └─────────────────┘
```

## 一、云端服务器实现

### 1.1 完整代码 (cloud_server.py)

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nanobot 云端配对服务器
部署在阿里云: 47.243.55.130
"""

import asyncio
import websockets
import json
import redis
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Redis配置 (用于存储配对信息和离线消息)
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
REDIS_DB = 0

# 配对码过期时间 (秒)
PAIRING_CODE_EXPIRE = 3600  # 1小时

class CloudServer:
    def __init__(self):
        # 连接Redis
        try:
            self.redis = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True
            )
            self.redis.ping()
            logger.info("Redis连接成功")
        except Exception as e:
            logger.warning(f"Redis连接失败，使用内存存储: {e}")
            self.redis = None
        
        # WebSocket连接管理
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        # 配对关系: code -> {device_id, app_connection_id}
        self.pairings: Dict[str, dict] = {}
        # 设备信息: device_id -> {type, connection, pairing_code}
        self.devices: Dict[str, dict] = {}
        
    async def register_device(self, websocket, data: dict):
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
    
    async def register_pairing(self, websocket, data: dict):
        """注册配对码 (本地nanobot调用)"""
        code = data.get('code')
        device_id = data.get('device_id')
        
        if not code or not device_id:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '配对码或设备ID不能为空'
            }))
            return
        
        # 存储配对关系
        pairing_data = {
            'code': code,
            'device_id': device_id,
            'status': 'waiting',  # waiting, connected
            'created_at': datetime.now().isoformat(),
            'app_device_id': None
        }
        
        self.pairings[code] = pairing_data
        
        # 更新设备信息
        if device_id in self.devices:
            self.devices[device_id]['pairing_code'] = code
        
        # 存储到Redis
        if self.redis:
            self.redis.setex(f"pairing:{code}", PAIRING_CODE_EXPIRE, json.dumps(pairing_data))
        
        logger.info(f"配对码注册: {code} (设备: {device_id})")
        
        await websocket.send(json.dumps({
            'type': 'pairing_registered',
            'code': code,
            'expires_in': PAIRING_CODE_EXPIRE
        }))
    
    async def handle_app_pairing(self, websocket, data: dict):
        """处理App配对请求"""
        code = data.get('code')
        app_device_id = data.get('device_id')
        client_info = data.get('client_info', {})
        
        if not code:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码不能为空'
            }))
            return
        
        # 查找配对码
        pairing = self.pairings.get(code)
        
        if not pairing and self.redis:
            # 从Redis查找
            pairing_data = self.redis.get(f"pairing:{code}")
            if pairing_data:
                pairing = json.loads(pairing_data)
                self.pairings[code] = pairing
        
        if not pairing:
            await websocket.send(json.dumps({
                'type': 'pairing_failed',
                'message': '配对码无效或已过期'
            }))
            return
        
        # 更新配对关系
        pairing['status'] = 'connected'
        pairing['app_device_id'] = app_device_id
        pairing['connected_at'] = datetime.now().isoformat()
        pairing['client_info'] = client_info
        
        # 更新App设备信息
        self.devices[app_device_id] = {
            'type': 'mobile_app',
            'connection': websocket,
            'connected_at': datetime.now().isoformat(),
            'pairing_code': code,
            'paired_device_id': pairing['device_id']
        }
        
        # 通知本地nanobot配对成功
        nanobot_device_id = pairing['device_id']
        if nanobot_device_id in self.connections:
            await self.connections[nanobot_device_id].send(json.dumps({
                'type': 'pairing_success',
                'code': code,
                'client_info': client_info
            }))
        
        logger.info(f"配对成功: {code} (App: {app_device_id}, Nanobot: {nanobot_device_id})")
        
        await websocket.send(json.dumps({
            'type': 'pairing_success',
            'code': code,
            'message': '配对成功'
        }))
    
    async def forward_chat_message(self, websocket, data: dict):
        """转发聊天消息"""
        app_device_id = data.get('device_id')
        message = data.get('message')
        msg_id = data.get('msg_id', str(uuid.uuid4()))
        
        # 查找App对应的nanobot
        device_info = self.devices.get(app_device_id)
        if not device_info:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '设备未配对'
            }))
            return
        
        pairing_code = device_info.get('pairing_code')
        pairing = self.pairings.get(pairing_code)
        
        if not pairing or pairing.get('status') != 'connected':
            await websocket.send(json.dumps({
                'type': 'error',
                'message': '配对未建立'
            }))
            return
        
        nanobot_device_id = pairing['device_id']
        
        # 转发消息到nanobot
        if nanobot_device_id in self.connections:
            await self.connections[nanobot_device_id].send(json.dumps({
                'type': 'chat_message',
                'message': message,
                'msg_id': msg_id,
                'timestamp': datetime.now().isoformat()
            }))
            
            logger.info(f"消息转发: {app_device_id} -> {nanobot_device_id}")
        else:
            # nanobot离线，存储离线消息
            if self.redis:
                offline_msg = {
                    'msg_id': msg_id,
                    'message': message,
                    'from': app_device_id,
                    'timestamp': datetime.now().isoformat()
                }
                self.redis.lpush(f"offline:{nanobot_device_id}", json.dumps(offline_msg))
            
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'nanobot离线，消息已存储'
            }))
    
    async def forward_chat_response(self, websocket, data: dict):
        """转发聊天回复"""
        msg_id = data.get('msg_id')
        response = data.get('response')
        
        # 查找消息来源的App
        for device_id, device_info in self.devices.items():
            if device_info.get('type') == 'mobile_app':
                pairing_code = device_info.get('pairing_code')
                pairing = self.pairings.get(pairing_code)
                
                if pairing and pairing.get('device_id') in self.connections:
                    if self.connections[pairing['device_id']] == websocket:
                        # 找到对应的App，转发回复
                        await self.connections[device_id].send(json.dumps({
                            'type': 'chat_response',
                            'msg_id': msg_id,
                            'response': response,
                            'timestamp': datetime.now().isoformat()
                        }))
                        
                        logger.info(f"回复转发: {pairing['device_id']} -> {device_id}")
                        return
    
    async def handle_heartbeat(self, websocket):
        """处理心跳"""
        await websocket.send(json.dumps({'type': 'pong'}))
    
    async def handle_websocket(self, websocket, path):
        """处理WebSocket连接"""
        device_id = None
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type')
                    
                    if msg_type == 'register':
                        device_id = await self.register_device(websocket, data)
                    
                    elif msg_type == 'register_pairing':
                        await self.register_pairing(websocket, data)
                    
                    elif msg_type == 'app_pairing':
                        await self.handle_app_pairing(websocket, data)
                    
                    elif msg_type == 'chat_message':
                        await self.forward_chat_message(websocket, data)
                    
                    elif msg_type == 'chat_response':
                        await self.forward_chat_response(websocket, data)
                    
                    elif msg_type == 'ping':
                        await self.handle_heartbeat(websocket)
                    
                    else:
                        logger.warning(f"未知消息类型: {msg_type}")
                        
                except json.JSONDecodeError:
                    logger.error(f"无效的JSON: {message}")
                except Exception as e:
                    logger.error(f"处理消息错误: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"连接关闭: {device_id}")
        finally:
            # 清理连接
            if device_id and device_id in self.connections:
                del self.connections[device_id]
            if device_id and device_id in self.devices:
                del self.devices[device_id]
    
    async def cleanup_expired_pairings(self):
        """清理过期的配对码"""
        while True:
            await asyncio.sleep(300)  # 每5分钟清理一次
            
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
        
        # 启动WebSocket服务器
        async with websockets.serve(self.handle_websocket, '0.0.0.0', 8765):
            logger.info("WebSocket服务器启动: ws://0.0.0.0:8765")
            await asyncio.Future()  # 永久运行


if __name__ == '__main__':
    server = CloudServer()
    asyncio.run(server.start())
```

### 1.2 部署脚本 (deploy.sh)

```bash
#!/bin/bash

# Nanobot 云端服务器部署脚本

# 安装依赖
pip3 install websockets redis

# 创建服务文件
cat > /etc/systemd/system/nanobot-cloud.service << 'EOF'
[Unit]
Description=Nanobot Cloud Server
After=network.target redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nanobot-cloud
ExecStart=/usr/bin/python3 /opt/nanobot-cloud/cloud_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 创建目录
mkdir -p /opt/nanobot-cloud

# 复制代码
cp cloud_server.py /opt/nanobot-cloud/

# 安装Redis
apt-get update
apt-get install -y redis-server

# 启动Redis
systemctl enable redis
systemctl start redis

# 启动服务
systemctl daemon-reload
systemctl enable nanobot-cloud
systemctl start nanobot-cloud

echo "部署完成！"
echo "查看日志: journalctl -u nanobot-cloud -f"
```

### 1.3 Nginx配置

```nginx
# /etc/nginx/sites-available/nanobot

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name 47.243.55.130;

    location /nanobot {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

---

## 二、手机App实现

### 2.1 React Native / React Web 完整代码

```typescript
// App.tsx - React Native 实现
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

// 配置
const CLOUD_SERVER = 'ws://47.243.55.130/nanobot';
const DEVICE_ID_KEY = '@nanobot_device_id';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  // 初始化设备ID
  useEffect(() => {
    initDevice();
  }, []);

  // 连接WebSocket
  useEffect(() => {
    if (deviceId) {
      connectWebSocket();
    }
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [deviceId]);

  const initDevice = async () => {
    // 从存储中读取或生成设备ID
    let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!storedId) {
      storedId = Math.random().toString(36).substring(2, 10).toUpperCase();
      await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
    }
    setDeviceId(storedId);
  };

  const connectWebSocket = () => {
    try {
      ws.current = new WebSocket(CLOUD_SERVER);

      ws.current.onopen = () => {
        console.log('WebSocket连接成功');
        setIsConnected(true);
        
        // 注册设备
        ws.current?.send(JSON.stringify({
          type: 'register',
          device_id: deviceId,
          device_type: 'mobile_app'
        }));
      };

      ws.current.onmessage = (event) => {
        handleMessage(JSON.parse(event.data));
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket连接关闭');
        setIsConnected(false);
        
        // 自动重连
        reconnectTimeout.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };
    } catch (error) {
      console.error('连接失败:', error);
    }
  };

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'register_success':
        console.log('设备注册成功:', data.device_id);
        break;
        
      case 'pairing_success':
        setIsPaired(true);
        Alert.alert('配对成功', '您已成功连接到nanobot');
        break;
        
      case 'pairing_failed':
        Alert.alert('配对失败', data.message);
        break;
        
      case 'chat_response':
        // 收到nanobot的回复
        setMessages(prev => [...prev, {
          id: data.msg_id,
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }]);
        break;
        
      case 'error':
        Alert.alert('错误', data.message);
        break;
        
      case 'pong':
        // 心跳响应
        break;
    }
  };

  const handlePairing = () => {
    if (!pairingCode.trim()) {
      Alert.alert('请输入配对码');
      return;
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      Alert.alert('未连接', '请等待连接建立');
      return;
    }

    ws.current.send(JSON.stringify({
      type: 'app_pairing',
      code: pairingCode.toUpperCase(),
      device_id: deviceId,
      client_info: {
        device_name: Platform.OS === 'ios' ? 'iPhone' : 'Android',
        platform: Platform.OS,
        version: Platform.Version
      }
    }));
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    if (!isPaired) {
      Alert.alert('未配对', '请先输入配对码连接nanobot');
      return;
    }

    const msgId = Date.now().toString();
    
    // 添加用户消息到列表
    setMessages(prev => [...prev, {
      id: msgId,
      role: 'user',
      content: inputText,
      timestamp: new Date()
    }]);

    // 发送到云端
    ws.current?.send(JSON.stringify({
      type: 'chat_message',
      device_id: deviceId,
      message: inputText,
      msg_id: msgId
    }));

    setInputText('');
  };

  // 配对界面
  if (!isPaired) {
    return (
      <View style={styles.container}>
        <View style={styles.pairingContainer}>
          <Text style={styles.title}>连接 Nanobot</Text>
          
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.statusText}>
              {isConnected ? '已连接到云端' : '连接中...'}
            </Text>
          </View>

          <Text style={styles.label}>输入配对码</Text>
          <TextInput
            style={styles.input}
            value={pairingCode}
            onChangeText={setPairingCode}
            placeholder="例如: A1B2C3D4"
            autoCapitalize="characters"
            maxLength={8}
          />

          <TouchableOpacity 
            style={[styles.button, !isConnected && styles.buttonDisabled]}
            onPress={handlePairing}
            disabled={!isConnected}
          >
            <Text style={styles.buttonText}>连接</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            在电脑上打开nanobot，点击"生成配对码"，然后在此处输入
          </Text>
        </View>
      </View>
    );
  }

  // 聊天界面
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nanobot</Text>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
      </View>

      <ScrollView style={styles.messagesContainer}>
        {messages.map((msg) => (
          <View 
            key={msg.id} 
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}
          >
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.chatInput}
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
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f'
  },
  pairingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f0f0f5',
    marginBottom: 30
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a25',
    borderRadius: 20
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  statusText: {
    color: '#8b8b9a',
    fontSize: 14
  },
  label: {
    color: '#8b8b9a',
    fontSize: 16,
    marginBottom: 10
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#1a1a25',
    borderRadius: 12,
    paddingHorizontal: 20,
    color: '#f0f0f5',
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 20
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  hint: {
    color: '#5a5a6a',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 40
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f0f0f5'
  },
  messagesContainer: {
    flex: 1,
    padding: 16
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1'
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a25'
  },
  messageText: {
    color: '#f0f0f5',
    fontSize: 15,
    lineHeight: 20
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3a'
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1a1a25',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f0f0f5',
    fontSize: 15,
    maxHeight: 100
  },
  sendButton: {
    marginLeft: 12,
    paddingHorizontal: 20,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    justifyContent: 'center'
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  }
});
```

### 2.2 Web版本 (React)

```typescript
// components/NanobotChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import './NanobotChat.css';

const CLOUD_SERVER = 'ws://47.243.55.130/nanobot';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const NanobotChat: React.FC = () => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [pairingCode, setPairingCode] = useState('');
  const [isPaired, setIsPaired] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 生成或读取设备ID
    let storedId = localStorage.getItem('nanobot_device_id');
    if (!storedId) {
      storedId = Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('nanobot_device_id', storedId);
    }
    setDeviceId(storedId);
    connectWebSocket(storedId);
    
    return () => ws.current?.close();
  }, []);

  const connectWebSocket = (devId: string) => {
    ws.current = new WebSocket(CLOUD_SERVER);

    ws.current.onopen = () => {
      setIsConnected(true);
      ws.current?.send(JSON.stringify({
        type: 'register',
        device_id: devId,
        device_type: 'mobile_app'
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setTimeout(() => connectWebSocket(devId), 5000);
    };
  };

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'pairing_success':
        setIsPaired(true);
        break;
      case 'chat_response':
        setMessages(prev => [...prev, {
          id: data.msg_id,
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }]);
        break;
    }
  };

  const handlePairing = () => {
    if (!pairingCode.trim()) return;
    
    ws.current?.send(JSON.stringify({
      type: 'app_pairing',
      code: pairingCode.toUpperCase(),
      device_id: deviceId,
      client_info: {
        device_name: navigator.userAgent,
        platform: 'web'
      }
    }));
  };

  const sendMessage = () => {
    if (!inputText.trim() || !isPaired) return;

    const msgId = Date.now().toString();
    
    setMessages(prev => [...prev, {
      id: msgId,
      role: 'user',
      content: inputText,
      timestamp: new Date()
    }]);

    ws.current?.send(JSON.stringify({
      type: 'chat_message',
      device_id: deviceId,
      message: inputText,
      msg_id: msgId
    }));

    setInputText('');
  };

  if (!isPaired) {
    return (
      <div className="pairing-container">
        <h1>连接 Nanobot</h1>
        <div className={`status-badge ${isConnected ? 'connected' : ''}`}>
          {isConnected ? '已连接' : '连接中...'}
        </div>
        <input
          type="text"
          value={pairingCode}
          onChange={(e) => setPairingCode(e.target.value)}
          placeholder="输入配对码"
          maxLength={8}
        />
        <button onClick={handlePairing} disabled={!isConnected}>
          连接
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="输入消息..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
        />
        <button onClick={sendMessage}>发送</button>
      </div>
    </div>
  );
};
```

```css
/* components/NanobotChat.css */
.pairing-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0a0a0f;
  color: #f0f0f5;
  padding: 20px;
}

.pairing-container h1 {
  font-size: 28px;
  margin-bottom: 30px;
}

.status-badge {
  padding: 8px 16px;
  background: #ef4444;
  border-radius: 20px;
  margin-bottom: 40px;
}

.status-badge.connected {
  background: #22c55e;
}

.pairing-container input {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  font-size: 20px;
  text-align: center;
  letter-spacing: 4px;
  background: #1a1a25;
  border: 1px solid #2a2a3a;
  border-radius: 12px;
  color: #f0f0f5;
  margin-bottom: 20px;
}

.pairing-container button {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.pairing-container button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0f;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  margin-bottom: 12px;
  line-height: 1.6;
}

.message.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  margin-left: auto;
}

.message.assistant {
  align-self: flex-start;
  background: #1a1a25;
  color: #f0f0f5;
}

.input-area {
  display: flex;
  padding: 16px;
  border-top: 1px solid #2a2a3a;
  gap: 12px;
}

.input-area textarea {
  flex: 1;
  padding: 12px 16px;
  background: #1a1a25;
  border: 1px solid #2a2a3a;
  border-radius: 12px;
  color: #f0f0f5;
  resize: none;
  min-height: 50px;
  max-height: 150px;
}

.input-area button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
```

---

## 三、部署步骤

### 3.1 云端部署

```bash
# 1. 上传代码到阿里云
scp cloud_server.py deploy.sh root@47.243.55.130:/opt/nanobot-cloud/

# 2. SSH登录并执行部署
ssh root@47.243.55.130
cd /opt/nanobot-cloud
chmod +x deploy.sh
./deploy.sh

# 3. 配置Nginx
# 复制上面的nginx配置到 /etc/nginx/sites-available/nanobot
ln -s /etc/nginx/sites-available/nanobot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 3.2 本地nanobot

```bash
# 确保websocket-client已安装
pip install websocket-client

# 启动服务
python web_interface_final.py
```

### 3.3 App配置

```bash
# React Native
npm install
npx react-native run-android  # 或 run-ios

# React Web
npm install
npm run dev
```

---

## 四、消息协议

### 本地nanobot → 云端

| 类型 | 说明 |
|------|------|
| `register` | 设备注册 |
| `register_pairing` | 注册配对码 |
| `chat_response` | 回复消息 |
| `pong` | 心跳响应 |

### 手机App → 云端

| 类型 | 说明 |
|------|------|
| `register` | 设备注册 |
| `app_pairing` | 配对请求 |
| `chat_message` | 发送消息 |
| `ping` | 心跳 |

### 云端 → 设备

| 类型 | 说明 |
|------|------|
| `register_success` | 注册成功 |
| `pairing_registered` | 配对码注册成功 |
| `pairing_success` | 配对成功 |
| `pairing_failed` | 配对失败 |
| `chat_message` | 转发消息 |
| `chat_response` | 转发回复 |
| `error` | 错误信息 |
| `pong` | 心跳响应 |

---

## 五、注意事项

1. **安全性**
   - 生产环境使用WSS (WebSocket Secure)
   - 添加身份验证机制
   - 限制配对码尝试次数

2. **性能优化**
   - 使用Redis集群
   - 添加消息队列 (RabbitMQ/Kafka)
   - 实现连接池

3. **监控**
   - 添加Prometheus监控
   - 记录连接数和消息量
   - 设置告警规则

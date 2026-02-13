# TRIX 3D Companion - Clawbot 简化版实现指南

> **版本**: v1.0
> **目标**: 最小化实现，快速建立连接
> **适用场景**: 开发测试、原型验证

---

## 目录

1. [方案概述](#方案概述)
2. [快速配置](#快速配置)
3. [实现代码](#实现代码)
4. [安全方案](#安全方案)
5. [测试验证](#测试验证)

---

## 方案概述

### 简化版特点

- ✅ **快速上手**: 5分钟完成配置
- ✅ **代码精简**: ~150行核心代码
- ✅ **基础安全**: Token 认证 + 设备隔离
- ❌ 无自动重连
- ❌ 无消息队列
- ❌ 无心跳机制

### 适用场景

| 场景 | 推荐方案 |
|------|----------|
| 开发测试 | ✅ 简化版 |
| 生产环境 | ❌ 完整版 |
| 原型验证 | ✅ 简化版 |
| 长期使用 | ❌ 完整版 |

---

## 快速配置

### 步骤 1: 配置 Gateway

编辑 `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "trix-simple-token-abc123"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true
    }
  }
}
```

### 步骤 2: 启动 Gateway

```bash
# 启动
openclaw gateway

# 验证
curl http://127.0.0.1:18789/health
```

### 步骤 3: 配置手机 App

创建 `.env` 文件：

```env
# Gateway 配置
VITE_CLAWBOT_URL=ws://192.168.1.100:18789
VITE_CLAWBOT_TOKEN=trix-simple-token-abc123
```

---

## 实现代码

### 简单连接服务

**文件**: `src/services/simpleGatewayService.ts`

```typescript
interface SimpleConfig {
  url: string;
  token: string;
  deviceId: string;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

type MessageHandler = (data: string) => void;

class SimpleGatewayService {
  private ws: WebSocket | null = null;
  private config: SimpleConfig;
  private state: ConnectionState = { status: 'disconnected' };
  private messageHandler: MessageHandler | null = null;

  constructor(config: SimpleConfig) {
    this.config = config;
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 设置消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * 连接到 Gateway
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.state = { status: 'connecting' };

        // 创建 WebSocket 连接
        this.ws = new WebSocket(this.config.url);

        // 连接打开
        this.ws.onopen = () => {
          console.log('[SimpleWS] WebSocket 已打开');

          // 发送认证握手
          this.sendAuthHandshake();
        };

        // 接收消息
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // 连接错误
        this.ws.onerror = (error) => {
          console.error('[SimpleWS] WebSocket 错误:', error);
          this.state = { status: 'error', error: '连接错误' };
          reject(error);
        };

        // 连接关闭
        this.ws.onclose = (event) => {
          console.log('[SimpleWS] WebSocket 已关闭:', event.code);
          this.state = { status: 'disconnected' };
        };

      } catch (error) {
        this.state = { status: 'error', error: String(error) };
        reject(error);
      }
    });
  }

  /**
   * 发送认证握手
   */
  private sendAuthHandshake(): void {
    const message = {
      type: 'req',
      id: 'auth-' + Date.now(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: 'operator',
        client: {
          id: this.config.deviceId,
          mode: 'webchat',
          platform: 'ios',
          displayName: 'TRIX Mobile',
          version: '1.0.0',
          instanceId: this.config.deviceId
        },
        caps: [],
        auth: {
          token: this.config.token
        }
      }
    };

    this.ws!.send(JSON.stringify(message));
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log('[SimpleWS] 收到消息:', message);

      // 处理握手挑战
      if (message.event === 'connect.challenge') {
        this.sendChallengeResponse(message.payload?.nonce);
        return;
      }

      // 处理握手成功
      if (message.type === 'res' && message.payload?.type === 'hello-ok') {
        console.log('[SimpleWS] 认证成功');
        this.state = { status: 'connected' };
        return;
      }

      // 处理 AI 响应
      if (message.payload?.stream === 'assistant') {
        const delta = message.payload.data?.delta || '';
        if (this.messageHandler) {
          this.messageHandler(delta);
        }
        return;
      }

    } catch (error) {
      console.error('[SimpleWS] 消息解析错误:', error);
    }
  }

  /**
   * 发送挑战响应
   */
  private sendChallengeResponse(nonce: string): void {
    const message = {
      type: 'req',
      id: nonce,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: 'operator',
        client: {
          id: this.config.deviceId,
          mode: 'webchat',
          platform: 'ios',
          displayName: 'TRIX Mobile',
          version: '1.0.0',
          instanceId: this.config.deviceId
        },
        caps: [],
        auth: {
          token: this.config.token
        }
      }
    };

    this.ws!.send(JSON.stringify(message));
  }

  /**
   * 发送消息
   */
  sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('未连接到 Gateway');
    }

    const message = {
      type: 'req',
      id: 'msg-' + Date.now(),
      method: 'agent',
      params: {
        message: text,
        to: 'self',
        idempotencyKey: Date.now().toString()
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = { status: 'disconnected' };
  }
}

// 导出单例
let serviceInstance: SimpleGatewayService | null = null;

export function getSimpleGatewayService(): SimpleGatewayService {
  if (!serviceInstance) {
    serviceInstance = new SimpleGatewayService({
      url: import.meta.env.VITE_CLAWBOT_URL || 'ws://localhost:18789',
      token: import.meta.env.VITE_CLAWBOT_TOKEN || '',
      deviceId: 'trix-mobile-' + Date.now()
    });
  }
  return serviceInstance;
}
```

### React Hook 使用

**文件**: `src/hooks/useSimpleGateway.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getSimpleGatewayService } from '../services/simpleGatewayService';

export function useSimpleGateway() {
  const [state, setState] = useState('disconnected');
  const [response, setResponse] = useState('');
  const service = getSimpleGatewayService();

  useEffect(() => {
    // 监听状态变化
    const interval = setInterval(() => {
      setState(service.getState().status);
    }, 100);

    return () => clearInterval(interval);
  }, [service]);

  useEffect(() => {
    // 设置消息处理器
    service.onMessage((data) => {
      setResponse(prev => prev + data);
    });
  }, [service]);

  const connect = useCallback(async () => {
    try {
      await service.connect();
    } catch (error) {
      console.error('连接失败:', error);
    }
  }, [service]);

  const sendMessage = useCallback((text: string) => {
    setResponse(''); // 清空之前的响应
    service.sendMessage(text);
  }, [service]);

  const disconnect = useCallback(() => {
    service.disconnect();
  }, [service]);

  return {
    state,
    response,
    connect,
    sendMessage,
    disconnect
  };
}
```

### 使用示例

**文件**: `src/screens/ChatDetail.tsx`

```typescript
import React from 'react';
import { useSimpleGateway } from '../hooks/useSimpleGateway';

const ChatDetail: React.FC = () => {
  const { state, response, connect, sendMessage, disconnect } = useSimpleGateway();
  const [input, setInput] = React.useState('');

  const handleConnect = () => {
    connect();
  };

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {/* 连接状态 */}
      <div>
        状态: {state}
        {state === 'disconnected' && (
          <button onClick={handleConnect}>连接</button>
        )}
        {state === 'connected' && (
          <button onClick={disconnect}>断开</button>
        )}
      </div>

      {/* 消息输入 */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入消息..."
      />
      <button onClick={handleSend}>发送</button>

      {/* AI 响应 */}
      <div style={{ marginTop: 20, padding: 10, background: '#f5f5f5' }}>
        {response || '等待响应...'}
      </div>
    </div>
  );
};

export default ChatDetail;
```

---

## 安全方案

### 1. Token 认证

```typescript
// Token 验证
interface TokenPayload {
  deviceId: string;
  timestamp: number;
}

function validateToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token));
    const now = Date.now();

    // 检查 Token 时效性（24小时）
    if (now - payload.timestamp > 24 * 60 * 60 * 1000) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

### 2. 设备隔离

```typescript
// 设备白名单
interface DeviceWhitelist {
  [deviceId: string]: {
    allowed: boolean;
    pairedAt: number;
  };
}

const whitelist: DeviceWhitelist = {};

// 添加设备到白名单
function addDevice(deviceId: string): void {
  whitelist[deviceId] = {
    allowed: true,
    pairedAt: Date.now()
  };
}

// 检查设备权限
function isDeviceAllowed(deviceId: string): boolean {
  return whitelist[deviceId]?.allowed || false;
}
```

### 3. 网络限制

```json
// Gateway 配置 - 仅允许局域网访问
{
  "gateway": {
    "mode": "local",
    "bindAddress": "127.0.0.1",  // 仅本地访问
    "port": 18789
  }
}
```

---

## 测试验证

### 测试清单

- [ ] Gateway 成功启动
- [ ] 手机能连接到 Gateway
- [ ] 认证握手成功
- [ ] 消息发送成功
- [ ] AI 响应正常接收
- [ ] 断开连接正常

### 测试命令

```bash
# 1. 测试 Gateway 运行
curl http://127.0.0.1:18789/health

# 2. 测试端口监听
lsof -i :18789  # macOS/Linux
netstat -ano | findstr :18789  # Windows

# 3. 测试网络连通性
ping 192.168.1.100
```

### 常见问题

**Q: 连接失败 (Error 1006)**

A: 检查以下几点：
1. Gateway 是否运行
2. 网络是否通畅
3. Token 是否正确
4. 防火墙是否阻止

**Q: 认证失败**

A: 验证 Token 配置：
- `.env` 文件中的 Token
- `openclaw.json` 中的 Token
- 两者必须一致

**Q: 消息发送无响应**

A: 确认：
1. 握手是否成功（状态为 `connected`）
2. AI Agent 是否正常运行
3. 查看浏览器控制台日志

---

## 下一步

### 升级到完整版

当简化版无法满足需求时，可以升级到完整版：

1. **添加自动重连**
2. **实现心跳机制**
3. **添加消息队列**
4. **支持多媒体消息**
5. **完善权限管理**

完整版文档：
- [CLAWBOT_INTEGRATION_GUIDE.md](./CLAWBOT_INTEGRATION_GUIDE.md)
- [CLAWBOT_GATEWAY_INTEGRATION.md](./CLAWBOT_GATEWAY_INTEGRATION.md)

---

**版本**: v1.0
**最后更新**: 2026-02-11
**维护者**: TRIX 3D Companion 团队

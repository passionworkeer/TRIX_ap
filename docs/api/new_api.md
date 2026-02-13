# App 端集成指南

## 📋 概述

本指南说明如何将 app 端集成到新的 ngrok 隧道，确保跨局域网的长连接稳定运行。

---

## 🚀 快速变更

### 只需改 1 个地方

**将 Gateway URL 从 LocalTunnel 改为 ngrok：**

```typescript
// ❌ 旧代码（LocalTunnel）
const GATEWAY_URL = "https://your-localtunnel-url.loca.lt";

// ✅ 新代码（ngrok）
const GATEWAY_URL = "https://devyn-physicochemical-halina.ngrok-free.dev";
```

---

## 📝 详细变更清单

### 1. 配置文件更新

#### 文件：`src/config/gateway.ts`（或你的配置文件）

```typescript
// ✅ 新配置
export const GATEWAY_CONFIG = {
  // Gateway URL
  URL: "https://devyn-physicochemical-halina.ngrok-free.dev",

  // WebSocket URL（WSS）
  WS_URL: "wss://devyn-physicochemical-halina.ngrok-free.dev",

  // HTTP API 端点
  API_BASE: "https://devyn-physicochemical-halina.ngrok-free.dev/api",

  // 认证 Token（从 ~/.openclaw/openclaw.json 获取）
  // 默认：f5a90456ca2531d1d227c95bba997726c5f139bcb5b798d6
  AUTH_TOKEN: "f5a90456ca2531d1d227c95bba997726c5f139bcb5b798d6",

  // 连接超时（毫秒）
  TIMEOUT: 30000,

  // 重连配置
  RECONNECT: {
    ENABLED: true,              // 启用自动重连
    MAX_RETRIES: 10,           // 最大重试次数
    INITIAL_DELAY: 1000,        // 初始延迟（毫秒）
    MAX_DELAY: 30000,          // 最大延迟（毫秒）
    BACKOFF_FACTOR: 2,          // 退避因子
  },
};
```

---

### 2. WebSocket 连接实现

#### React Native 示例

```typescript
// src/services/websocket.ts
import { GATEWAY_CONFIG } from '../config/gateway';
import { EventSource } from 'eventsource'; // 或者使用 Socket.io-client

export class GatewayWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private isManualClose = false;

  constructor(private onMessage: (data: any) => void) {}

  /**
   * 连接到 Gateway WebSocket
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket 已连接，跳过重复连接');
      return;
    }

    console.log('🔌 正在连接 Gateway WebSocket...');

    try {
      // 创建 WebSocket 连接
      this.ws = new WebSocket(GATEWAY_CONFIG.WS_URL, {
        headers: {
          'Authorization': `Bearer ${GATEWAY_CONFIG.AUTH_TOKEN}`,
        },
      });

      // 连接成功
      this.ws.onopen = () => {
        console.log('✅ Gateway WebSocket 已连接');
        this.retryCount = 0; // 重置重试计数
        this.sendHeartbeat(); // 发送心跳
      };

      // 收到消息
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 收到消息:', data);
          this.onMessage(data);
        } catch (error) {
          console.error('❌ 解析消息失败:', error);
        }
      };

      // 连接错误
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error);
      };

      // 连接关闭
      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket 已关闭:', event.code, event.reason);

        // 如果不是手动关闭，尝试重连
        if (!this.isManualClose && GATEWAY_CONFIG.RECONNECT.ENABLED) {
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      console.error('❌ 创建 WebSocket 失败:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 发送心跳（保持连接活跃）
   */
  private sendHeartbeat() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect() {
    if (this.retryCount >= GATEWAY_CONFIG.RECONNECT.MAX_RETRIES) {
      console.error('❌ 达到最大重试次数，停止重连');
      return;
    }

    const delay = Math.min(
      GATEWAY_CONFIG.RECONNECT.INITIAL_DELAY * Math.pow(GATEWAY_CONFIG.RECONNECT.BACKOFF_FACTOR, this.retryCount),
      GATEWAY_CONFIG.RECONNECT.MAX_DELAY
    );

    this.retryCount++;
    console.log(`🔄 ${delay / 1000}秒后尝试第 ${this.retryCount} 次重连...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 发送消息
   */
  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ WebSocket 未连接，无法发送消息');
    }
  }

  /**
   * 手动关闭连接
   */
  disconnect() {
    this.isManualClose = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('🔌 WebSocket 已手动关闭');
  }
}
```

#### Flutter 示例

```dart
// lib/services/gateway_websocket.dart
import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class GatewayWebSocket {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  int _retryCount = 0;
  bool _isManualClose = false;

  final String url;
  final String authToken;
  final Function(dynamic) onMessage;

  final bool enableReconnect;
  final int maxRetries;
  final int initialDelay;
  final int maxDelay;
  final double backoffFactor;

  GatewayWebSocket({
    required this.url,
    required this.authToken,
    required this.onMessage,
    this.enableReconnect = true,
    this.maxRetries = 10,
    this.initialDelay = 1000,
    this.maxDelay = 30000,
    this.backoffFactor = 2.0,
  });

  /// 连接到 Gateway WebSocket
  Future<void> connect() async {
    if (_channel != null) {
      print('⚠️ WebSocket 已连接，跳过重复连接');
      return;
    }

    print('🔌 正在连接 Gateway WebSocket...');

    try {
      // 构建 WebSocket URL（添加认证参数）
      final uri = Uri.parse(url).replace(
        queryParameters: {
          'auth_token': authToken,
        },
      );

      // 创建 WebSocket 连接
      _channel = WebSocketChannel.connect(uri);

      // 监听消息
      _subscription = _channel!.stream.listen(
        (message) {
          print('📨 收到消息: $message');
          try {
            final data = jsonDecode(message);
            onMessage(data);
          } catch (e) {
            print('❌ 解析消息失败: $e');
          }
        },
        onError: (error) {
          print('❌ WebSocket 错误: $error');
        },
        onDone: () {
          print('🔌 WebSocket 已关闭');
          if (!_isManualClose && enableReconnect) {
            _scheduleReconnect();
          }
        },
        cancelOnError: false,
      );

      print('✅ Gateway WebSocket 已连接');
      _retryCount = 0;
      _startHeartbeat();

    } catch (e) {
      print('❌ 创建 WebSocket 失败: $e');
      if (enableReconnect) {
        _scheduleReconnect();
      }
    }
  }

  /// 发送心跳（保持连接活跃）
  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      send({
        'type': 'heartbeat',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    });
  }

  /// 调度重连
  void _scheduleReconnect() {
    if (_retryCount >= maxRetries) {
      print('❌ 达到最大重试次数，停止重连');
      return;
    }

    final delay = (initialDelay * backoffFactor.pow(_retryCount)).toInt().clamp(0, maxDelay);
    _retryCount++;

    print('🔄 ${delay / 1000}秒后尝试第 $_retryCount 次重连...');

    _reconnectTimer = Timer(Duration(milliseconds: delay), () {
      connect();
    });
  }

  /// 发送消息
  void send(Map<String, dynamic> data) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(data));
    } else {
      print('❌ WebSocket 未连接，无法发送消息');
    }
  }

  /// 手动关闭连接
  void disconnect() {
    _isManualClose = true;

    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;

    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    _subscription?.cancel();
    _subscription = null;

    _channel?.sink.close();
    _channel = null;

    print('🔌 WebSocket 已手动关闭');
  }
}
```

---

### 3. HTTP API 调用实现

#### React Native 示例

```typescript
// src/services/gateway-api.ts
import { GATEWAY_CONFIG } from '../config/gateway';

export class GatewayAPI {
  /**
   * 发送配对请求
   */
  static async requestPairing(deviceInfo: {
    device_id: string;
    device_name: string;
    device_type: 'mobile' | 'tablet' | 'desktop';
  }) {
    try {
      const response = await fetch(`${GATEWAY_CONFIG.API_BASE}/pairing/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GATEWAY_CONFIG.AUTH_TOKEN}`,
        },
        body: JSON.stringify(deviceInfo),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 配对请求成功:', data);
      return data;

    } catch (error) {
      console.error('❌ 配对请求失败:', error);
      throw error;
    }
  }

  /**
   * 查询配对状态
   */
  static async getPairingStatus(requestId: string) {
    try {
      const response = await fetch(`${GATEWAY_CONFIG.API_BASE}/pairing/status/${requestId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GATEWAY_CONFIG.AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 查询配对状态成功:', data);
      return data;

    } catch (error) {
      console.error('❌ 查询配对状态失败:', error);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  static async testConnection() {
    try {
      const response = await fetch(GATEWAY_CONFIG.URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GATEWAY_CONFIG.AUTH_TOKEN}`,
        },
      });

      const isConnected = response.ok;
      console.log(isConnected ? '✅ Gateway 连接正常' : '❌ Gateway 连接失败');
      return isConnected;

    } catch (error) {
      console.error('❌ 测试连接失败:', error);
      return false;
    }
  }
}
```

#### Flutter 示例

```dart
// lib/services/gateway_api.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class GatewayAPI {
  final String baseUrl;
  final String authToken;

  GatewayAPI({
    required this.baseUrl,
    required this.authToken,
  });

  /// 发送配对请求
  Future<Map<String, dynamic>> requestPairing({
    required String deviceId,
    required String deviceName,
    required String deviceType,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/pairing/request'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'device_id': deviceId,
          'device_name': deviceName,
          'device_type': deviceType,
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.reasonPhrase}');
      }

      final data = jsonDecode(response.body);
      print('✅ 配对请求成功: $data');
      return data;

    } catch (e) {
      print('❌ 配对请求失败: $e');
      rethrow;
    }
  }

  /// 查询配对状态
  Future<Map<String, dynamic>> getPairingStatus(String requestId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/pairing/status/$requestId'),
        headers: {
          'Authorization': 'Bearer $authToken',
        },
      );

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.reasonPhrase}');
      }

      final data = jsonDecode(response.body);
      print('✅ 查询配对状态成功: $data');
      return data;

    } catch (e) {
      print('❌ 查询配对状态失败: $e');
      rethrow;
    }
  }

  /// 测试连接
  Future<bool> testConnection() async {
    try {
      final response = await http.get(
        Uri.parse(baseUrl),
        headers: {
          'Authorization': 'Bearer $authToken',
        },
      );

      final isConnected = response.statusCode == 200;
      print(isConnected ? '✅ Gateway 连接正常' : '❌ Gateway 连接失败');
      return isConnected;

    } catch (e) {
      print('❌ 测试连接失败: $e');
      return false;
    }
  }
}
```

---

### 4. 完整集成示例（React Native）

#### 使用 WebSocket 和 API 的完整示例

```typescript
// src/screens/GatewayScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { GatewayWebSocket } from '../services/websocket';
import { GatewayAPI } from '../services/gateway-api';
import { GATEWAY_CONFIG } from '../config/gateway';

export default function GatewayScreen() {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState(generateDeviceId());

  let websocket: GatewayWebSocket | null = null;

  // 生成设备 ID
  function generateDeviceId() {
    return `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 初始化 WebSocket
  useEffect(() => {
    websocket = new GatewayWebSocket((data) => {
      // 处理收到的消息
      setMessages(prev => [...prev, data]);
    });

    // 连接 WebSocket
    setConnectionStatus('connecting');
    websocket.connect();

    // 清理
    return () => {
      websocket?.disconnect();
    };
  }, []);

  // 测试连接
  const handleTestConnection = async () => {
    try {
      const isConnected = await GatewayAPI.testConnection();
      if (isConnected) {
        alert('✅ Gateway 连接正常！');
      } else {
        alert('❌ Gateway 连接失败');
      }
    } catch (error) {
      alert('❌ 测试连接出错: ' + error);
    }
  };

  // 请求配对
  const handleRequestPairing = async () => {
    try {
      const result = await GatewayAPI.requestPairing({
        device_id: deviceId,
        device_name: 'Test Mobile',
        device_type: 'mobile',
      });

      alert(`✅ 配对请求已发送！\nRequest ID: ${result.request_id}`);

    } catch (error) {
      alert('❌ 配对请求失败: ' + error);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Gateway 连接
      </Text>

      {/* 连接状态 */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, marginBottom: 10 }}>连接状态:</Text>
        {connectionStatus === 'connecting' && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={{ marginLeft: 10 }}>正在连接...</Text>
          </View>
        )}
        {connectionStatus === 'connected' && (
          <Text style={{ color: 'green', fontSize: 16 }}>✅ 已连接</Text>
        )}
        {connectionStatus === 'disconnected' && (
          <Text style={{ color: 'gray', fontSize: 16 }}>❌ 未连接</Text>
        )}
        {connectionStatus === 'error' && (
          <Text style={{ color: 'red', fontSize: 16 }}>❌ 连接错误</Text>
        )}
      </View>

      {/* 设备信息 */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: 'gray' }}>设备 ID: {deviceId}</Text>
        <Text style={{ fontSize: 14, color: 'gray' }}>Gateway: {GATEWAY_CONFIG.URL}</Text>
      </View>

      {/* 操作按钮 */}
      <View style={{ marginBottom: 20 }}>
        <Button title="测试连接" onPress={handleTestConnection} />
        <View style={{ height: 10 }} />
        <Button title="请求配对" onPress={handleRequestPairing} />
      </View>

      {/* 消息列表 */}
      <View>
        <Text style={{ fontSize: 16, marginBottom: 10 }}>收到的消息:</Text>
        {messages.length === 0 && (
          <Text style={{ color: 'gray' }}>暂无消息</Text>
        )}
        {messages.map((msg, index) => (
          <View key={index} style={{ padding: 10, backgroundColor: '#f5f5f5', marginBottom: 5, borderRadius: 5 }}>
            <Text style={{ fontSize: 12 }}>{JSON.stringify(msg)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

---

## 🔍 故障排查

### 常见问题

#### 1. 连接失败：403 Forbidden

**原因：** Origin 验证未通过

**解决方案：**
- 确认 Gateway 的 Origin 验证已支持 `.ngrok-free.dev`
- 检查 ngrok URL 是否正确
- 查看终端日志：`tail -f /tmp/gateway.log`

#### 2. 连接不稳定，频繁断线

**原因：** ngrok 免费版限制

**解决方案：**
- 启用自动重连（已在上面的代码中实现）
- 或者升级到 ngrok 付费版（$9/月）

#### 3. WebSocket 无法连接

**原因：** 端口未开放或防火墙阻止

**解决方案：**
- 检查 Gateway 是否运行：`ps aux | grep openclaw`
- 检查 ngrok 是否运行：`ps aux | grep ngrok`
- 测试本地连接：`curl http://127.0.0.1:18789/`

#### 4. 配对请求失败：511 错误

**原因：** CORS 问题或认证失败

**解决方案：**
- 检查 AUTH_TOKEN 是否正确
- 查看请求头是否包含 `Authorization: Bearer <token>`
- 使用 Chrome 开发者工具查看网络请求

---

## 📊 连接测试清单

### 测试步骤

1. **测试 HTTP 连接**
   ```typescript
   const isConnected = await GatewayAPI.testConnection();
   console.log('HTTP 连接:', isConnected ? '✅' : '❌');
   ```

2. **测试 WebSocket 连接**
   ```typescript
   const ws = new GatewayWebSocket((data) => {
     console.log('收到消息:', data);
   });
   ws.connect();
   ```

3. **测试配对请求**
   ```typescript
   const result = await GatewayAPI.requestPairing({
     device_id: 'test_device_001',
     device_name: 'Test Device',
     device_type: 'mobile',
   });
   console.log('配对结果:', result);
   ```

4. **测试消息收发**
   ```typescript
   ws.send({ type: 'test', message: 'Hello Gateway' });
   ```

---

## 📝 配置参考

### Gateway 配置文件

**位置：** `~/.openclaw/openclaw.json`

**关键配置：**
```json
{
  "gateway": {
    "port": 18789,
    "bind": "lan",
    "auth": {
      "token": "f5a90456ca2531d1d227c95bba997726c5f139bcb5b798d6"
    }
  }
}
```

### ngrok 隧道信息

**公网 URL：** `https://devyn-physicochemical-halina.ngrok-free.dev`

**监控面板：** http://127.0.0.1:4040

**查看隧道状态：**
```bash
curl -s http://127.0.0.1:4040/api/tunnels | jq '.tunnels[0]'
```

---

## 🚀 下一步

1. ✅ 将本指南中的配置和代码集成到你的 app 中
2. ✅ 运行测试，确保连接正常
3. ✅ 实现业务逻辑（配对、消息处理等）
4. ✅ 添加错误处理和日志记录
5. ✅ 考虑生产环境的优化（固定域名、监控等）

---

## 📞 获取帮助

如果遇到问题：

1. **查看日志**
   ```bash
   # Gateway 日志
   tail -f /tmp/gateway.log

   # ngrok 日志
   tail -f /tmp/ngrok.log
   ```

2. **测试连接**
   ```bash
   # 测试 HTTP
   curl https://devyn-physicochemical-halina.ngrok-free.dev/

   # 测试 WebSocket
   wscat -c wss://devyn-physicochemical-halina.ngrok-free.dev
   ```

3. **查看 ngrok 控制台**
   ```bash
   open http://127.0.0.1:4040
   ```

---

## ✅ 总结

**你需要改的：**
1. ✅ 配置文件：将 Gateway URL 改为 ngrok URL
2. ✅ WebSocket：添加自动重连逻辑（推荐）
3. ✅ HTTP API：使用新的 URL 和认证 Token

**不需要改的：**
- ❌ 业务逻辑代码（配对、消息处理等）
- ❌ 数据模型
- ❌ UI 界面

**快速开始：**
复制上面的代码到你的项目中，修改配置文件中的 URL，即可开始使用！🚀
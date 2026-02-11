# TRIX 3D Companion - Clawbot 接入实现方案

> **版本**: v1.0
> **日期**: 2026-02-11
> **作者**: Claude Code Assistant
> **目标**: 通过扫码方式接入 Clawbot，实现稳定的长连接通信，支持文本/语音/图片/文件消息

---

## 目录

1. [架构概述](#架构概述)
2. [前期准备](#前期准备)
3. [核心功能实现](#核心功能实现)
   - [3.1 扫码配对流程](#31-扫码配对流程)
   - [3.2 长连接管理](#32-长连接管理)
   - [3.3 多媒体消息支持](#33-多媒体消息支持)
4. [数据库设计](#数据库设计)
5. [安全考虑](#安全考虑)
6. [实施步骤](#实施步骤)
7. [故障排查](#故障排查)

---

## 架构概述

### 现有架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRIX 3D App (React)                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │  现有模块                                  │   │
│  │ - Supabase Realtime (用户间聊天)        │   │
│  │ - WebSocketContext (Clawbot 单一连接)        │   │
│  │ - 语音识别 (useSpeechToText)          │   │
│  │ - 相机功能 (useCamera)                 │   │
│  └───────────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────────────────┘

                     ▼ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│              Clawbot Gateway (本地/局域网)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WebSocket Server (Port 18789)           │   │
│  │  - 握手认证 (challenge-response)      │   │
│  │  - 流式响应 (delta streaming)        │   │
│  │  - 消息路由 (agent/sessions)    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 目标架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TRIX 3D App (React)                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  扩展模块 (待实现)                                   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ QRCodePairingContext (扫码配对)            │   │   │
│  │  │ - 生成配对请求                       │   │   │
│  │  │ - 显示二维码                         │   │   │
│  │  │ - 轮询配对状态                       │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ EnhancedWebSocketContext (增强型连接)        │   │   │
│  │  │ - 多设备管理 (同一账号多端)           │   │   │
│  │  │ - 断线重连 (指数退避 + 心跳)        │   │   │
│  │  │ - 消息队列 (离线消息缓存)           │   │   │
│  │  │ - 多媒体支持 (图片/文件/语音)         │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ MultimediaService (多媒体处理)           │   │   │
│  │  │ - 文件上传 (Supabase Storage)         │   │   │
│  │  │ - 图片压缩 (前端优化)                   │   │   │
│  │  │ - 语音转文字 (集成现有Hook)           │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                              ▼ WebSocket + Supabase
┌─────────────────────────────────────────────────────────────────────────┐
│              Clawbot Gateway (OpenClaw)                            │
│  - Gateway 配置 (openclaw.json)                          │
│  - 二维码配对 API (webchat pairing)                  │
│  - 多媒体消息处理 (attachments)                         │
│  - 多设备会话管理 (session per device)              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 前期准备

### 1.1 Clawbot Gateway 配置

#### 安装 OpenClaw

```bash
# macOS (推荐)
brew install openclaw

# 或手动下载
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
```

#### 创建配对 Token

在 Gateway 配置文件 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "trix-pairing-token-change-this-to-secure-random-string"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true,
      "pairing": {
        "enabled": true,
        "approvalMode": "auto",  // auto | manual
        "expireMinutes": 60
      }
    }
  }
}
```

#### 启动 Gateway

```bash
# 方式 1: 直接启动
openclaw gateway

# 方式 2: 通过 macOS launchd (推荐后台运行)
openclaw gateway --daemon

# 验证 Gateway 运行
curl http://127.0.0.1:18789/health
# 应返回: {"status":"ok"}
```

### 1.2 环境变量配置

在 `.env` 文件中添加：

```env
# ============================================
# 🤖 Clawbot Gateway 配置
# ============================================

# Gateway WebSocket URL (本地/局域网)
VITE_CLAWBOT_GATEWAY_URL=ws://192.168.1.100:18789

# Gateway 认证 Token (与 Gateway 配置中的 token 一致)
VITE_CLAWBOT_GATEWAY_TOKEN=trix-pairing-token-change-this-to-secure-random-string

# Supabase Storage (用于文件上传)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_STORAGE_PATH=trix-uploads

# 可选：启用调试模式
VITE_CLAWBOT_DEBUG=true
```

### 1.3 安装依赖

```bash
npm install qrcode.react
# 或
yarn add qrcode.react
# 或
pnpm add qrcode.react

# 二维码扫描库
npm install react-qr-reader

# Supabase Storage 客户端 (已安装)
# @supabase/supabase-js 已包含在 package.json 中
```

---

## 核心功能实现

### 3.1 扫码配对流程

#### 3.1.1 创建配对服务类

**文件**: `src/services/clawbotPairingService.ts`

```typescript
interface PairingRequest {
  requestId: string;
  deviceName: string;       // 例如: "TRIX-iPhone"
  deviceType: 'mobile' | 'desktop';
  timestamp: number;
  status: 'pending' | 'approved' | 'expired' | 'denied';
}

interface PairingResponse {
  requestId: string;
  status: 'pending' | 'approved' | 'expired' | 'denied';
  deviceToken?: string;     // 审批后返回的设备专用 token
  message?: string;
}

class ClawbotPairingService {
  private gatewayUrl: string;
  private authToken: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentRequestId: string | null = null;

  constructor() {
    this.gatewayUrl = import.meta.env.VITE_CLAWBOT_GATEWAY_URL || 'ws://localhost:18789';
    this.authToken = import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN || '';
  }

  /**
   * 生成配对请求
   */
  async generatePairingRequest(): Promise<PairingRequest> {
    const requestId = `trix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: PairingRequest = {
      requestId,
      deviceName: `TRIX-${Platform.OS}-${DeviceInfo.getUniqueDeviceId()}`,
      deviceType: Platform.OS === 'ios' ? 'mobile' : 'desktop',
      timestamp: Date.now(),
      status: 'pending'
    };

    // 存储到 Supabase 用于跨设备同步
    await supabase
      .from('pairing_requests')
      .insert([request])
      .select();

    this.currentRequestId = requestId;
    return request;
  }

  /**
   * 获取二维码内容
   */
  getQRCodeContent(request: PairingRequest): string {
    // 方式 1: 直接 WebSocket URL + Token
    return JSON.stringify({
      action: 'pairing_request',
      requestId: request.requestId,
      token: this.authToken,
      device: request.deviceName
    });

    /* 方式 2: 使用 HTTPS Short URL (需要 Gateway 支持)
    const shortUrl = `https://your-domain.com/pair/${request.requestId}`;
    return shortUrl;
    */
  }

  /**
   * 轮询配对状态
   */
  async pollPairingStatus(
    requestId: string,
    onStatusChange: (status: PairingResponse) => void,
    intervalMs: number = 2000
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 180; // 最多轮询 6 分钟 (180秒)

    return new Promise((resolve, reject) => {
      this.pollingInterval = setInterval(async () => {
        attempts++;

        // 从 Supabase 查询状态
        const { data } = await supabase
          .from('pairing_requests')
          .select('*')
          .eq('requestId', requestId)
          .single();

        if (!data) {
          onStatusChange({
            requestId,
            status: 'denied',
            message: '配对请求不存在'
          });
          resolve();
          return;
        }

        const response = data as PairingRequest;

        switch (response.status) {
          case 'approved':
            clearInterval(this.pollingInterval!);
            onStatusChange({
              requestId,
              status: 'approved',
              deviceToken: response.deviceToken
            });
            resolve();
            break;

          case 'denied':
          case 'expired':
            clearInterval(this.pollingInterval!);
            onStatusChange({
              requestId,
              status: response.status,
              message: response.message
            });
            resolve();
            break;

          case 'pending':
            if (attempts >= maxAttempts) {
              clearInterval(this.pollingInterval!);
              onStatusChange({
                requestId,
                status: 'expired',
                message: '配对超时'
              });
              resolve();
            }
            break;
        }
      }, intervalMs);
    });
  }

  /**
   * 通过 WebSocket 审批配对 (Gateway 端)
   */
  async approvePairingViaDirectWS(deviceToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.gatewayUrl);

      ws.onopen = () => {
        // 握手认证
        ws.send(JSON.stringify({
          type: 'req',
          method: 'pairing.approve',
          params: {
            token: this.authToken,
            deviceToken: deviceToken,
            requestId: this.currentRequestId
          }
        }));
      };

      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.type === 'res' && response.payload?.type === 'pairing-success') {
          resolve(true);
          ws.close();
        } else if (response.type === 'error') {
          resolve(false);
          ws.close();
        }
      };

      ws.onerror = () => resolve(false);
      ws.onclose = () => resolve(false);
    });
  }

  /**
   * 取消配对请求
   */
  async cancelPairingRequest(requestId: string): Promise<void> {
    await supabase
      .from('pairing_requests')
      .update({ status: 'cancelled' })
      .eq('requestId', requestId);
  }
}
```

#### 3.1.2 创建配对 Context

**文件**: `src/contexts/QRCodePairingContext.tsx`

```typescript
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ClawbotPairingService } from '../services/clawbotPairingService';

interface PairingState {
  step: 'idle' | 'generating' | 'waiting_approval' | 'approved' | 'error';
  qrCodeData: string | null;
  requestId: string | null;
  deviceToken: string | null;
  error: string | null;
}

interface QRCodePairingContextValue {
  state: PairingState;
  generateQRCode: () => Promise<void>;
  approvePairing: (requestId: string) => Promise<boolean>;
  cancelPairing: () => Promise<void>;
  clearError: () => void;
}

const QRCodePairingContext = createContext<QRCodePairingContextValue | undefined>(undefined);

export const QRCodePairingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PairingState>({
    step: 'idle',
    qrCodeData: null,
    requestId: null,
    deviceToken: null,
    error: null
  });

  const pairingService = useMemo(() => new ClawbotPairingService(), []);

  const generateQRCode = useCallback(async () => {
    setState(prev => ({ ...prev, step: 'generating', error: null }));

    try {
      const request = await pairingService.generatePairingRequest();
      const qrContent = pairingService.getQRCodeContent(request);

      setState(prev => ({
        ...prev,
        step: 'waiting_approval',
        qrCodeData: qrContent,
        requestId: request.requestId
      }));

      // 开始轮询
      await pairingService.pollPairingStatus(
        request.requestId,
        (response) => {
          if (response.status === 'approved') {
            setState(prev => ({
              ...prev,
              step: 'approved',
              deviceToken: response.deviceToken
            }));
            } else if (response.status === 'denied' || response.status === 'expired') {
            setState(prev => ({
              ...prev,
              step: 'error',
              error: response.message || '配对失败'
            }));
          }
        }
      );
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error.message
      }));
    }
  }, [pairingService]);

  const approvePairing = useCallback(async (requestId: string) => {
    setState(prev => ({ ...prev, step: 'generating' }));

    const success = await pairingService.approvePairingViaDirectWS(requestId);

    if (success) {
      setState(prev => ({
        ...prev,
        step: 'approved',
        deviceToken: 'approved'
      }));
    } else {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: '设备配对失败'
      }));
    }
  }, [pairingService]);

  const cancelPairing = useCallback(async () => {
    if (state.requestId) {
      await pairingService.cancelPairingRequest(state.requestId);
    }
    setState({
      step: 'idle',
      qrCodeData: null,
      requestId: null,
      deviceToken: null,
      error: null
    });
  }, [state.requestId, pairingService]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: QRCodePairingContextValue = {
    state,
    generateQRCode,
    approvePairing,
    cancelPairing,
    clearError
  };

  return (
    <QRCodePairingContext.Provider value={value}>
      {children}
    </QRCodePairingContext.Provider>
  );
};

export const useQRCodePairing = () => {
  const context = useContext(QRCodePairingContext);
  if (!context) throw new Error('useQRCodePairing must be used within QRCodePairingProvider');
  return context;
};
```

#### 3.1.3 创建配对 UI 组件

**文件**: `src/screens/QRCodePairing.tsx`

```typescript
import React, { useState } from 'react';
import { QRCodeView } from 'react-native-qr'; // 或使用 qrcode.react
import { useQRCodePairing } from '../contexts/QRCodePairingContext';
import { ActivityIndicator } from 'react-native';

const QRCodePairing: React.FC = () => {
  const { state, generateQRCode, cancelPairing, clearError } = useQRCodePairing();
  const [deviceName] = useState('TRIX-Companion');

  const handleGenerateQR = async () => {
    await generateQRCode();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 标题 */}
      <View style={styles.header}>
        <Text style={styles.title}>Clawbot 配对</Text>
        <Text style={styles.subtitle}>扫描二维码连接到 Clawbot Gateway</Text>
      </View>

      {/* 空状态 */}
      {state.step === 'idle' && (
        <View style={styles.idleContainer}>
          <Text style={styles.deviceName}>{deviceName}</Text>

          <TouchableOpacity style={styles.generateButton} onPress={handleGenerateQR}>
            <Text style={styles.generateButtonText}>生成配对二维码</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 生成中 */}
      {state.step === 'generating' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>正在生成二维码...</Text>
        </View>
      )}

      {/* 等待审批 */}
      {state.step === 'waiting_approval' && state.qrCodeData && (
        <View style={styles.qrContainer}>
          <View style={styles.qrCard}>
            <QRCodeView
              value={state.qrCodeData}
              size={280}
              color="#007AFF"
              backgroundColor="#FFFFFF"
            />

            <View style={styles.qrInfo}>
              <Text style={styles.qrTitle}>扫描二维码</Text>
              <Text style={styles.qrDesc}>
                在 Clawbot Gateway 界面审批此配对请求
              </Text>
              <Text style={styles.requestId}>
                请求 ID: {state.requestId?.slice(-8)}
              </Text>
            </View>

            {/* 取消按钮 */}
            <TouchableOpacity style={styles.cancelButton} onPress={cancelPairing}>
              <Text style={styles.cancelButtonText}>取消配对</Text>
            </TouchableOpacity>
          </View>

          {/* 轮询指示器 */}
          <View style={styles.pollingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.pollingText}>等待审批中...</Text>
          </View>
        </View>
      )}

      {/* 已成功 */}
      {state.step === 'approved' && (
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <CheckCircle size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>配对成功!</Text>
          <Text style={styles.successDesc}>
            设备 {deviceName} 已成功连接到 Clawbot Gateway
          </Text>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>完成</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 错误状态 */}
      {state.step === 'error' && (
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <XCircle size={80} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>配对失败</Text>
          <Text style={styles.errorDesc}>{state.error}</Text>

          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleGenerateQR}
            >
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
  },
  // ... 其他样式定义
});

export default QRCodePairing;
```

### 3.2 长连接管理

#### 3.2.1 增强 WebSocketContext

**文件**: `src/contexts/EnhancedWebSocketContext.tsx`

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

interface ConnectionConfig {
  gatewayUrl: string;
  authToken: string;
  deviceId: string;
  autoReconnect: boolean;
  heartbeatInterval: number; // 心跳间隔（毫秒）
  maxRetries: number;
  retryBackoffMs: number;
}

interface WebSocketMessage {
  type: 'req' | 'res' | 'event' | 'error';
  method?: string;
  params?: any;
  payload?: any;
  id?: string;
  event?: string;
  data?: any;
}

interface MediaAttachment {
  type: 'image' | 'file' | 'audio' | 'video';
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
  thumbnailUri?: string;
}

interface EnhancedConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticating' | 'error';
  lastError?: string;
  lastConnectTime?: number;
  retryCount: number;
  messages: WebSocketMessage[];
  queuedMessages: WebSocketMessage[];
}

type MessageHandler = (message: WebSocketMessage) => void;

interface EnhancedWebSocketContextValue {
  // 连接状态
  status: EnhancedConnectionState['status'];
  isConnected: boolean;

  // 消息操作
  sendMessage: (message: string | WebSocketMessage) => void;
  sendMedia: (media: MediaAttachment) => void;
  sendVoice: (audioBase64: string, duration: number) => void;

  // 连接管理
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // 状态查询
  getConnectionStats: () => {
    uptime: number;
    messagesSent: number;
    messagesReceived: number;
    lastHeartbeat?: number;
  };
}

const EnhancedWebSocketContext = createContext<EnhancedWebSocketContextValue | undefined>(undefined);

export const EnhancedWebSocketProvider: React.FC<{
  children: ReactNode;
  config: ConnectionConfig;
}> = ({ children, config }) => {
  // WebSocket 实例引用
  const wsRef = useRef<WebSocket | null>(null);

  // 心跳定时器
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 重连定时器
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 状态
  const [state, setState] = useState<EnhancedConnectionState>({
    status: 'disconnected',
    retryCount: 0,
    messages: [],
    queuedMessages: []
  });

  // 连接统计
  const statsRef = useRef({
    messagesSent: 0,
    messagesReceived: 0,
    connectTime: 0,
    lastHeartbeat: 0
  });

  /**
   * WebSocket 连接
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('[WebSocket] 已经连接，跳过重复连接');
      return;
    }

    console.log('[WebSocket] 开始连接...', config.gatewayUrl);
    setState(prev => ({
      ...prev,
      status: 'connecting',
      lastConnectTime: Date.now()
    }));

    try {
      const ws = new WebSocket(config.gatewayUrl);
      wsRef.current = ws;

      // 连接超时处理
      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setState(prev => ({
            ...prev,
            status: 'error',
            lastError: '连接超时'
          }));
        }
      }, 10000); // 10秒超时

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log('[WebSocket] 连接成功，开始认证握手...');

        // 发送认证握手
        const nonce = Math.random().toString(36).substr(2, 9);
        ws.send(JSON.stringify({
          type: 'req',
          id: nonce,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            client: {
              id: config.deviceId,
              mode: 'webchat',
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
              displayName: `TRIX-${Platform.OS}-${DeviceInfo.getUniqueDeviceId()}`,
              version: '1.0.0',
              instanceId: config.deviceId
            },
            caps: [],
            auth: {
              token: config.authToken
            }
          }
        }));

        setState(prev => ({ ...prev, status: 'authenticating' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] 收到消息:', message.type, message.method || message.event);

          // 更新统计
          statsRef.current.messagesReceived++;

          // 处理握手挑战
          if (message.event === 'connect.challenge') {
            console.log('[WebSocket] 收到握手挑战，发送响应...');

            const challengeResponse = {
              type: 'req',
              id: message.payload?.nonce || '1',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: 'operator',
                client: {
                  id: config.deviceId,
                  mode: 'webchat',
                  platform: Platform.OS === 'ios' ? 'ios' : 'android',
                  displayName: `TRIX-${Platform.OS}`,
                  version: '1.0.0',
                  instanceId: config.deviceId
                },
                caps: [],
                auth: {
                  token: config.authToken
                }
              }
            };

            ws.send(JSON.stringify(challengeResponse));
            return;
          }

          // 处理握手成功
          if (message.type === 'res' && message.payload?.type === 'hello-ok') {
            console.log('[WebSocket] 认证成功，连接已建立');

            setState(prev => ({
              ...prev,
              status: 'connected',
              retryCount: 0
            }));

            statsRef.current.connectTime = Date.now();

            // 开始心跳
            startHeartbeat(ws);

            // 发送队列中的消息
            if (state.queuedMessages.length > 0) {
              console.log(`[WebSocket] 发送 ${state.queuedMessages.length} 条缓存消息`);
              state.queuedMessages.forEach(msg => {
                ws.send(JSON.stringify(msg));
              });
              setState(prev => ({ ...prev, queuedMessages: [] }));
            }

            return;
          }

          // 处理流式响应
          if (message.payload?.stream === 'assistant' && message.payload.data?.delta) {
            // 增量更新响应
            handleStreamDelta(message.payload.data.delta);
            return;
          }

          // 处理媒体消息
          if (message.event === 'media.uploaded' || message.event === 'media.error') {
            handleMediaEvent(message);
            return;
          }

          // 添加到消息列表
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, message]
          }));

        } catch (error) {
          console.error('[WebSocket] 消息解析错误:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] 错误事件:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          lastError: 'WebSocket 连接错误'
        }));
      };

      ws.onclose = (event) => {
        clearTimeout(connectTimeout);
        stopHeartbeat();

        const wasConnected = state.status === 'connected';
        console.log(`[WebSocket] 连接关闭 (code: ${event.code}, wasConnected: ${wasConnected})`);

        // 自动重连
        if (config.autoReconnect && wasConnected) {
          const retryCount = state.retryCount + 1;
          if (retryCount <= config.maxRetries) {
            console.log(`[WebSocket] 准备重连 (${retryCount}/${config.maxRetries})...`);

            setState(prev => ({
              ...prev,
              status: 'disconnected',
              retryCount
            }));

            // 指数退避重连
            const backoffDelay = Math.min(
              config.retryBackoffMs * Math.pow(2, retryCount - 1),
              30000 // 最大 30 秒
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, backoffDelay);
          } else {
            setState(prev => ({
              ...prev,
              status: 'error',
              lastError: '达到最大重连次数'
            }));
          }
        }
      };

    } catch (error) {
      console.error('[WebSocket] 连接异常:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        lastError: error.message
      }));
    }
  }, [config]);

  /**
   * 心跳机制
   */
  const startHeartbeat = useCallback((ws: WebSocket) => {
    stopHeartbeat();

    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const heartbeatMessage = {
          type: 'req',
          id: `heartbeat-${Date.now()}`,
          method: 'ping',
          params: {
            timestamp: Date.now()
          }
        };

        ws.send(JSON.stringify(heartbeatMessage));
        statsRef.current.lastHeartbeat = Date.now();
      } else {
        console.warn('[WebSocket] 心跳发送失败，连接可能已断开');
        stopHeartbeat();
      }
    }, config.heartbeatInterval);

    console.log(`[WebSocket] 心跳已启动 (间隔: ${config.heartbeatInterval}ms)`);
  }, [config.heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('[WebSocket] 心跳已停止');
    }
  }, []);

  /**
   * 发送文本消息
   */
  const sendMessage = useCallback((message: string | WebSocketMessage) => {
    const messageObj: typeof message === 'string'
      ? {
          type: 'req',
          id: Date.now().toString(),
          method: 'agent',
          params: {
            message: typeof message === 'string' ? message : message.content,
            to: 'self',
            idempotencyKey: Date.now().toString()
          }
        }
      : message;

    if (state.status === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageObj));
      statsRef.current.messagesSent++;
    } else {
      // 未连接时缓存消息
      console.log('[WebSocket] 未连接，消息已加入队列');
      setState(prev => ({
        ...prev,
        queuedMessages: [...prev.queuedMessages, messageObj]
      }));
    }
  }, [state.status, config.deviceId]);

  /**
   * 发送多媒体
   */
  const sendMedia = useCallback(async (media: MediaAttachment) => {
    try {
      // 1. 上传文件到 Supabase Storage
      const fileUrl = await uploadMediaToSupabase(media);

      // 2. 发送媒体消息
      const mediaMessage: WebSocketMessage = {
        type: 'req',
        id: Date.now().toString(),
        method: 'agent',
        params: {
          message: `[媒体] ${media.type}`,
          media: {
            type: media.type,
            uri: fileUrl,
            name: media.name,
            mimeType: media.mimeType,
            size: media.size
          },
          to: 'self'
        }
      };

      sendMessage(mediaMessage);

    } catch (error) {
      console.error('[WebSocket] 发送媒体失败:', error);
      // 可以考虑重试或错误提示
    }
  }, [sendMessage]);

  /**
   * 发送语音
   */
  const sendVoice = useCallback(async (audioBase64: string, duration: number) => {
    const voiceMessage: WebSocketMessage = {
      type: 'req',
      id: Date.now().toString(),
      method: 'agent',
      params: {
        message: '[语音消息]',
        voice: {
          data: audioBase64,
          duration,
          encoding: 'base64'
        },
        to: 'self'
      }
    };

    sendMessage(voiceMessage);
  }, [sendMessage]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    stopHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState({
      status: 'disconnected',
      retryCount: 0,
      messages: [],
      queuedMessages: []
    });

    console.log('[WebSocket] 已断开连接');
  }, []);

  /**
   * 手动重连
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [connect]);

  /**
   * 获取连接统计
   */
  const getConnectionStats = useCallback(() => {
    const uptime = state.status === 'connected' && statsRef.current.connectTime
      ? Date.now() - statsRef.current.connectTime
      : 0;

    return {
      uptime,
      messagesSent: statsRef.current.messagesSent,
      messagesReceived: statsRef.current.messagesReceived,
      lastHeartbeat: statsRef.current.lastHeartbeat
    };
  }, [state.status]);

  const value: EnhancedWebSocketContextValue = {
    status: state.status,
    isConnected: state.status === 'connected',
    sendMessage,
    sendMedia,
    sendVoice,
    connect,
    disconnect,
    reconnect,
    getConnectionStats
  };

  return (
    <EnhancedWebSocketContext.Provider value={value}>
      {children}
    </EnhancedWebSocketContext.Provider>
  );
};

export const useEnhancedWebSocket = (config?: Partial<ConnectionConfig>) => {
  const context = useContext(EnhancedWebSocketContext);
  if (!context) throw new Error('useEnhancedWebSocket must be used within EnhancedWebSocketProvider');

  // 使用默认配置
  const defaultConfig: ConnectionConfig = {
    gatewayUrl: import.meta.env.VITE_CLAWBOT_GATEWAY_URL || 'ws://localhost:18789',
    authToken: import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN || '',
    deviceId: `trix-${Platform.OS}-${DeviceInfo.getUniqueDeviceId()}`,
    autoReconnect: true,
    heartbeatInterval: 30000, // 30秒
    maxRetries: 10,
    retryBackoffMs: 1000 // 初始 1 秒
  };

  return {
    ...context,
    config: config ? { ...defaultConfig, ...config } : defaultConfig
  };
};
```

#### 3.2.2 消息队列管理

**文件**: `src/services/messageQueueService.ts`

```typescript
interface QueuedMessage {
  id: string;
  content: any;
  priority: 'high' | 'normal' | 'low';
  retries: number;
  timestamp: number;
  media?: MediaAttachment;
}

class MessageQueueService {
  private queue: QueuedMessage[] = [];
  private maxQueueSize = 100;
  private processing = false;

  /**
   * 添加消息到队列
   */
  enqueue(message: QueuedMessage): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('[MessageQueue] 队列已满，丢弃最旧消息');
      this.queue.shift();
    }

    this.queue.push(message);
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return true;
  }

  /**
   * 处理队列（连接成功后调用）
   */
  async processQueue(sendFn: (msg: QueuedMessage) => Promise<void>) {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const message = this.queue.shift();

      try {
        await sendFn(message);

        // 重置重试次数
        message.retries = 0;

      } catch (error) {
        console.error(`[MessageQueue] 消息发送失败: ${message.id}`, error);

        // 重试逻辑
        message.retries = (message.retries || 0) + 1;

        if (message.retries < 3) {
          // 重新加入队列
          this.queue.unshift(message);
        } else {
          console.error(`[MessageQueue] 消息 ${message.id} 已放弃（超过最大重试次数）`);
        }
      }
    }
    }

    this.processing = false;
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue = [];
  }
}

export default new MessageQueueService();
```

### 3.3 多媒体消息支持

#### 3.3.1 Supabase Storage 配置

首先，需要在 Supabase 项目中启用 Storage：

1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 进入 Storage 区域
3. 创建 Bucket: `trix-uploads`
4. 配置 Bucket 设置：
   - **Public Bucket**: 取消勾选（安全考虑）
   - **File Size Limit**: 50MB
   - **Allowed MIME Types**: `image/*`, `application/pdf`, `video/*`, `audio/*`
   - **CDN**: 启用 Supabase CDN 加速

#### 3.3.2 文件上传服务

**文件**: `src/services/mediaUploadService.ts`

```typescript
import { supabase } from '../config/supabase';

interface UploadProgress {
  loaded: number;
  total: number;
}

interface UploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
}

class MediaUploadService {
  private bucket = 'trix-uploads';

  /**
   * 上传单个文件
   */
  async uploadFile(
    file: File | Blob,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileExt = (file as File).name.split('.').pop() || 'bin';
    const filePath = `trix/${fileId}.${fileExt}`;

    return new Promise((resolve, reject) => {
      const { data, error } = supabase.storage
        .from(this.bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            if (onProgress) {
              onProgress({
                loaded: progress.transferred || 0,
                total: progress.total || file.size
              });
            }
          }
        });

      if (error) {
        reject(new Error(`上传失败: ${error.message}`));
      } else {
        resolve({
          url: data.publicUrl,
          path: data.path,
          size: file.size,
          contentType: file.type
        });
      }
    });
  }

  /**
   * 上传 Base64 图片
   */
  async uploadBase64Image(
    base64Data: string,
    filename: string = 'photo.jpg'
  ): Promise<UploadResult> {
    // 移除 Base64 头部
    const base64String = base64Data.includes('base64,')
      ? base64Data.split('base64,')[1]
      : base64Data;

    // 转换为 Blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    return this.uploadFile(blob, filename);
  }

  /**
   * 上传语音文件
   */
  async uploadVoiceRecording(
    audioBase64: string,
    duration: number
  ): Promise<UploadResult> {
    const filename = `voice-${Date.now()}.m4a`;

    // 将 Base64 转换为 Blob
    const base64String = audioBase64.includes('base64,')
      ? audioBase64.split('base64,')[1]
      : audioBase64;

    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mp4a' });

    return this.uploadFile(blob, filename);
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw new Error(`删除失败: ${error.message}`);
    }
  }
}

export default new MediaUploadService();
```

#### 3.3.3 创建聊天增强 UI

**文件**: `src/components/EnhancedChatInput.tsx`

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { useEnhancedWebSocket } from '../contexts/EnhancedWebSocketContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useCamera } from '../hooks/useCamera';
import { launchImageLibrary } from 'react-native-image-picker';
import { Feather } from '@expo/vector-icons';
import MediaUploadService from '../services/mediaUploadService';

const EnhancedChatInput: React.FC = () => {
  const { sendMessage, sendMedia } = useEnhancedWebSocket();
  const { startListening, stopListening, transcript, isListening, reset } = useSpeechToText();
  const { capturedPhoto, capture } = useCamera();
  const [inputText, setInputText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const inputRef = useRef<TextInput>(null);

  /**
   * 发送文本消息
   */
  const handleSendText = useCallback(() => {
    if (!inputText.trim()) return;

    sendMessage(inputText.trim());
    setInputText('');
    reset();
  }, [inputText, sendMessage, reset]);

  /**
   * 选择并发送图片
   */
  const handleSelectImage = useCallback(async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        selectionLimit: 1
      });

      if (result.canceled) return;

      const asset = result.assets[0];

      // 压缩图片
      const compressedImage = await ImageManipulator.manipulateAsync(
        asset.uri,
        {
          compress: 0.7, // 压缩到 70%
          format: SaveFormat.JPEG,
          quality: 0.8
        }
      );

      setIsUploading(true);
      setUploadProgress(0);

      // 上传到 Supabase
      const uploadResult = await MediaUploadService.uploadBase64Image(
        compressedImage.base64 || ''
      );

      setUploadProgress(100);

      // 发送媒体消息
      await sendMedia({
        type: 'image',
        uri: uploadResult.url,
        name: asset.fileName,
        mimeType: uploadResult.contentType
      });

      setIsUploading(false);
      setUploadProgress(0);

    } catch (error) {
      console.error('选择图片失败:', error);
      setIsUploading(false);
    }
  }, [sendMedia]);

  /**
   * 拍照并发送
   */
  const handleTakePhoto = useCallback(async () => {
    try {
      const photo = await capture();

      if (!photo) return;

      setIsUploading(true);
      setUploadProgress(0);

      const uploadResult = await MediaUploadService.uploadBase64Image(photo.base64 || '');

      setUploadProgress(100);

      await sendMedia({
        type: 'image',
        uri: uploadResult.url,
        name: `camera-${Date.now()}.jpg`,
        mimeType: uploadResult.contentType
      });

      setIsUploading(false);
      setUploadProgress(0);

    } catch (error) {
      console.error('拍照失败:', error);
      setIsUploading(false);
    }
  }, [capture, sendMedia]);

  /**
   * 开始语音输入
   */
  const handleStartVoice = useCallback(() => {
    startListening();
  }, [startListening]);

  /**
   * 停止语音并发送
   */
  const handleStopVoice = useCallback(async () => {
    stopListening();

    if (transcript) {
      // 发送语音文字
      sendMessage(transcript);
      reset();

      // 如果有音频文件，也可以上传
      // await sendMedia({ type: 'audio', uri: audioUri });
    }
  }, [stopListening, transcript, sendMessage, reset]);

  return (
    <View style={styles.container}>
      {/* 文本输入框 */}
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        placeholder="输入消息..."
        multiline
        maxLength={5000}
        onSubmitEditing={handleSendText}
      />

      {/* 语音输入按钮 */}
      {isListening ? (
        <TouchableOpacity style={styles.voiceButton} onPress={handleStopVoice}>
          <Mic color="#FFFFFF" size={24} />
          <View style={styles.voiceIndicator}>
            <View style={styles.voiceWave} />
            <View style={styles.voiceWave} />
            <View style={styles.voiceWave} />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.voiceButton} onPress={handleStartVoice}>
          <Mic color="#FFFFFF" size={24} />
        </TouchableOpacity>
      )}

      {/* 图片按钮 */}
      <TouchableOpacity
        style={styles.mediaButton}
        onPress={handleSelectImage}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Image color="#FFFFFF" size={24} />
        )}
      </TouchableOpacity>

      {/* 相机按钮 */}
      <TouchableOpacity
        style={styles.mediaButton}
        onPress={handleTakePhoto}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Camera color="#FFFFFF" size={24} />
        )}
      </TouchableOpacity>

      {/* 文件按钮 */}
      <TouchableOpacity
        style={styles.mediaButton}
        onPress={handleSelectFile}
        disabled={isUploading}
      >
        <File color="#FFFFFF" size={24} />
      </TouchableOpacity>

      {/* 发送按钮 */}
      <TouchableOpacity
        style={[styles.sendButton, (!inputText.trim() && styles.sendButtonDisabled)]}
        onPress={handleSendText}
        disabled={!inputText.trim()}
      >
        <Send color="#FFFFFF" size={24} />
      </TouchableOpacity>

      {/* 上传进度条 */}
      {isUploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
        <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 8
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  voiceWave: {
    width: 3,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)'
  },
  mediaButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2
  },
  progressText: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  }
});

export default EnhancedChatInput;
```

---

## 数据库设计

### 配对相关表

```sql
-- 配对请求表
CREATE TABLE IF NOT EXISTS pairing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'mobile' | 'desktop'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled'
  token TEXT, -- 设备配对后生成的 token
  metadata JSONB, -- 额外信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour') -- 1小时过期
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pairing_status ON pairing_requests(status);
CREATE INDEX IF NOT EXISTS idx_pairing_device ON pairing_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_expires ON pairing_requests(expires_at);

-- RLS 策略
ALTER TABLE pairing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pairing requests"
ON pairing_requests FOR SELECT
USING (device_id);

CREATE POLICY "Users can insert pairing requests"
ON pairing_requests FOR INSERT
WITH CHECK (device_id = auth.uid());

CREATE POLICY "Users can update their own pairing requests"
ON pairing_requests FOR UPDATE
USING (device_id)
WITH CHECK (device_id = auth.uid());
```

### 设备管理表

```sql
-- 已配对设备表
CREATE TABLE IF NOT EXISTS paired_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE, -- Clawbot 分配的设备 ID
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' | 'android' | 'web'
  auth_token TEXT NOT NULL, -- 设备专用认证 token
  last_connected_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paired_devices_user ON paired_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_paired_devices_active ON paired_devices(is_active);

-- RLS
ALTER TABLE paired_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their paired devices"
ON paired_devices FOR ALL
USING (user_id);
```

### 消息扩展（支持媒体）

```sql
-- 扩展现有消息表，添加媒体支持
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text', -- 'text' | 'image' | 'file' | 'audio' | 'video'
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_name TEXT,
  ADD COLUMN IF NOT EXISTS media_size INTEGER,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS media_duration INTEGER; -- 音频/视频时长（秒）
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
```

---

## 安全考虑

### 1. 认证安全

- ✅ **Token 轮换**: 定期更新 `VITE_CLAWBOT_GATEWAY_TOKEN`
- ✅ **Token 存储**: 不要在前端硬编码，使用环境变量
- ✅ **HTTPS**: 生产环境必须使用 `wss://`
- ✅ **Token 过期**: 处理 401 错误，提示重新配对

### 2. 数据传输安全

- ✅ **加密**: 敏感数据加密后传输
- ✅ **文件校验**: 上传后验证文件类型和大小
- ✅ **URL 签名**: 验证文件 URL 来源

### 3. 网络安全

- ✅ **CORS**: 正确配置 Gateway CORS 策略
- ✅ **速率限制**: 实现客户端请求频率限制
- ✅ **DDoS 防护**: 使用 ReCAPTCHA 或速率限制

### 4. 数据安全

- ✅ **RLS**: 使用 Row Level Security 保护数据
- ✅ **输入验证**: 所有用户输入必须验证
- ✅ **SQL 注入防护**: 使用参数化查询

---

## 实施步骤

### 阶段 1: 基础设施搭建（1-2 天）

**1.1 Supabase Storage 配置**
- [ ] 登录 Supabase Dashboard
- [ ] 创建 Storage Bucket: `trix-uploads`
- [ ] 配置 Bucket 权限和 CDN
- [ ] 测试文件上传

**1.2 Gateway 配置**
- [ ] 安装 OpenClaw
- [ ] 配置 `~/.openclaw/openclaw.json`
- [ ] 设置 `gateway.auth.token`
- [ ] 启用 `channels.webchat.pairing`
- [ ] 测试 Gateway 运行

**1.3 环境配置**
- [ ] 复制 `.env.example` 到 `.env`
- [ ] 填入实际配置值
- [ ] 验证环境变量加载

### 阶段 2: 核心功能开发（3-5 天）

**2.1 扫码配对**
- [ ] 创建 `ClawbotPairingService` 类
- [ ] 创建 `QRCodePairingContext`
- [ ] 创建 `QRCodePairing` 组件
- [ ] 集成到路由

**2.2 长连接管理**
- [ ] 创建 `EnhancedWebSocketContext`
- [ ] 实现心跳机制
- [ ] 实现断线重连
- [ ] 实现消息队列
- [ ] 替换现用 `WebSocketContext`

**2.3 多媒体支持**
- [ ] 创建 `MediaUploadService`
- [ ] 配置 Supabase Storage
- [ ] 创建 `EnhancedChatInput` 组件
- [ ] 集成现有语音识别
- [ ] 集成现有相机功能

### 阶段 3: 数据库和测试（1-2 天）

**3.1 数据库迁移**
- [ ] 创建配对相关表
- [ ] 创建设备管理表
- [ ] 扩展现有消息表
- [ ] 配置 RLS 策略
- [ ] 运行数据库迁移脚本

**3.2 功能测试**
- [ ] 测试扫码流程
- [ ] 测试长连接稳定性
- [ ] 测试断线重连
- [ ] 测试图片上传
- [ ] 测试文件上传
- [ ] 测试语音输入
- [ ] 测试多端同时在线

### 阶段 4: 优化和部署（2-3 天）

**4.1 性能优化**
- [ ] 图片压缩优化
- [ ] 消息队列优化
- [ ] WebSocket 连接池
- [ ] 数据库查询优化

**4.2 监控和日志**
- [ ] 集成 Sentry 错误监控
- [ ] 添加用户行为分析
- [ ] 实现连接质量监控
- [ ] 配置日志收集

**4.3 生产部署**
- [ ] 配置生产环境变量
- [ ] 启用 HTTPS/WSS
- [ ] 配置 CDN
- [ ] 执行数据库备份
- [ ] 编写部署文档

---

## 故障排查

### 连接问题

**问题**: 无法连接到 Gateway

**排查步骤**:
1. 检查 Gateway 是否运行:
   ```bash
   curl http://127.0.0.1:18789/health
   ```

2. 检查网络连通性:
   ```bash
   ping 192.168.1.100
   ```

3. 检查防火墙规则:
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationHelper/Contents/MacOS/OpenFirewall --list

   # Windows
   netsh advfirewall show allprofiles
   ```

4. 验证 Token 配置:
   ```bash
   echo $VITE_CLAWBOT_GATEWAY_TOKEN
   ```

5. 查看 Gateway 日志:
   ```bash
   tail -f ~/.openclaw/openclaw.log
   ```

**常见错误码**:
- `1006`: Gateway 未启动
- `1002`: 网络不可达
- `401/403`: Token 无效或过期

### 上传问题

**问题**: 文件上传失败

**排查步骤**:
1. 检查 Supabase Storage 配置
2. 验证 Bucket 权限
3. 检查文件大小（限制 50MB）
4. 检查网络连接
5. 查看上传日志

### 配对问题

**问题**: 扫码后无法审批

**排查步骤**:
1. 检查 Gateway 日志
2. 验证配对请求状态
3. 手动审批（如果使用 auto 模式）
4. 检查 Token 是否过期

---

## WebSocket 协议参考

### 连接握手

```json
// 客户端发送
{
  "type": "req",
  "id": "nonce-123",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "client": {
      "id": "trix-ios-abc123",
      "mode": "webchat",
      "platform": "ios",
      "displayName": "TRIX-iPhone",
      "version": "1.0.0",
      "instanceId": "unique-device-id"
    },
    "caps": [],
    "auth": {
      "token": "your-auth-token"
    }
  }
}

// Gateway 响应 - 握战
{
  "event": "connect.challenge",
  "payload": {
    "nonce": "challenge-123"
  }
}

// 客户端响应 - 认证
{
  "type": "req",
  "id": "challenge-123",
  "method": "connect",
  "params": { /* 同上 */ }
}

// Gateway 响应 - 成功
{
  "type": "res",
  "id": "challenge-123",
  "payload": {
    "type": "hello-ok"
  }
}
```

### 消息发送

```json
// 文本消息
{
  "type": "req",
  "id": "msg-123",
  "method": "agent",
  "params": {
    "message": "Hello Clawbot!",
    "to": "self",
    "idempotencyKey": "unique-key-123"
  }
}

// 媒体消息
{
  "type": "req",
  "id": "media-123",
  "method": "agent",
  "params": {
    "message": "[图片]",
    "media": {
      "type": "image",
      "uri": "https://cdn.supabase.com/...",
      "name": "photo.jpg",
      "mimeType": "image/jpeg"
    },
    "to": "self"
  }
}
```

### 流式响应

```json
// 增量数据
{
  "type": "res",
  "id": "msg-123",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "是"
    }
  }
}

// 完整数据
{
  "type": "res",
  "id": "msg-123",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "完整的",
      "finishReason": "stop" // 或 "length" | "error"
    }
  }
}
```

---

## 总结

### 核心优势

1. **扫码配对**: 安全的设备接入方式，无需手动输入 Token
2. **长连接稳定**:
   - 心跳机制保持连接活跃
   - 断线自动重连
   - 指数退避避免服务器压力
   - 消息队列保证不丢失
3. **多媒体支持**:
   - 图片上传（压缩优化）
   - 文件上传（50MB 限制）
   - 语音识别（集成现有 Hook）
   - 相机拍照
4. **数据库集成**:
   - 配对请求持久化
   - 设备管理
   - 消息类型扩展

### 下一步

- [ ] 实现基础版配对（无 UI）
- [ ] 添加配对历史记录
- [ ] 支持设备解绑
- [ ] 实现跨设备消息同步
- [ ] 添加端到端加密（可选）

---

**文档版本**: v1.0
**最后更新**: 2026-02-11
**维护者**: Claude Code Assistant


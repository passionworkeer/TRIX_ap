import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================
// �?最终完美版：智能消息解�?+ 稳定连接
// ============================================

interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  role: string;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
    instanceId: string;
  };
  caps: string[];
  auth?: {
    token: string;
  };
}

interface ConnectRequest {
  type: 'req';
  id: string;
  method: 'connect';
  params: ConnectParams;
}

export type ConnectionStatus = 
  | 'DISCONNECTED' 
  | 'CONNECTING' 
  | 'CONNECTED' 
  | 'AUTH_FAILED' 
  | 'ERROR';

export const usePCConnection = () => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isConnectingRef = useRef(false); 
  
  const WS_URL = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;
  const RECONNECT_INTERVAL = 3000;

  const generateId = () => Math.random().toString(36).substring(7);

  const connect = useCallback(() => {
    if (!WS_URL || !AUTH_TOKEN) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) return;
    if (wsRef.current) wsRef.current.close();

    isConnectingRef.current = true;
    setStatus('CONNECTING');
    console.log(`🔌 启动连接: ${WS_URL}`);
    
    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        isConnectingRef.current = false;
        console.log('�?Socket 已打开，发送认�?..');
        
        const handshakePacket: ConnectRequest = {
          type: 'req',
          id: generateId(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            client: {
              id: 'clawdbot-ios', 
              mode: 'webchat', 
              platform: 'ios', 
              displayName: 'TRIX App', 
              version: '1.0.0',
              instanceId: generateId()
            },
            caps: [],
            auth: { token: AUTH_TOKEN }
          }
        };
        socket.send(JSON.stringify(handshakePacket));
      };

      // 🔥🔥🔥 核心修改区域：智能消息解�?🔥🔥🔥
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 1. 忽略握手和心跳包 (不显示在UI�?
          if (data.type === 'res' && data.payload?.type === 'hello-ok') {
            setStatus('CONNECTED');
            reconnectAttemptsRef.current = 0;
            console.log('🟢 握手成功');
            return;
          }
          if (['tick', 'health', 'heartbeat', 'connect.challenge'].includes(data.event)) return;

          // 2. 忽略请求确认 (你的截图中显示的 status: accepted)
          if (data.payload?.status === 'accepted') return;

          // 3. 忽略生命周期通知 (你的截图中显示的 stream: lifecycle)
          if (data.payload?.stream === 'lifecycle') return;
          
          console.log('📩 收到有效数据:', data);
          
          // 4. 提取真正�?AI 回复文本
          let content = null;
          const p = data.payload;

          if (!p) return;

          // 场景 A: 文本�?(OpenClaw 标准)
          if (p.stream === 'text' && p.data) {
             content = p.data;
          }
          // 场景 B: 直接消息
          else if (p.message) {
             content = p.message;
          }
          // 场景 C: 输出对象
          else if (p.text) {
             content = p.text;
          }
          // 场景 D: 增量更新 (Delta)
          else if (p.delta) {
             content = p.delta;
          }

          // 只有当真正提取到文本时，才更�?UI
          if (content && typeof content === 'string') {
              // 这里做一个简单的处理：如果是流式输出，可能需要累�?
              // 但为�?MVP 简单，我们先直接显示最新的一�?
              setLastMessage(content);
          }

        } catch (e) {}
      };

      socket.onclose = (event) => {
        isConnectingRef.current = false;
        if ([1000, 1001, 1005].includes(event.code)) {
             setStatus('DISCONNECTED');
             return;
        }
        setStatus('DISCONNECTED');
        wsRef.current = null;
        if (reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_INTERVAL);
        }
      };

      socket.onerror = (error) => {
        isConnectingRef.current = false;
        setStatus('ERROR');
      };

    } catch (error) {
      isConnectingRef.current = false;
      setStatus('ERROR');
    }
  }, [WS_URL, AUTH_TOKEN]); 

  // 发送消息保持不�?(记得保留 idempotencyKey)
  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    
    const idempotencyKey = `${Date.now()}-${generateId()}`;
    const pkt = { 
        type: 'req', 
        id: generateId(), 
        method: 'agent', 
        params: { 
            message: text, 
            to: 'self',
            idempotencyKey: idempotencyKey 
        }
    };
    
    console.log('📤 发�?', text);
    wsRef.current.send(JSON.stringify(pkt));
  }, []);

  useEffect(() => {
    connect();
    return () => {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (wsRef.current) wsRef.current.close(1000, 'Unmount');
    };
  }, []);

  return { status, sendMessage, lastMessage, connect, disconnect: () => wsRef.current?.close(), isConnected: status === 'CONNECTED' };
};

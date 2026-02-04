import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

// ============================================
// 🌐 全局 WebSocket Context - 单例长连接
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

interface WebSocketContextValue {
  status: ConnectionStatus;
  fullResponse: string; // 拼接后的完整 AI 回复
  currentStreamId: string | null; // 🔥 新增：当前流式回复的唯一 ID
  sendMessage: (text: string) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [fullResponse, setFullResponse] = useState<string>('');
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null); // 🔥 新增：流 ID
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isConnectingRef = useRef(false);
  const responseBufferRef = useRef<string>(''); // 用于累积流式回复
  
  const WS_URL = import.meta.env.VITE_PC_WEBSOCKET_URL as string;
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;
  const RECONNECT_INTERVAL = 3000;
  const MAX_RECONNECT_ATTEMPTS = 10;

  const generateId = () => Math.random().toString(36).substring(7);

  const connect = useCallback(() => {
    if (!WS_URL || !AUTH_TOKEN) {
      console.error('❌ 缺少 WebSocket URL 或 Token');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
      console.log('⏭️ 已连接或正在连接，跳过');
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    isConnectingRef.current = true;
    setStatus('CONNECTING');
    console.log(`🔌 启动全局连接: ${WS_URL}`);
    
    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        isConnectingRef.current = false;
        console.log('✅ Socket 已打开，发送认证...');
        
        // 🔥 关键配置：硬编码必须使用的参数
        const handshakePacket: ConnectRequest = {
          type: 'req',
          id: generateId(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator', // ✅ 必须
            client: {
              id: 'clawdbot-ios', // ✅ 必须
              mode: 'webchat', // ✅ 必须
              platform: 'ios', // ✅ 必须
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

      // 🔥🔥🔥 核心：智能消息解析，过滤系统噪音 🔥🔥🔥
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // ========== 第一步：过滤系统噪音 ==========
          
          // 1. 握手成功
          if (data.type === 'res' && data.payload?.type === 'hello-ok') {
            setStatus('CONNECTED');
            reconnectAttemptsRef.current = 0;
            console.log('🟢 握手成功，连接已建立');
            return;
          }

          // 2. 过滤心跳和健康检查
          if (['tick', 'health', 'heartbeat', 'connect.challenge'].includes(data.event)) {
            return; // 静默忽略
          }

          // 3. 过滤请求确认 (status: accepted)
          if (data.payload?.status === 'accepted') {
            console.log('✓ 请求已接受');
            return;
          }

          // 4. 过滤生命周期消息 (stream: lifecycle)
          if (data.payload?.stream === 'lifecycle') {
            console.log('♻️ 生命周期事件:', data.payload?.data?.phase);
            return;
          }

          // ========== 第二步：提取有效文本 ==========
          
          const payload = data.payload;
          if (!payload) return;

          let textContent: string | null = null;
          let backendRunId: string | null = null;

          // 尝试提取后端的 runId (如果有)
          if (payload.runId) {
            backendRunId = payload.runId;
          } else if (payload.data?.runId) {
            backendRunId = payload.data.runId;
          }

          // 🎯 场景 1: assistant 流式增量 (Clawdbot v3 标准)
          if (payload.stream === 'assistant' && payload.data?.delta) {
            textContent = payload.data.delta;
            console.log('📝 收到增量:', textContent);
            
            // 🔥 如果是第一条增量，生成新的 streamId
            if (!currentStreamId) {
              const newStreamId = backendRunId || `stream-${Date.now()}-${generateId()}`;
              setCurrentStreamId(newStreamId);
              console.log('🆕 新建流 ID:', newStreamId);
            }
          }
          // 🎯 场景 2: assistant 完整文本
          else if (payload.stream === 'assistant' && payload.data?.text) {
            textContent = payload.data.text;
            console.log('📄 收到完整文本:', textContent);
            
            // 🔥 如果是完整文本，也需要 streamId
            if (!currentStreamId) {
              const newStreamId = backendRunId || `stream-${Date.now()}-${generateId()}`;
              setCurrentStreamId(newStreamId);
              console.log('🆕 新建流 ID:', newStreamId);
            }
          }
          // 🎯 场景 3: 文本流 (通用)
          else if (payload.stream === 'text' && payload.data) {
            textContent = payload.data;
          }
          // 🎯 场景 4: 直接消息字段
          else if (payload.message) {
            textContent = payload.message;
          }
          // 🎯 场景 5: 纯文本字段
          else if (payload.text) {
            textContent = payload.text;
          }

          // ========== 第三步：累积并更新完整回复 ==========
          
          if (textContent && typeof textContent === 'string') {
            // 流式累加
            responseBufferRef.current += textContent;
            setFullResponse(responseBufferRef.current);
          }

          // 检测回复结束信号
          if (payload.data?.done === true || payload.stream === 'done') {
            console.log('✅ 回复完成，总长度:', responseBufferRef.current.length);
            // 🔥 回复结束时，不清空 streamId，让 UI 可以继续关联
            // setCurrentStreamId(null); // 暂时保留，让 UI 完成最后的更新
          }

        } catch (e) {
          console.warn('⚠️ 消息解析失败:', e);
        }
      };

      socket.onclose = (event) => {
        isConnectingRef.current = false;
        console.log(`🔌 连接关闭: code=${event.code}, reason=${event.reason}`);
        
        // 正常关闭
        if ([1000, 1001, 1005].includes(event.code)) {
          setStatus('DISCONNECTED');
          return;
        }

        // 异常断开，尝试重连
        setStatus('DISCONNECTED');
        wsRef.current = null;
        
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 重连中... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_INTERVAL);
        } else {
          console.error('❌ 达到最大重连次数，停止重连');
        }
      };

      socket.onerror = (error) => {
        isConnectingRef.current = false;
        console.error('❌ WebSocket 错误:', error);
        setStatus('ERROR');
      };

    } catch (error) {
      isConnectingRef.current = false;
      console.error('❌ 连接创建失败:', error);
      setStatus('ERROR');
    }
  }, [WS_URL, AUTH_TOKEN]);

  // 发送消息 (必须包含 idempotencyKey)
  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法发送消息');
      return;
    }
    
    // 🔥 关键 1: 生成新的 streamId，准备接收新的回复
    const newStreamId = `stream-${Date.now()}-${generateId()}`;
    setCurrentStreamId(newStreamId);
    console.log('🆕 发送消息，预生成流 ID:', newStreamId);
    
    // 🔥 关键 2: 清空之前的回复缓冲区
    responseBufferRef.current = '';
    setFullResponse('');
    
    // 🔥 关键 3: 必须包含 idempotencyKey，否则会被网关拒绝
    const idempotencyKey = `${Date.now()}-${generateId()}`;
    
    const packet = {
      type: 'req',
      id: generateId(),
      method: 'agent',
      params: {
        message: text,
        to: 'self',
        idempotencyKey: idempotencyKey // ✅ 必须
      }
    };
    
    console.log('📤 发送消息:', text);
    wsRef.current.send(JSON.stringify(packet));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setStatus('DISCONNECTED');
  }, []);

  // 🌐 全局单例：组件挂载时自动连接，卸载时断开
  useEffect(() => {
    console.log('🌐 WebSocket Provider 已挂载，启动全局连接');
    connect();

    return () => {
      console.log('🌐 WebSocket Provider 卸载，关闭连接');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Provider unmount');
      }
    };
  }, [connect]);

  const value: WebSocketContextValue = {
    status,
    fullResponse,
    currentStreamId, // 🔥 导出 streamId
    sendMessage,
    isConnected: status === 'CONNECTED',
    connect,
    disconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// 🪝 自定义 Hook：用于在任何组件中获取 WebSocket 连接
export const useGlobalConnection = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useGlobalConnection 必须在 WebSocketProvider 内部使用');
  }
  return context;
};

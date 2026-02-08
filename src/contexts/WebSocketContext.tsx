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
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isConnectingRef = useRef(false);
  const responseBufferRef = useRef<string>('');
  const challengePendingRef = useRef(false);
  
  // 🎯 直接连接 localhost
  const getWebSocketURL = () => {
    const url = 'ws://localhost:18789';
    console.log('🔌 连接到:', url);
    console.log('   当前页面:', window.location.href);
    return url;
  };
  
  const WS_URL = getWebSocketURL();
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;
  const RECONNECT_INTERVAL = 3000;
  const MAX_RECONNECT_ATTEMPTS = 10;

  const generateId = () => Math.random().toString(36).substring(7);

  const connect = useCallback(() => {
    if (!WS_URL || !AUTH_TOKEN) {
      console.error('❌ 缺少 WebSocket URL 或 Token');
      console.error('   WS_URL:', WS_URL);
      console.error('   AUTH_TOKEN:', AUTH_TOKEN ? '已设置' : '未设置');
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
    console.log(`   页面 URL: ${window.location.href}`);
    console.log(`   Origin: ${window.location.origin}`);
    console.log(`   Protocol: ${window.location.protocol}`);
    
    // 重置状态
    challengePendingRef.current = false;
    responseBufferRef.current = '';
    setFullResponse('');
    setCurrentStreamId(null);
    
    try {
      console.log('🔧 创建 WebSocket 实例...');
      const socket = new WebSocket(WS_URL);
      console.log('✅ WebSocket 实例创建成功');
      console.log('   readyState:', socket.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)');
      wsRef.current = socket;

      socket.onopen = () => {
        isConnectingRef.current = false;
        console.log('✅ WebSocket 连接已建立，等待 challenge...');
        // 不要在这里发送任何消息，等待网关的 challenge
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          console.log('📨 收到消息:', JSON.stringify(data, null, 2));
          
          // ========== 第一步：处理连接和认证 ==========
          
          // 1. 处理 connect.challenge
          if (data.event === 'connect.challenge') {
            console.log('🎯 收到 challenge');
            console.log('   Nonce:', data.payload?.nonce);
            console.log('   Timestamp:', data.payload?.ts);
            
            challengePendingRef.current = true;
            
            // 提取 nonce 作为响应的 ID
            const challengeId = data.payload?.nonce || data.id || generateId();
            
            // 响应 challenge - 必须使用 nonce 作为 id
            const challengeResponse: ConnectRequest = {
              type: 'req',
              id: challengeId,
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
            
            console.log('📤 发送 challenge 响应:', JSON.stringify(challengeResponse, null, 2));
            socket.send(JSON.stringify(challengeResponse));
            return;
          }

          // 2. 处理握手成功 (hello-ok)
          if (data.type === 'res' && data.payload?.type === 'hello-ok') {
            setStatus('CONNECTED');
            reconnectAttemptsRef.current = 0;
            challengePendingRef.current = false;
            console.log('🟢 握手成功，连接已建立');
            return;
          }

          // 3. 处理认证失败
          if (data.type === 'res' && !data.ok && data.error) {
            console.error('❌ 认证失败:');
            console.error('   错误码:', data.error.code);
            console.error('   错误信息:', data.error.message);
            setStatus('AUTH_FAILED');
            challengePendingRef.current = false;
            return;
          }

          // ========== 第二步：过滤系统消息 ==========
          
          // 4. 过滤心跳和健康检查
          if (['tick', 'health', 'heartbeat'].includes(data.event)) {
            return; // 静默忽略
          }

          // 5. 过滤请求确认 (status: accepted)
          if (data.payload?.status === 'accepted') {
            console.log('✓ 请求已接受');
            return;
          }

          // 6. 过滤生命周期消息 (stream: lifecycle)
          if (data.payload?.stream === 'lifecycle') {
            console.log('♻️ 生命周期事件:', data.payload?.data?.phase);
            return;
          }

          // ========== 第三步：处理 AI 回复 ==========
          
          const payload = data.payload;
          if (!payload) return;

          let textContent: string | null = null;
          let backendRunId: string | null = null;
          let isDone = false;

          // 尝试提取后端的 runId
          if (payload.runId) {
            backendRunId = payload.runId;
          } else if (payload.data?.runId) {
            backendRunId = payload.data.runId;
          }
          
          // 检测是否完成
          if (payload.data?.done === true || payload.stream === 'done') {
            isDone = true;
          }

          // 场景 1: assistant 流式增量 (delta)
          if (payload.stream === 'assistant' && payload.data?.delta) {
            textContent = payload.data.delta;
            console.log('📝 增量回复 (delta):', textContent);
            
            if (!currentStreamId) {
              const newStreamId = backendRunId || `stream-${Date.now()}-${generateId()}`;
              setCurrentStreamId(newStreamId);
              console.log('🆕 新建流 ID:', newStreamId);
            }
          }
          // 场景 2: assistant 完整文本 (text)
          else if (payload.stream === 'assistant' && payload.data?.text) {
            textContent = payload.data.text;
            console.log('📄 完整回复 (text):', textContent);
            
            if (!currentStreamId) {
              const newStreamId = backendRunId || `stream-${Date.now()}-${generateId()}`;
              setCurrentStreamId(newStreamId);
              console.log('🆕 新建流 ID:', newStreamId);
            }
          }
          // 场景 3: 文本流 (stream: text)
          else if (payload.stream === 'text' && payload.data) {
            textContent = payload.data;
            console.log('📝 文本流:', textContent);
          }
          // 场景 4: 直接消息字段
          else if (payload.message) {
            textContent = payload.message;
            console.log('💬 直接消息:', textContent);
          }
          // 场景 5: 纯文本字段
          else if (payload.text) {
            textContent = payload.text;
            console.log('📝 纯文本:', textContent);
          }

          // 累积并更新完整回复
          if (textContent && typeof textContent === 'string') {
            responseBufferRef.current += textContent;
            setFullResponse(responseBufferRef.current);
          }

          // 检测回复结束信号
          if (isDone) {
            console.log('✅ 回复完成');
            console.log('   总长度:', responseBufferRef.current.length);
            console.log('   完整内容:', responseBufferRef.current);
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
        console.error('   readyState:', socket.readyState);
        console.error('   URL:', socket.url);
        console.error('   当前页面:', window.location.href);
        console.error('   错误时间:', new Date().toISOString());
        
        // 检查是否是浏览器安全策略阻止
        if (socket.readyState === WebSocket.CLOSED) {
          console.error('⚠️ 连接在打开前就关闭了,可能原因:');
          console.error('   1. 网络不可达');
          console.error('   2. 服务器拒绝连接');
          console.error('   3. 浏览器安全策略阻止');
          console.error('   4. 防火墙或代理拦截');
        }
        setStatus('ERROR');
      };

    } catch (error) {
      isConnectingRef.current = false;
      console.error('❌ 连接创建失败:', error);
      setStatus('ERROR');
    }
  }, [WS_URL, AUTH_TOKEN]);

  // 发送消息函数 - 符合 Clawdbot 协议
  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法发送消息');
      console.warn('   当前状态:', status);
      return;
    }
    
    if (status !== 'CONNECTED') {
      console.warn('⚠️ 未完成认证，无法发送消息');
      return;
    }
    
    // 生成新的 streamId (预期后端会返回这个流)
    const newStreamId = `stream-${Date.now()}-${generateId()}`;
    setCurrentStreamId(newStreamId);
    console.log('🆕 发送消息，预生成流 ID:', newStreamId);
    
    // 清空之前的回复缓冲区
    responseBufferRef.current = '';
    setFullResponse('');
    
    // 生成唯一的消息 ID 和 idempotencyKey
    const messageId = `msg-${Date.now()}-${generateId()}`;
    const idempotencyKey = `${Date.now()}-${generateId()}`;
    
    const packet = {
      type: 'req',
      id: messageId,
      method: 'agent',
      params: {
        message: text,
        to: 'self',
        idempotencyKey: idempotencyKey
      }
    };
    
    console.log('📤 发送消息:');
    console.log('   内容:', text);
    console.log('   消息 ID:', messageId);
    console.log('   完整数据包:', JSON.stringify(packet, null, 2));
    
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

  // 全局单例：组件挂载时自动连接，卸载时断开
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
    currentStreamId,
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

// 自定义 Hook：用于在任何组件中获取 WebSocket 连接
export const useGlobalConnection = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useGlobalConnection 必须在 WebSocketProvider 内部使用');
  }
  return context;
};
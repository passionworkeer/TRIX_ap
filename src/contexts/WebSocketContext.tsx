import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from "react";
import {
  ConnectionStatus,
  ConnectRequest,
  ConnectParams,
  WebSocketMessage,
  WebSocketResponse,
  ConnectChallenge,
  MediaInfo,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
  HEARTBEAT_INTERVAL_MS,
} from "../types/clawbot";

/**
 * WebSocket Context
 *
 * 基于 Clawdbot Gateway 集成指南 v1.0.0
 * 提供与 Clawbot Gateway 的 WebSocket 连接管理
 */

interface WebSocketContextValue {
  /** 连接状态 */
  status: ConnectionStatus;
  /** Bot 完整回复内容（流式） */
  fullResponse: string;
  /** 当前流 ID */
  currentStreamId: string | null;
  /** 是否已连接 */
  isConnected: boolean;
  /** 连接 */
  connect: () => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 发送消息 */
  sendMessage: (text: string, media?: MediaInfo) => void;
  /** 最后错误信息 */
  lastError: string | null;
  /** 重连次数 */
  reconnectCount: number;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

/**
 * WebSocket Provider
 */
export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [fullResponse, setFullResponse] = useState<string>("");
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const responseBufferRef = useRef("");
  const currentStreamIdRef = useRef<string | null>(null);

  // 从环境变量读取配置
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const WS_URL = isMobile
    ? import.meta.env.VITE_PC_WEBSOCKET_URL_MOBILE
    : import.meta.env.VITE_PC_WEBSOCKET_URL || "ws://localhost:18789";
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;

  /**
   * 发送心跳包
   */
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    }
  }, []);

  /**
   * 启动心跳定时器
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat]);

  /**
   * 停止心跳定时器
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * 处理连接挑战
   */
  const handleConnectChallenge = useCallback((socket: WebSocket, data: ConnectChallenge) => {
    const clientInfo: ConnectParams["client"] = {
      id: "clawdbot-ios",
      mode: "webchat",
      platform: isMobile ? "ios" : "web",
      displayName: "TRIX App",
      version: "1.0.0",
      instanceId: Math.random().toString(36),
    };

    const challengeResponse: ConnectRequest = {
      type: "req",
      id: data.payload?.nonce || "1",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: "operator",
        client: clientInfo,
        caps: [],
        auth: { token: AUTH_TOKEN },
      },
    };

    socket.send(JSON.stringify(challengeResponse));
  }, [AUTH_TOKEN, isMobile]);

  /**
   * 处理流式响应
   */
  const handleStreamResponse = useCallback((data: WebSocketResponse) => {
    if (data.payload?.stream === "assistant" && data.payload.data?.delta) {
      responseBufferRef.current += data.payload.data.delta;
      setFullResponse(responseBufferRef.current);

      // 更新流 ID
      if (!currentStreamIdRef.current) {
        const newStreamId = `stream-${Date.now()}`;
        currentStreamIdRef.current = newStreamId;
        setCurrentStreamId(newStreamId);
      }
    }

    // 流结束
    if (data.payload.data?.done) {
      currentStreamIdRef.current = null;
      setCurrentStreamId(null);
    }
  }, []);

  /**
   * 建立 WebSocket 连接
   * 使用 localStorage 中保存的配对信息（用户输入的或之前配对成功的）
   */
  const connect = useCallback(() => {
    // 从 localStorage 获取配对信息（优先于环境变量）
    const savedGatewayUrl = localStorage.getItem('clawbot_gateway_url');
    const savedDeviceToken = localStorage.getItem('clawbot_device_token');

    // 使用保存的 URL 或回退到环境变量
    let wsUrl = savedGatewayUrl || WS_URL;
    // 使用保存的 deviceToken 或回退到环境变量的 auth token
    const authToken = savedDeviceToken || AUTH_TOKEN;

    if (!wsUrl || !authToken || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] 连接条件不满足，跳过", {
        hasUrl: !!wsUrl,
        hasToken: !!authToken,
        isConnecting: isConnectingRef.current,
        wsState: wsRef.current?.readyState,
      });
      return;
    }

    isConnectingRef.current = true;
    setStatus("CONNECTING");
    setLastError(null);

    try {
      console.log("[WebSocket] 正在连接...", wsUrl);

      // 构建带认证的 WebSocket URL
      const urlWithToken = authToken
        ? `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}auth_token=${authToken}`
        : wsUrl;

      const socket = new WebSocket(urlWithToken);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("[WebSocket] 连接已打开");
        isConnectingRef.current = false;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;

          // 处理连接挑战 - 使用类型守卫检查
          if ('event' in data && data.event === "connect.challenge") {
            handleConnectChallenge(socket, data as ConnectChallenge);
          }
          // 处理连接成功
          else if ('type' in data && data.type === "res" && 'payload' in data && data.payload?.type === "hello-ok") {
            setStatus("CONNECTED");
            reconnectAttemptsRef.current = 0;
            setReconnectCount(0);
            startHeartbeat();
            console.log("[WebSocket] ✅ 连接成功");
          }
          // 处理流式响应
          else if ('type' in data && data.type === "res" && 'payload' in data && data.payload?.stream) {
            handleStreamResponse(data as WebSocketResponse);
          }
          // 处理心跳响应
          else if ('type' in data && data.type === "pong") {
            // 心跳正常，无需处理
          }
          // 处理错误
          else if ('type' in data && data.type === "error") {
            setLastError('message' in data ? data.message || "未知错误" : "未知错误");
            setStatus("ERROR");
          }
        } catch (e) {
          console.error("[WebSocket] 消息解析失败:", e);
        }
      };

      socket.onclose = (event) => {
        console.log("[WebSocket] 连接关闭:", event.code, event.reason);
        isConnectingRef.current = false;
        stopHeartbeat();
        setStatus("DISCONNECTED");

        // 检查是否有保存的配对凭证，只有已配对设备才自动重连
        const savedDeviceToken = localStorage.getItem('clawbot_device_token');
        const savedGatewayUrl = localStorage.getItem('clawbot_gateway_url');

        if (!savedDeviceToken || !savedGatewayUrl) {
          console.log("[WebSocket] 未找到配对凭证，停止重连");
          return;
        }

        // 自动重连（仅对已配对设备）- 使用指数退避
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;

          // 计算指数退避延迟
          const delay = Math.min(
            RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, reconnectAttemptsRef.current - 1),
            RECONNECT_MAX_DELAY_MS
          );

          setReconnectCount(reconnectAttemptsRef.current);
          console.log(`[WebSocket] ${delay / 1000}秒后重连 (第${reconnectAttemptsRef.current}次)`);
          setStatus("RECONNECTING");

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("[WebSocket] 重连次数已达上限");
          setLastError("连接失败，请检查网络后重试");
        }
      };

      socket.onerror = (error) => {
        console.error("[WebSocket] 连接错误:", error);
        isConnectingRef.current = false;
        setStatus("ERROR");
        setLastError("连接错误");
      };
    } catch (e) {
      console.error("[WebSocket] 连接异常:", e);
      setStatus("ERROR");
      setLastError("连接异常");
      isConnectingRef.current = false;
    }
  }, [WS_URL, AUTH_TOKEN, handleConnectChallenge, handleStreamResponse, startHeartbeat, stopHeartbeat]);

  /**
   * 断开 WebSocket 连接
   */
  const disconnect = useCallback(() => {
    console.log("[WebSocket] 断开连接");

    // 清除重连定时器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 停止心跳
    stopHeartbeat();

    // 重置重连计数
    reconnectAttemptsRef.current = 0;
    setReconnectCount(0);

    // 关闭连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("DISCONNECTED");
  }, [stopHeartbeat]);

  /**
   * 发送消息
   */
  const sendMessage = useCallback((text: string, media?: MediaInfo) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] 未连接，无法发送消息");
      setLastError("未连接到 Gateway");
      return;
    }

    // 重置响应缓冲区
    responseBufferRef.current = "";
    setFullResponse("");
    currentStreamIdRef.current = null;
    setCurrentStreamId(null);

    const messagePayload: any = {
      type: "req",
      id: Date.now().toString(),
      method: "agent",
      params: {
        message: text,
        to: "self",
        idempotencyKey: Date.now().toString(),
      },
    };

    // 添加媒体信息（如果有）
    if (media) {
      messagePayload.params.media = {
        uri: media.uri,
        type: media.type,
        size: media.size,
        metadata: media.metadata,
      };
    }

    wsRef.current.send(JSON.stringify(messagePayload));
    console.log("[WebSocket] 消息已发送:", text.substring(0, 50) + "...");
  }, []);

  /**
   * 尝试自动恢复连接
   * 如果之前已成功配对，退出后重新打开 App 会自动连接
   */
  useEffect(() => {
    const deviceToken = localStorage.getItem('clawbot_device_token');
    const gatewayUrl = localStorage.getItem('clawbot_gateway_url');

    if (deviceToken && gatewayUrl) {
      console.log('[WebSocket] 发现已保存的配对信息，自动恢复连接...');
      // 延迟 1 秒再连接，避免页面加载时立即连接
      const timer = setTimeout(() => {
        connect();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      console.log('[WebSocket] 未找到配对信息，等待用户手动配对');
    }

    return () => disconnect();
  }, []);

  const value: WebSocketContextValue = useMemo(() => ({
    status,
    fullResponse,
    currentStreamId,
    isConnected: status === "CONNECTED",
    connect,
    disconnect,
    sendMessage,
    lastError,
    reconnectCount,
  }), [status, fullResponse, currentStreamId, lastError, reconnectCount, connect, disconnect, sendMessage]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook: 使用全局 WebSocket 连接
 */
export const useGlobalConnection = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useGlobalConnection must be used within WebSocketProvider");
  }
  return context;
};

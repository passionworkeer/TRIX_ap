import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import {
  ConnectionStatus,
  ConnectRequest,
  ConnectParams,
  WebSocketMessage,
  WebSocketResponse,
  ConnectChallenge,
  MediaInfo,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_DELAY_MS,
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
   */
  const connect = useCallback(() => {
    if (!WS_URL || !AUTH_TOKEN || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] 连接条件不满足，跳过", {
        hasUrl: !!WS_URL,
        hasToken: !!AUTH_TOKEN,
        isConnecting: isConnectingRef.current,
        wsState: wsRef.current?.readyState,
      });
      return;
    }

    isConnectingRef.current = true;
    setStatus("CONNECTING");
    setLastError(null);

    try {
      console.log("[WebSocket] 正在连接...", WS_URL);
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("[WebSocket] 连接已打开");
        isConnectingRef.current = false;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;

          // 处理连接挑战
          if (data.event === "connect.challenge") {
            handleConnectChallenge(socket, data as ConnectChallenge);
          }
          // 处理连接成功
          else if (data.type === "res" && data.payload?.type === "hello-ok") {
            setStatus("CONNECTED");
            reconnectAttemptsRef.current = 0;
            setReconnectCount(0);
            startHeartbeat();
            console.log("[WebSocket] ✅ 连接成功");
          }
          // 处理流式响应
          else if (data.type === "res" && data.payload?.stream) {
            handleStreamResponse(data as WebSocketResponse);
          }
          // 处理心跳响应
          else if (data.type === "pong") {
            // 心跳正常，无需处理
          }
          // 处理错误
          else if (data.type === "error") {
            setLastError(data.message || "未知错误");
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

        // 自动重连
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          setReconnectCount(reconnectAttemptsRef.current);
          console.log(`[WebSocket] ${RECONNECT_DELAY_MS / 1000}秒后重连 (第${reconnectAttemptsRef.current}次)`);
          setStatus("RECONNECTING");

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY_MS);
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
   * 组件挂载时自动连接
   */
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const value: WebSocketContextValue = {
    status,
    fullResponse,
    currentStreamId,
    isConnected: status === "CONNECTED",
    connect,
    disconnect,
    sendMessage,
    lastError,
    reconnectCount,
  };

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

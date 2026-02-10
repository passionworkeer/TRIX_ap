import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";

interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  role: string;
  client: { id: string; displayName: string; version: string; platform: string; mode: string; instanceId: string; };
  caps: string[];
  auth?: { token: string; };
}

interface ConnectRequest {
  type: "req";
  id: string;
  method: "connect";
  params: ConnectParams;
}

export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "AUTH_FAILED" | "ERROR";

interface WebSocketContextValue {
  status: ConnectionStatus;
  fullResponse: string;
  currentStreamId: string | null;
  sendMessage: (text: string) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [fullResponse, setFullResponse] = useState<string>("");
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const responseBufferRef = useRef("");

  // 修改为从环境变量读取，适配移动端和开发环境
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const WS_URL = isMobile 
    ? import.meta.env.VITE_PC_WEBSOCKET_URL_MOBILE 
    : import.meta.env.VITE_PC_WEBSOCKET_URL || "ws://localhost:18789";
  
  const AUTH_TOKEN = import.meta.env.VITE_PC_AUTH_TOKEN as string;

  const connect = useCallback(() => {
    if (!WS_URL || !AUTH_TOKEN || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;
    setStatus("CONNECTING");
    
    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => { isConnectingRef.current = false; };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "connect.challenge") {
            const challengeResponse: ConnectRequest = {
              type: "req",
              id: data.payload?.nonce || "1",
              method: "connect",
              params: {
                minProtocol: 3, maxProtocol: 3, role: "operator",
                client: { id: "clawdbot-ios", mode: "webchat", platform: "ios", displayName: "TRIX App", version: "1.0.0", instanceId: Math.random().toString(36) },
                caps: [], auth: { token: AUTH_TOKEN }
              }
            };
            socket.send(JSON.stringify(challengeResponse));
          } else if (data.type === "res" && data.payload?.type === "hello-ok") {
            setStatus("CONNECTED");
            reconnectAttemptsRef.current = 0;
          } else if (data.payload?.stream === "assistant" && data.payload.data?.delta) {
            responseBufferRef.current += data.payload.data.delta;
            setFullResponse(responseBufferRef.current);
          }
        } catch (e) {}
      };
      socket.onclose = () => {
        isConnectingRef.current = false;
        setStatus("DISCONNECTED");
        if (reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
      socket.onerror = () => { setStatus("ERROR"); };
    } catch (e) { setStatus("ERROR"); isConnectingRef.current = false; }
  }, [WS_URL, AUTH_TOKEN]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    responseBufferRef.current = "";
    setFullResponse("");
    wsRef.current.send(JSON.stringify({
      type: "req", id: Date.now().toString(), method: "agent",
      params: { message: text, to: "self", idempotencyKey: Date.now().toString() }
    }));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    setStatus("DISCONNECTED");
  }, []);

  useEffect(() => { connect(); return () => disconnect(); }, [connect, disconnect]);

  return <WebSocketContext.Provider value={{ status, fullResponse, currentStreamId, sendMessage, isConnected: status === "CONNECTED", connect, disconnect }}>{children}</WebSocketContext.Provider>;
};

export const useGlobalConnection = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error("useGlobalConnection must be used within WebSocketProvider");
  return context;
};

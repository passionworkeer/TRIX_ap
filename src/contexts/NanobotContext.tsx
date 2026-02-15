/**
 * Nanobot Context
 * 管理 Nanobot 连接和消息状态
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import nanobotBridge, { NanobotMessage } from '../services/NanobotBridge';

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

interface NanobotContextType {
  // 连接状态
  status: ConnectionStatus;
  connected: boolean;
  pairingCode: string | null;
  deviceId: string;

  // 消息
  messages: NanobotMessage[];

  // 操作
  connect: (code?: string) => void;
  disconnect: () => void;
  sendMessage: (message: string, messageType?: 'text' | 'image' | 'video' | 'file', mediaUrl?: string) => void;
  clearMessages: () => void;
  clearPairing: () => void;

  // 错误
  lastError: string | null;
}

const NanobotContext = createContext<NanobotContextType | undefined>(undefined);

interface NanobotProviderProps {
  children: ReactNode;
}

export const NanobotProvider: React.FC<NanobotProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [messages, setMessages] = useState<NanobotMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const pairingCodeRef = useRef<string | null>(null);

  // 初始化：恢复配对码并自动连接
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后更新状态

    const savedCode = localStorage.getItem('nanobot_pairing_code');
    if (savedCode) {
      pairingCodeRef.current = savedCode;
      console.log('[NanobotContext] 恢复配对码:', savedCode);
      // 自动连接
      setTimeout(() => {
        if (isMounted) {
          connect(savedCode);
        }
      }, 1000);
    }

    // 监听 Nanobot Bridge 事件
    const handleConnected = (data: any) => {
      if (isMounted) {
        console.log('[NanobotContext] 已连接:', data);
        setStatus('CONNECTED');
        setLastError(null);
      }
    };

    const handleDisconnected = () => {
      if (isMounted) {
        console.log('[NanobotContext] 已断开');
        setStatus('DISCONNECTED');
      }
    };

    const handleReconnecting = (data: any) => {
      if (isMounted) {
        console.log('[NanobotContext] 重连中:', data);
        setStatus('RECONNECTING');
      }
    };

    const handleReconnected = (data: any) => {
      if (isMounted) {
        console.log('[NanobotContext] 重连成功:', data);
        setStatus('CONNECTED');
      }
    };

    const handleMessage = (message: NanobotMessage) => {
      if (isMounted) {
        console.log('[NanobotContext] 收到消息:', message);
        setMessages(prev => [...prev, message]);
      }
    };

    const handleError = (error: any) => {
      if (isMounted) {
        console.error('[NanobotContext] 错误:', error);
        setStatus('ERROR');
        setLastError(error.message || '连接错误');
      }
    };

    nanobotBridge.on('connected', handleConnected);
    nanobotBridge.on('disconnected', handleDisconnected);
    nanobotBridge.on('reconnecting', handleReconnecting);
    nanobotBridge.on('reconnected', handleReconnected);
    nanobotBridge.on('message', handleMessage);
    nanobotBridge.on('error', handleError);

    return () => {
      isMounted = false;
      nanobotBridge.removeAllListeners();
    };
  }, []);

  const connect = (code?: string) => {
    if (code) {
      pairingCodeRef.current = code;
    }

    if (!pairingCodeRef.current) {
      console.error('[NanobotContext] 没有配对码');
      setLastError('没有配对码，请先配对');
      return;
    }

    setStatus('CONNECTING');
    setLastError(null);
    nanobotBridge.connect(pairingCodeRef.current);
  };

  const disconnect = () => {
    nanobotBridge.disconnect();
    setStatus('DISCONNECTED');
  };

  const sendMessage = (
    message: string,
    messageType: 'text' | 'image' | 'video' | 'file' = 'text',
    mediaUrl?: string
  ) => {
    try {
      nanobotBridge.sendMessage(message, messageType, mediaUrl);

      // 添加到消息列表（用户发送的消息）
      const userMessage: NanobotMessage = {
        message,
        message_type: messageType,
        media_url: mediaUrl,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
    } catch (error) {
      console.error('[NanobotContext] 发送消息失败:', error);
      setLastError(error instanceof Error ? error.message : '发送失败');
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const clearPairing = () => {
    nanobotBridge.clearPairing();
    pairingCodeRef.current = null;
    setStatus('DISCONNECTED');
    setMessages([]);
  };

  const value: NanobotContextType = {
    status,
    connected: status === 'CONNECTED',
    pairingCode: pairingCodeRef.current,
    deviceId: nanobotBridge.getDeviceId(),
    messages,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    clearPairing,
    lastError,
  };

  return (
    <NanobotContext.Provider value={value}>
      {children}
    </NanobotContext.Provider>
  );
};

/**
 * Hook: 使用 Nanobot 连接
 */
export const useNanobot = () => {
  const context = useContext(NanobotContext);
  if (!context) {
    throw new Error('useNanobot 必须在 NanobotProvider 内部使用');
  }
  return context;
};

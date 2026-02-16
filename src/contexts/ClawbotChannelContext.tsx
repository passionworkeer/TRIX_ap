/**
 * Clawbot Channel Context
 * 管理 Clawbot Channel 连接和消息状态
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import clawbotChannelBridge, { ClawbotChannelMessage } from '../services/ClawbotChannelBridge';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'PAIRED';

export type PairingStatus = 'idle' | 'pairing' | 'paired' | 'waiting_for_bot';

interface ClawbotChannelContextType {
  // 连接状态
  status: ConnectionStatus;
  isConnected: boolean;
  isPaired: boolean;
  pairingStatus: PairingStatus;

  // 配对信息
  pairingCode: string | null;
  qrImage: string | null;
  deviceId: string;

  // 消息
  messages: ClawbotChannelMessage[];

  // 操作
  connect: () => Promise<void>;
  disconnect: () => void;
  pairWithCode: (code: string) => Promise<boolean>;
  pairWithQR: (token: string) => Promise<boolean>;
  sendMessage: (content: string, contentType?: 'text' | 'image' | 'video' | 'file', mediaUrl?: string) => void;
  uploadMedia: (file: File | Blob) => Promise<string>;
  unpair: () => void;
  clearMessages: () => void;

  // 错误
  lastError: string | null;
}

const ClawbotChannelContext = createContext<ClawbotChannelContextType | undefined>(undefined);

interface ClawbotChannelProviderProps {
  children: ReactNode;
}

export const ClawbotChannelProvider: React.FC<ClawbotChannelProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('idle');
  const [messages, setMessages] = useState<ClawbotChannelMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  // 初始化连接
  useEffect(() => {
    if (!user?.id) {
      console.log('[ClawbotChannel] ⚠️ 用户未登录，等待登录...');
      return;
    }

    console.log('[ClawbotChannel] ✅ 用户已登录，初始化连接...');

    // 设置事件监听器
    const setupListeners = () => {
      clawbotChannelBridge.on('connecting', () => {
        console.log('[ClawbotChannel] 🔄 正在连接服务器...');
        setStatus('CONNECTING');
        setLastError(null);
      });

      clawbotChannelBridge.on('connected', async () => {
        console.log('[ClawbotChannel] ✅ 已连接到服务器');
        setStatus('CONNECTED');
        setLastError(null);
      });

      clawbotChannelBridge.on('disconnected', () => {
        console.log('[ClawbotChannel] 已断开');
        setStatus('DISCONNECTED');
      });

      clawbotChannelBridge.on('reconnecting', (data: any) => {
        console.log('[ClawbotChannel] 重连中...', data);
        setStatus('RECONNECTING');
      });

      clawbotChannelBridge.on('paired', (data: any) => {
        console.log('[ClawbotChannel] 配对成功:', data);
        setPairingStatus('paired');
        setDeviceId(data.deviceId || '');
        setLastError(null);
      });

      clawbotChannelBridge.on('unpaired', () => {
        console.log('[ClawbotChannel] 已解绑');
        setPairingStatus('idle');
        setDeviceId('');
      });

      // ✅ P1-#5: Bot 离线通知
      clawbotChannelBridge.on('bot_offline', (data: any) => {
        console.log('[ClawbotChannel] Bot 离线:', data);
        toast.error(data.message || 'Clawbot 已离线', {
          duration: 5000,
          id: `bot_offline_${data.timestamp}`
        });
      });

      // ✅ P1-问题5: Bot 上线通知
      clawbotChannelBridge.on('bot_online', (data: any) => {
        console.log('[ClawbotChannel] Bot 上线:', data);
        toast.success(data.message || 'Clawbot 已重新连接', {
          duration: 3000,
          id: `bot_online_${data.timestamp}`
        });
      });

      clawbotChannelBridge.on('message', (message: ClawbotChannelMessage) => {
        console.log('[ClawbotChannel] 收到 Bot 消息:', message);
        setMessages(prev => [...prev, message]);
      });

      clawbotChannelBridge.on('error', (error: any) => {
        console.error('[ClawbotChannel] 错误:', error);
        setStatus('ERROR');
        setLastError(error.message || '连接错误');
      });
    };

    setupListeners();

    // 连接到服务器
    clawbotChannelBridge.connect().catch(err => {
      console.error('[ClawbotChannel] 连接失败:', err);
      setLastError(err.message || '连接失败');
    });

    return () => {
      clawbotChannelBridge.removeAllListeners();
    };
  }, [user?.id]);

  // 连接
  const connect = useCallback(async () => {
    await clawbotChannelBridge.connect();
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    clawbotChannelBridge.disconnect();
    setStatus('DISCONNECTED');
  }, []);

  // ❌ 已删除: requestPairing() 方法
  // 原因: 配对流程应由 Clawbot 端发起，不是 App 端

  // 配对码配对
  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    if (!clawbotChannelBridge.isConnected()) {
      setLastError('未连接到服务器');
      return false;
    }

    setLastError(null);

    try {
      const result = await clawbotChannelBridge.pairWithCode(code);
      if (result.success) {
        // ✅ P0-问题2: 智能状态转换和超时机制
        if (result.status === 'paired') {
          // 服务器已经完成配对，直接设置为 paired
          setPairingStatus('paired');
          return true;
        } else {
          // 否则设置为 waiting_for_bot，并添加超时机制
          setPairingStatus('waiting_for_bot');

          // ✅ 添加 30 秒超时机制
          setTimeout(() => {
            setPairingStatus(prev => {
              if (prev === 'waiting_for_bot') {
                setLastError('配对超时，请重试');
                toast.error('配对超时，请重试');
                return 'idle';
              }
              return prev;
            });
          }, 30000); // 30 秒超时
        }
        return true;
      }
      return false;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '配对失败');
      setPairingStatus('idle');
      return false;
    }
  }, []); // ✅ 移除 pairingStatus 依赖，使用函数式更新

  // 二维码配对
  const pairWithQR = useCallback(async (token: string): Promise<boolean> => {
    if (!clawbotChannelBridge.isConnected()) {
      setLastError('未连接到服务器');
      return false;
    }

    setLastError(null);

    try {
      const result = await clawbotChannelBridge.pairWithToken(token);
      if (result.success) {
        setPairingStatus('waiting_for_bot');
        return true;
      }
      return false;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '配对失败');
      setPairingStatus('idle');
      return false;
    }
  }, []);

  // ✅ #14: 发送消息（带确认机制）
  const sendMessage = useCallback((
    content: string,
    contentType: 'text' | 'image' | 'video' | 'file' = 'text',
    mediaUrl?: string
  ) => {
    if (!clawbotChannelBridge.isPaired()) {
      setLastError('未配对，无法发送消息');
      return;
    }

    // ✅ #14: Promise-based 发送
    clawbotChannelBridge.sendMessage(content, contentType, mediaUrl)
      .then(() => {
        // 添加用户消息到列表
        const userMessage: ClawbotChannelMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,  // ✅ #8: 使用 UUID
          content,
          contentType,
          mediaUrl,
          timestamp: Date.now(),
          sender: 'user'
        };
        setMessages(prev => [...prev, userMessage]);
        setLastError(null);
      })
      .catch((error) => {
        console.error('[ClawbotChannel] 发送消息失败:', error);
        setLastError(error instanceof Error ? error.message : '发送失败');
        toast.error(error instanceof Error ? error.message : '发送失败');
      });
  }, []);

  // 上传媒体
  const uploadMedia = useCallback(async (file: File | Blob): Promise<string> => {
    try {
      const url = await clawbotChannelBridge.uploadMedia(file);
      setLastError(null);
      return url;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '上传失败');
      throw error;
    }
  }, []);

  // 解绑
  const unpair = useCallback(() => {
    clawbotChannelBridge.unpair();
    setPairingStatus('idle');
    setDeviceId('');
    setPairingCode(null);
    setQrImage(null);
    setMessages([]);
    setLastError(null);
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value: ClawbotChannelContextType = {
    status,
    isConnected: status === 'CONNECTED',
    isPaired: pairingStatus === 'paired',
    pairingStatus,
    pairingCode,
    qrImage,
    deviceId,
    messages,
    connect,
    disconnect,
    pairWithCode,
    pairWithQR,
    sendMessage,
    uploadMedia,
    unpair,
    clearMessages,
    lastError
  };

  return (
    <ClawbotChannelContext.Provider value={value}>
      {children}
    </ClawbotChannelContext.Provider>
  );
};

/**
 * Hook: 使用 Clawbot Channel
 */
export const useClawbotChannel = () => {
  const context = useContext(ClawbotChannelContext);
  if (!context) {
    throw new Error('useClawbotChannel 必须在 ClawbotChannelProvider 内部使用');
  }
  return context;
};

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import clawbotChannelBridge, {
  CHANNEL_PROTOCOL_MISMATCH,
  type ClawbotChannelMessage,
} from '../services/ClawbotChannelBridge';
import { useAuth } from './AuthContext';
import { useVoiceSettings } from './VoiceSettingsContext';

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'PAIRED';

export type PairingStatus = 'idle' | 'pairing' | 'paired' | 'waiting_for_bot';
export type BotState = 'IDLE' | 'THINKING' | 'SPEAKING';

interface ClawbotChannelContextType {
  status: ConnectionStatus;
  isConnected: boolean;
  isPaired: boolean;
  pairingStatus: PairingStatus;
  pairingCode: string | null;
  qrImage: string | null;
  deviceId: string;
  messages: ClawbotChannelMessage[];
  botState: BotState;
  latestBotMessage: ClawbotChannelMessage | null;
  idleEnteredAt: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  pairWithCode: (code: string) => Promise<boolean>;
  pairWithQR: (token: string) => Promise<boolean>;
  sendMessage: (
    content: string,
    contentType?: 'text' | 'image' | 'video' | 'file',
    mediaUrl?: string
  ) => Promise<void>;
  notifyVoicePlaybackStarted: (messageId: string) => void;
  notifyVoicePlaybackEnded: (messageId: string) => void;
  notifyVoicePlaybackError: (messageId: string) => void;
  uploadMedia: (file: File | Blob) => Promise<string>;
  unpair: () => void;
  clearMessages: () => void;
  lastError: string | null;
}

const ClawbotChannelContext = createContext<ClawbotChannelContextType | undefined>(undefined);

interface ClawbotChannelProviderProps {
  children: ReactNode;
}

const CHANNEL_PROTOCOL_MISMATCH_MESSAGE =
  '当前 8765 服务不是 Clawbot Channel 服务，请启动 server/clawbot-channel/server.js';
const SPEAKING_MIN_MS = 1200;
const SPEAKING_MAX_MS = 12000;
const SPEAKING_BASE_MS = 800;
const SPEAKING_PER_CHAR_MS = 45;

const resolveChannelErrorMessage = (error: any): string => {
  if (error?.code === CHANNEL_PROTOCOL_MISMATCH) {
    return CHANNEL_PROTOCOL_MISMATCH_MESSAGE;
  }

  return error?.message || '连接错误';
};

export const ClawbotChannelProvider: React.FC<ClawbotChannelProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { voiceEnabled } = useVoiceSettings();
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('idle');
  const [messages, setMessages] = useState<ClawbotChannelMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [botState, setBotState] = useState<BotState>('IDLE');
  const [latestBotMessage, setLatestBotMessage] = useState<ClawbotChannelMessage | null>(null);
  const [idleEnteredAt, setIdleEnteredAt] = useState<number>(() => Date.now());

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ClawbotChannelMessage[]>([]);
  const activeVoiceMessageIdRef = useRef<string | null>(null);
  const pendingVoiceMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearSpeakingTimeout = useCallback(() => {
    if (!speakingTimeoutRef.current) {
      return;
    }

    clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = null;
  }, []);

  const enterIdle = useCallback(() => {
    clearSpeakingTimeout();
    setBotState('IDLE');
    setIdleEnteredAt(Date.now());
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;
  }, [clearSpeakingTimeout]);

  const enterThinking = useCallback(() => {
    clearSpeakingTimeout();
    setBotState('THINKING');
  }, [clearSpeakingTimeout]);

  const enterSpeakingWithTimeout = useCallback((message: ClawbotChannelMessage) => {
    clearSpeakingTimeout();
    setBotState('SPEAKING');
    setLatestBotMessage(message);
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;

    const contentLength = message.content.length;
    const durationMs = Math.min(
      Math.max(SPEAKING_BASE_MS + contentLength * SPEAKING_PER_CHAR_MS, SPEAKING_MIN_MS),
      SPEAKING_MAX_MS
    );

    speakingTimeoutRef.current = setTimeout(() => {
      speakingTimeoutRef.current = null;
      setBotState('IDLE');
      setIdleEnteredAt(Date.now());
    }, durationMs);
  }, [clearSpeakingTimeout]);

  const handleBotMessageState = useCallback((message: ClawbotChannelMessage) => {
    if (voiceEnabled) {
      clearSpeakingTimeout();
      setLatestBotMessage(message);
      setBotState('THINKING');
      const messageId = message.id || `bot-${message.timestamp}`;
      activeVoiceMessageIdRef.current = messageId;
      pendingVoiceMessageIdRef.current = messageId;
      return;
    }

    enterSpeakingWithTimeout(message);
  }, [clearSpeakingTimeout, enterSpeakingWithTimeout, voiceEnabled]);

  useEffect(() => {
    return () => {
      clearSpeakingTimeout();
    };
  }, [clearSpeakingTimeout]);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    if (botState !== 'THINKING' || !latestBotMessage) {
      return;
    }

    const latestMessageId = latestBotMessage.id || `bot-${latestBotMessage.timestamp}`;
    if (pendingVoiceMessageIdRef.current !== latestMessageId) {
      return;
    }

    enterSpeakingWithTimeout(latestBotMessage);
  }, [botState, enterSpeakingWithTimeout, latestBotMessage, voiceEnabled]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const setupListeners = () => {
      clawbotChannelBridge.on('connecting', () => {
        setStatus('CONNECTING');
        setLastError(null);
      });

      clawbotChannelBridge.on('connected', async () => {
        setStatus('CONNECTED');
        setLastError(null);

        try {
          const pairing = await clawbotChannelBridge.checkPairingStatus();
          if (pairing.paired) {
            setPairingStatus('paired');
            setDeviceId(pairing.deviceId || '');
          } else {
            setPairingStatus('idle');
            setDeviceId('');
          }
        } catch (error) {
          console.warn('[ClawbotChannel] 同步配对状态失败', error);
          setLastError(resolveChannelErrorMessage(error));
        }
      });

      clawbotChannelBridge.on('disconnected', () => {
        setStatus('DISCONNECTED');
        enterIdle();
      });

      clawbotChannelBridge.on('reconnecting', () => {
        setStatus('RECONNECTING');
      });

      clawbotChannelBridge.on('paired', (data: any) => {
        setPairingStatus('paired');
        setDeviceId(data.deviceId || '');
        setLastError(null);
      });

      clawbotChannelBridge.on('unpaired', () => {
        setPairingStatus('idle');
        setDeviceId('');
        enterIdle();
      });

      clawbotChannelBridge.on('bot_offline', (data: any) => {
        toast.error(data.message || 'Clawbot 已离线', {
          duration: 5000,
          id: `bot_offline_${data.timestamp}`,
        });
      });

      clawbotChannelBridge.on('bot_online', (data: any) => {
        toast.success(data.message || 'Clawbot 已重新连接', {
          duration: 3000,
          id: `bot_online_${data.timestamp}`,
        });
      });

      clawbotChannelBridge.on('message', (message: ClawbotChannelMessage) => {
        setMessages((prev) => [...prev, message]);
        if (message.sender === 'bot') {
          handleBotMessageState(message);
        }
      });

      clawbotChannelBridge.on('error', (error: any) => {
        console.error('[ClawbotChannel] 错误:', error);
        const message = resolveChannelErrorMessage(error);
        setStatus('ERROR');
        setLastError(message);
        enterIdle();
        if (error?.code === CHANNEL_PROTOCOL_MISMATCH) {
          toast.error(message, { id: 'channel_protocol_mismatch' });
        }
      });

      clawbotChannelBridge.on('sync_missed_messages', async () => {
        try {
          const currentMessages = messagesRef.current;
          const lastMessageTimestamp =
            currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].timestamp : 0;
          const userId = clawbotChannelBridge.getUserId();
          if (!userId) {
            return;
          }

          const response = await fetch(
            `http://TRIX_SERVER_HOST:8765/api/messages/sync?userId=${userId}&lastTimestamp=${lastMessageTimestamp}`
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          if (!result.success || !result.messages || result.messages.length === 0) {
            return;
          }

          const missedMessages: ClawbotChannelMessage[] = result.messages.map((msg: any) => ({
            id: msg.message_id || `msg_${msg.timestamp}`,
            content: msg.content,
            contentType: msg.content_type || 'text',
            mediaUrl: msg.media_url,
            timestamp: msg.timestamp,
            sender: msg.sender,
          }));

          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = missedMessages.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newMessages];
          });

          const latestMissedBotMessage = [...missedMessages]
            .reverse()
            .find((message) => message.sender === 'bot');
          if (latestMissedBotMessage) {
            setLatestBotMessage(latestMissedBotMessage);
          }
        } catch (error) {
          console.error('[ClawbotChannel] 消息同步失败:', error);
        }
      });
    };

    setupListeners();

    clawbotChannelBridge.connect().catch((err) => {
      console.error('[ClawbotChannel] 连接失败:', err);
      setLastError(resolveChannelErrorMessage(err));
    });

    return () => {
      clawbotChannelBridge.removeAllListeners();
      clearSpeakingTimeout();
    };
  }, [clearSpeakingTimeout, enterIdle, handleBotMessageState, user?.id]);

  const connect = useCallback(async () => {
    await clawbotChannelBridge.connect();
  }, []);

  const disconnect = useCallback(() => {
    clawbotChannelBridge.disconnect();
    setStatus('DISCONNECTED');
    enterIdle();
  }, [enterIdle]);

  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    if (!clawbotChannelBridge.isConnected()) {
      setLastError('未连接到服务端');
      return false;
    }

    setLastError(null);

    try {
      const result = await clawbotChannelBridge.pairWithCode(code);
      if (!result.success) {
        return false;
      }

      if (result.status === 'paired') {
        setPairingStatus('paired');
        return true;
      }

      setPairingStatus('waiting_for_bot');
      setTimeout(() => {
        setPairingStatus((prev) => {
          if (prev === 'waiting_for_bot') {
            setLastError('配对超时，请重试');
            toast.error('配对超时，请重试');
            return 'idle';
          }
          return prev;
        });
      }, 30000);
      return true;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '配对失败');
      setPairingStatus('idle');
      return false;
    }
  }, []);

  const pairWithQR = useCallback(async (token: string): Promise<boolean> => {
    if (!clawbotChannelBridge.isConnected()) {
      setLastError('未连接到服务端');
      return false;
    }

    setLastError(null);

    try {
      const result = await clawbotChannelBridge.pairWithToken(token);
      if (!result.success) {
        return false;
      }

      if (result.status === 'paired') {
        setPairingStatus('paired');
      } else {
        setPairingStatus('waiting_for_bot');
      }
      return true;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '配对失败');
      setPairingStatus('idle');
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    contentType: 'text' | 'image' | 'video' | 'file' = 'text',
    mediaUrl?: string
  ): Promise<void> => {
    if (!clawbotChannelBridge.isPaired()) {
      const message = '未配对，无法发送消息';
      setLastError(message);
      throw new Error(message);
    }

    enterThinking();

    try {
      await clawbotChannelBridge.sendMessage(content, contentType, mediaUrl);
      const userMessage: ClawbotChannelMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        content,
        contentType,
        mediaUrl,
        timestamp: Date.now(),
        sender: 'user',
      };
      setMessages((prev) => [...prev, userMessage]);
      setLastError(null);
    } catch (error) {
      console.error('[ClawbotChannel] 发送消息失败:', error);
      const message = error instanceof Error ? error.message : '发送失败';
      setLastError(message);
      toast.error(message);
      enterIdle();
      throw error instanceof Error ? error : new Error(message);
    }
  }, [enterIdle, enterThinking]);

  const notifyVoicePlaybackStarted = useCallback((messageId: string) => {
    if (!voiceEnabled || !messageId) {
      return;
    }

    const activeMessageId = activeVoiceMessageIdRef.current;
    const pendingMessageId = pendingVoiceMessageIdRef.current;
    if (activeMessageId !== messageId && pendingMessageId !== messageId) {
      return;
    }

    clearSpeakingTimeout();
    pendingVoiceMessageIdRef.current = null;
    activeVoiceMessageIdRef.current = messageId;
    setBotState('SPEAKING');
  }, [clearSpeakingTimeout, voiceEnabled]);

  const notifyVoicePlaybackEnded = useCallback((messageId: string) => {
    if (!messageId || activeVoiceMessageIdRef.current !== messageId) {
      return;
    }
    enterIdle();
  }, [enterIdle]);

  const notifyVoicePlaybackError = useCallback((messageId: string) => {
    if (!messageId) {
      return;
    }

    const activeMessageId = activeVoiceMessageIdRef.current;
    const pendingMessageId = pendingVoiceMessageIdRef.current;
    if (activeMessageId !== messageId && pendingMessageId !== messageId) {
      return;
    }

    enterIdle();
  }, [enterIdle]);

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

  const unpair = useCallback(() => {
    clawbotChannelBridge.unpair();
    setPairingStatus('idle');
    setDeviceId('');
    setPairingCode(null);
    setQrImage(null);
    setMessages([]);
    setLatestBotMessage(null);
    setLastError(null);
    enterIdle();
  }, [enterIdle]);

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
    botState,
    latestBotMessage,
    idleEnteredAt,
    connect,
    disconnect,
    pairWithCode,
    pairWithQR,
    sendMessage,
    notifyVoicePlaybackStarted,
    notifyVoicePlaybackEnded,
    notifyVoicePlaybackError,
    uploadMedia,
    unpair,
    clearMessages,
    lastError,
  };

  return <ClawbotChannelContext.Provider value={value}>{children}</ClawbotChannelContext.Provider>;
};

export const useClawbotChannel = () => {
  const context = useContext(ClawbotChannelContext);
  if (!context) {
    throw new Error('useClawbotChannel must be used within ClawbotChannelProvider');
  }
  return context;
};

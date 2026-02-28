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
  type SocketEvents,
  type ErrorPayload,
} from '../services/ClawbotChannelBridge';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import {
  deleteClawbotMessage,
  loadClawbotMessageHistory,
  saveClawbotMessage,
} from '../services/databaseService';
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
  hasSessionConversationStarted: boolean;
  idleEnteredAt: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  pairWithCode: (code: string) => Promise<boolean>;
  pairWithQR: (token: string) => Promise<boolean>;
  sendMessage: (
    content: string,
    contentType?: 'text' | 'image' | 'video' | 'file' | 'mixed',
    mediaUrl?: string,
    mediaMimeType?: string
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
const THINKING_MAX_MS = 25000;

const resolveChannelErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; message?: string };
    if (err.code === CHANNEL_PROTOCOL_MISMATCH) {
      return CHANNEL_PROTOCOL_MISMATCH_MESSAGE;
    }
    return err.message || '连接错误';
  }
  return '连接错误';
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
  const [hasSessionConversationStarted, setHasSessionConversationStarted] = useState(false);
  const [idleEnteredAt, setIdleEnteredAt] = useState<number>(() => Date.now());

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ClawbotChannelMessage[]>([]);
  const activeVoiceMessageIdRef = useRef<string | null>(null);
  const pendingVoiceMessageIdRef = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  const toPersistedMessageId = useCallback((message: ClawbotChannelMessage): string => {
    if (message.id && message.id.length > 0) {
      return message.id;
    }
    return `${message.sender}-${message.timestamp}`;
  }, []);

  const upsertMessageState = useCallback((message: ClawbotChannelMessage) => {
    setMessages((prev) => {
      const messageId = toPersistedMessageId(message);
      const exists = prev.some((item) => toPersistedMessageId(item) === messageId);
      if (exists) {
        return prev;
      }
      const next = [...prev, { ...message, id: messageId }];
      next.sort((a, b) => a.timestamp - b.timestamp);
      return next;
    });
  }, [toPersistedMessageId]);

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

  const clearThinkingTimeout = useCallback(() => {
    if (!thinkingTimeoutRef.current) {
      return;
    }

    clearTimeout(thinkingTimeoutRef.current);
    thinkingTimeoutRef.current = null;
  }, []);

  const enterIdle = useCallback(() => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('IDLE');
    setIdleEnteredAt(Date.now());
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const enterThinking = useCallback(() => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('THINKING');
    thinkingTimeoutRef.current = setTimeout(() => {
      thinkingTimeoutRef.current = null;
      enterIdle();
    }, THINKING_MAX_MS);
  }, [clearSpeakingTimeout, clearThinkingTimeout, enterIdle]);

  const enterSpeakingWithTimeout = useCallback((message: ClawbotChannelMessage) => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
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
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const handleBotMessageState = useCallback((message: ClawbotChannelMessage) => {
    if (voiceEnabled) {
      setLatestBotMessage(message);
      enterThinking();
      const messageId = message.id || `bot-${message.timestamp}`;
      activeVoiceMessageIdRef.current = messageId;
      pendingVoiceMessageIdRef.current = messageId;
      return;
    }

    enterSpeakingWithTimeout(message);
  }, [enterSpeakingWithTimeout, enterThinking, voiceEnabled]);

  const resetSessionScopedState = useCallback(() => {
    setStatus('DISCONNECTED');
    setPairingStatus('idle');
    setPairingCode(null);
    setQrImage(null);
    setDeviceId('');
    setMessages([]);
    setLatestBotMessage(null);
    setHasSessionConversationStarted(false);
    setLastError(null);
    enterIdle();
  }, [enterIdle]);

  useEffect(() => {
    return () => {
      clearSpeakingTimeout();
      clearThinkingTimeout();
    };
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

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
    const currentUserId = user?.id ?? null;

    if (!currentUserId) {
      previousUserIdRef.current = null;
      clawbotChannelBridge.removeAllListeners();
      clawbotChannelBridge.disconnect();
      resetSessionScopedState();
      return;
    }

    const previousUserId = previousUserIdRef.current;
    if (previousUserId && previousUserId !== currentUserId) {
      clawbotChannelBridge.removeAllListeners();
      clawbotChannelBridge.disconnect();
      resetSessionScopedState();
    }

    previousUserIdRef.current = currentUserId;
  }, [resetSessionScopedState, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let disposed = false;
    void loadClawbotMessageHistory(user.id).then((history) => {
      if (disposed || history.length === 0) {
        return;
      }

      const historyMessages: ClawbotChannelMessage[] = history.map((message) => ({
        id: message.id,
        content: message.content,
        contentType: message.contentType,
        mediaUrl: message.mediaUrl,
        mediaMimeType: message.mediaMimeType,
        timestamp: message.timestamp,
        sender: message.sender,
      }));

      setMessages((prev) => {
        if (prev.length > 0) {
          return prev;
        }
        return historyMessages;
      });

      const latestBotMessage = [...historyMessages]
        .reverse()
        .find((message) => message.sender === 'bot');
      if (latestBotMessage) {
        setLatestBotMessage((prev) => prev ?? latestBotMessage);
      }
    });

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

      clawbotChannelBridge.on('pairing_success', ((data: SocketEvents['pairing_success']) => {
        setPairingStatus('paired');
        setDeviceId(data.deviceId || '');
        setLastError(null);
      }) as (data: unknown) => void);

      clawbotChannelBridge.on('unpaired', () => {
        setPairingStatus('idle');
        setDeviceId('');
        setHasSessionConversationStarted(false);
        enterIdle();
      });

      clawbotChannelBridge.on('bot_offline', (data: unknown) => {
        const eventData = data as SocketEvents['bot_offline'];
        toast.error(eventData.message || 'Clawbot 已离线', {
          duration: 5000,
          id: `bot_offline_${eventData.timestamp}`,
        });
      });

      clawbotChannelBridge.on('bot_online', (data: unknown) => {
        const eventData = data as SocketEvents['bot_online'];
        toast.success(eventData.message || 'Clawbot 已重新连接', {
          duration: 3000,
          id: `bot_online_${eventData.timestamp}`,
        });
      });

      clawbotChannelBridge.on('message', ((message: ClawbotChannelMessage) => {
        const normalizedMessage = {
          ...message,
          id: toPersistedMessageId(message),
        };
        upsertMessageState(normalizedMessage);
        if (user?.id) {
          void saveClawbotMessage(user.id, {
            id: normalizedMessage.id || toPersistedMessageId(normalizedMessage),
            content: normalizedMessage.content,
            contentType: normalizedMessage.contentType,
            mediaUrl: normalizedMessage.mediaUrl,
            mediaMimeType: normalizedMessage.mediaMimeType,
            timestamp: normalizedMessage.timestamp,
            sender: normalizedMessage.sender,
          });
        }
        if (message.sender === 'bot') {
          handleBotMessageState(normalizedMessage);
        }
      }) as (data: unknown) => void);

      clawbotChannelBridge.on('error', ((error: ErrorPayload) => {
        console.error('[ClawbotChannel] 错误:', error);
        const message = resolveChannelErrorMessage(error);
        setStatus('ERROR');
        setLastError(message);
        enterIdle();
        if (error?.code === CHANNEL_PROTOCOL_MISMATCH) {
          toast.error(message, { id: 'channel_protocol_mismatch' });
        }
      }) as (data: unknown) => void);

      clawbotChannelBridge.on('sync_missed_messages', async () => {
        try {
          const currentMessages = messagesRef.current;
          const lastMessage = currentMessages[currentMessages.length - 1];
          const lastMessageTimestamp = lastMessage ? lastMessage.timestamp : 0;
          const userId = clawbotChannelBridge.getUserId();
          if (!userId) {
            return;
          }

          const { channelUrl } = getClawbotEndpoints();
          if (!channelUrl) {
            return;
          }

          const syncUrl = new URL(channelUrl);
          syncUrl.protocol = syncUrl.protocol === 'wss:' ? 'https:' : 'http:';
          syncUrl.pathname = '/api/messages/sync';
          syncUrl.searchParams.set('userId', userId);
          syncUrl.searchParams.set('lastTimestamp', String(lastMessageTimestamp));

          const response = await fetch(syncUrl.toString());
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          if (!result.success || !result.messages || result.messages.length === 0) {
            return;
          }

          type MissedMessageResponse = {
            message_id?: string;
            timestamp: number;
            content: string;
            content_type?: string;
            media_url?: string;
            media_mime_type?: string;
            sender: 'user' | 'bot';
          };

          const missedMessages: ClawbotChannelMessage[] = result.messages.map((msg: MissedMessageResponse) => ({
            id: msg.message_id || `msg_${msg.timestamp}`,
            content: msg.content,
            contentType: msg.content_type || 'text',
            mediaUrl: msg.media_url,
            mediaMimeType: msg.media_mime_type,
            timestamp: msg.timestamp,
            sender: msg.sender,
          }));

          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => toPersistedMessageId(m)));
            const newMessages = missedMessages
              .map((message) => ({ ...message, id: toPersistedMessageId(message) }))
              .filter((message) => !existingIds.has(message.id || toPersistedMessageId(message)));
            const next = [...prev, ...newMessages];
            next.sort((a, b) => a.timestamp - b.timestamp);
            return next;
          });

          if (user?.id) {
            missedMessages.forEach((message) => {
              const persistedMessageId = toPersistedMessageId(message);
              void saveClawbotMessage(user.id!, {
                id: persistedMessageId,
                content: message.content,
                contentType: message.contentType,
                mediaUrl: message.mediaUrl,
                mediaMimeType: message.mediaMimeType,
                timestamp: message.timestamp,
                sender: message.sender,
              });
            });
          }

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
      disposed = true;
      clawbotChannelBridge.removeAllListeners();
      clearSpeakingTimeout();
      clearThinkingTimeout();
    };
  }, [
    clearSpeakingTimeout,
    clearThinkingTimeout,
    enterIdle,
    handleBotMessageState,
    toPersistedMessageId,
    upsertMessageState,
    user?.id,
  ]);

  const connect = useCallback(async () => {
    await clawbotChannelBridge.connect();
  }, []);

  const disconnect = useCallback(() => {
    clawbotChannelBridge.disconnect();
    setStatus('DISCONNECTED');
    setHasSessionConversationStarted(false);
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
    contentType: 'text' | 'image' | 'video' | 'file' | 'mixed' = 'text',
    mediaUrl?: string,
    mediaMimeType?: string
  ): Promise<void> => {
    if (!clawbotChannelBridge.isPaired()) {
      const message = '未配对，无法发送消息';
      setLastError(message);
      throw new Error(message);
    }

    const optimisticUserMessage: ClawbotChannelMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      content,
      contentType,
      mediaUrl,
      mediaMimeType,
      timestamp: Date.now(),
      sender: 'user',
    };
    const optimisticMessageId = optimisticUserMessage.id || toPersistedMessageId(optimisticUserMessage);
    const normalizedOptimisticMessage = {
      ...optimisticUserMessage,
      id: optimisticMessageId,
    };

    setHasSessionConversationStarted(true);
    enterThinking();
    upsertMessageState(normalizedOptimisticMessage);
    if (user?.id) {
      void saveClawbotMessage(user.id, {
        id: optimisticMessageId,
        content: normalizedOptimisticMessage.content,
        contentType: normalizedOptimisticMessage.contentType,
        mediaUrl: normalizedOptimisticMessage.mediaUrl,
        mediaMimeType: normalizedOptimisticMessage.mediaMimeType,
        timestamp: normalizedOptimisticMessage.timestamp,
        sender: normalizedOptimisticMessage.sender,
      });
    }

    try {
      await clawbotChannelBridge.sendMessage(content, contentType, mediaUrl, mediaMimeType);
      setLastError(null);
    } catch (error) {
      console.error('[ClawbotChannel] 发送消息失败:', error);
      setMessages((prev) => prev.filter((message) => toPersistedMessageId(message) !== optimisticMessageId));
      if (user?.id) {
        void deleteClawbotMessage(user.id, optimisticMessageId);
      }
      const message = error instanceof Error ? error.message : '发送失败';
      setLastError(message);
      toast.error(message);
      enterIdle();
      throw error instanceof Error ? error : new Error(message);
    }
  }, [enterIdle, enterThinking, toPersistedMessageId, upsertMessageState, user?.id]);

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
    clearThinkingTimeout();
    pendingVoiceMessageIdRef.current = null;
    activeVoiceMessageIdRef.current = messageId;
    setBotState('SPEAKING');
  }, [clearSpeakingTimeout, clearThinkingTimeout, voiceEnabled]);

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
    setHasSessionConversationStarted(false);
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
    hasSessionConversationStarted,
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

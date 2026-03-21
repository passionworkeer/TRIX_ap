import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import type {
  ClawbotChannelMessage,
} from '../types/clawbotChannel';
import trixNativeChannelClient, {
  type NativeMessageAttachmentInput,
  type NativeUploadAttachment,
} from '../services/TrixNativeChannelClient';
import { useAuth } from './AuthContext';
import { useVoiceSettings } from './VoiceSettingsContext';
import { logger } from '../utils/logger';

function generateSecureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('').slice(0, length);
}

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
  botOnline: boolean;
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
  pairWithQR: (payload: string) => Promise<boolean>;
  sendMessage: (
    content: string,
    contentType?: ClawbotChannelMessage['contentType'],
    mediaUrl?: string,
    mediaMimeType?: string,
    mediaMetadata?: ClawbotChannelMessage['mediaMetadata'],
    attachments?: NativeMessageAttachmentInput[],
  ) => Promise<void>;
  notifyVoicePlaybackStarted: (messageId: string) => void;
  notifyVoicePlaybackEnded: (messageId: string) => void;
  notifyVoicePlaybackError: (messageId: string) => void;
  uploadMedia: (file: File | Blob) => Promise<string>;
  uploadAttachment: (file: File | Blob, options?: { fileName?: string; kind?: NativeUploadAttachment['kind'] }) => Promise<NativeUploadAttachment>;
  unpair: () => void;
  clearMessages: () => void;
  lastError: string | null;
}

const ClawbotChannelContext = createContext<ClawbotChannelContextType | undefined>(undefined);

interface ClawbotChannelProviderProps {
  children: ReactNode;
}

const SPEAKING_MIN_MS = 1200;
const SPEAKING_MAX_MS = 12000;
const SPEAKING_BASE_MS = 800;
const SPEAKING_PER_CHAR_MS = 45;
const REPLY_SETTLE_WINDOW_MS = 4500;
const MAX_MESSAGES = 500;

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: string };
    if (typeof maybe.message === 'string' && maybe.message.trim()) {
      return maybe.message;
    }
  }
  return '���Ӵ���';
};

export const ClawbotChannelProvider: React.FC<ClawbotChannelProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { voiceEnabled } = useVoiceSettings();

  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('idle');
  const [messages, setMessages] = useState<ClawbotChannelMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>(() => trixNativeChannelClient.getOrCreateClientId());
  const [botState, setBotState] = useState<BotState>('IDLE');
  const [botOnline, setBotOnline] = useState<boolean>(false);
  const [latestBotMessage, setLatestBotMessage] = useState<ClawbotChannelMessage | null>(null);
  const [hasSessionConversationStarted, setHasSessionConversationStarted] = useState(false);
  const [idleEnteredAt, setIdleEnteredAt] = useState<number>(() => Date.now());

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replySettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ClawbotChannelMessage[]>([]);
  const activeVoiceMessageIdRef = useRef<string | null>(null);
  const pendingVoiceMessageIdRef = useRef<string | null>(null);
  const pendingBotReplyRef = useRef(false);

  // Push botState changes to Electron float window via IPC
  useEffect(() => {
    const api = (window as Window & { electronAPI?: { pushBotState: (state: BotState) => Promise<boolean> } }).electronAPI;
    if (api?.pushBotState) {
      api.pushBotState(botState).catch(() => {
        // Ignore IPC errors in non-Electron env
      });
    }
  }, [botState]);

  const toPersistedMessageId = useCallback((message: ClawbotChannelMessage): string => {
    const metadata = message.metadata as { clientMessageId?: string } | undefined;
    if (metadata?.clientMessageId) {
      return metadata.clientMessageId;
    }
    if (message.id && message.id.length > 0) {
      return message.id;
    }
    return `${message.sender}-${message.timestamp}`;
  }, []);

  const clearSpeakingTimeout = useCallback(() => {
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  }, []);

  const clearReplySettleTimeout = useCallback(() => {
    if (replySettleTimeoutRef.current) {
      clearTimeout(replySettleTimeoutRef.current);
      replySettleTimeoutRef.current = null;
    }
  }, []);

  const enterIdle = useCallback(() => {
    clearSpeakingTimeout();
    clearReplySettleTimeout();
    pendingBotReplyRef.current = false;
    setBotState('IDLE');
    setIdleEnteredAt(Date.now());
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;
  }, [clearReplySettleTimeout, clearSpeakingTimeout]);

  const enterThinking = useCallback(() => {
    clearSpeakingTimeout();
    clearReplySettleTimeout();
    pendingBotReplyRef.current = true;
    setBotState('THINKING');
  }, [clearReplySettleTimeout, clearSpeakingTimeout]);

  const scheduleReplySettle = useCallback(() => {
    clearReplySettleTimeout();
    replySettleTimeoutRef.current = setTimeout(() => {
      replySettleTimeoutRef.current = null;
      if (activeVoiceMessageIdRef.current || pendingVoiceMessageIdRef.current) {
        scheduleReplySettle();
        return;
      }
      pendingBotReplyRef.current = false;
      setBotState('IDLE');
      setIdleEnteredAt(Date.now());
    }, REPLY_SETTLE_WINDOW_MS);
  }, [clearReplySettleTimeout]);

  const enterSpeakingWithTimeout = useCallback((message: ClawbotChannelMessage) => {
    clearSpeakingTimeout();
    clearReplySettleTimeout();
    pendingBotReplyRef.current = true;
    setBotState('SPEAKING');
    setLatestBotMessage(message);
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;

    const contentLength = message.content.length;
    const durationMs = Math.min(
      Math.max(SPEAKING_BASE_MS + contentLength * SPEAKING_PER_CHAR_MS, SPEAKING_MIN_MS),
      SPEAKING_MAX_MS,
    );

    speakingTimeoutRef.current = setTimeout(() => {
      speakingTimeoutRef.current = null;
      scheduleReplySettle();
    }, durationMs);
  }, [clearReplySettleTimeout, clearSpeakingTimeout, scheduleReplySettle]);

  const handleBotMessageState = useCallback((message: ClawbotChannelMessage) => {
    enterSpeakingWithTimeout(message);
    if (voiceEnabled) {
      pendingVoiceMessageIdRef.current = toPersistedMessageId(message);
    }
  }, [enterSpeakingWithTimeout, toPersistedMessageId, voiceEnabled]);

  const resetSessionScopedState = useCallback(() => {
    setStatus('DISCONNECTED');
    setPairingStatus('idle');
    setPairingCode(null);
    setMessages([]);
    setLatestBotMessage(null);
    setHasSessionConversationStarted(false);
    setLastError(null);
    setBotOnline(false);
    enterIdle();
  }, [enterIdle]);

  const upsertMessageState = useCallback((message: ClawbotChannelMessage) => {
    setMessages((prev) => {
      const messageId = toPersistedMessageId(message);
      const existingIndex = prev.findIndex((entry) => toPersistedMessageId(entry) === messageId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...message,
          id: messageId,
        };
        return next;
      }

      const next = [...prev, { ...message, id: messageId }]
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-MAX_MESSAGES);
      return next;
    });
  }, [toPersistedMessageId]);

  useEffect(() => {
    messagesRef.current = messages;
    const latestBot = [...messages].reverse().find((message) => message.sender === 'bot') || null;
    setLatestBotMessage(latestBot);
    setHasSessionConversationStarted(messages.length > 0);
  }, [messages]);

  useEffect(() => {
    return () => {
      clearSpeakingTimeout();
      clearReplySettleTimeout();
    };
  }, [clearReplySettleTimeout, clearSpeakingTimeout]);

  useEffect(() => {
    const handleConnecting = () => {
      setStatus('CONNECTING');
      setLastError(null);
    };
    const handleConnected = (payload: { agentOnline: boolean }) => {
      setStatus('CONNECTED');
      setPairingStatus(trixNativeChannelClient.isPaired() ? 'paired' : 'idle');
      setBotOnline(payload.agentOnline);
      setLastError(null);
      const session = trixNativeChannelClient.getSession();
      setDeviceId(session?.clientId || trixNativeChannelClient.getOrCreateClientId());
      setPairingCode(session?.pairingCode ?? null);
    };
    const handleDisconnected = () => {
      setStatus('DISCONNECTED');
    };
    const handleReconnecting = () => {
      setStatus('RECONNECTING');
    };
    const handlePairingSuccess = (payload: { deviceId: string; deviceName: string }) => {
      setPairingStatus('paired');
      setStatus('PAIRED');
      setDeviceId(payload.deviceId);
      const session = trixNativeChannelClient.getSession();
      setPairingCode(session?.pairingCode ?? null);
      setLastError(null);
    };
    const handleUnpaired = () => {
      resetSessionScopedState();
    };
    const handleBotOnline = (payload: { message: string; timestamp: number }) => {
      setBotOnline(true);
      toast.success(payload.message || 'OpenClaw ������', {
        duration: 3000,
        id: `bot_online_${payload.timestamp}`,
      });
    };
    const handleBotOffline = (payload: { message: string; timestamp: number }) => {
      setBotOnline(false);
      toast.error(payload.message || 'OpenClaw ��ǰ����', {
        duration: 5000,
        id: `bot_offline_${payload.timestamp}`,
      });
    };
    const handleHistory = (historyMessages: ClawbotChannelMessage[]) => {
      setMessages(historyMessages.map((message) => ({
        ...message,
        id: toPersistedMessageId(message),
      })));
      const latest = [...historyMessages].reverse().find((message) => message.sender === 'bot') || null;
      setLatestBotMessage(latest);
    };
    const handleMessage = (message: ClawbotChannelMessage) => {
      const normalized = {
        ...message,
        id: toPersistedMessageId(message),
      };
      upsertMessageState(normalized);
      if (normalized.sender === 'bot') {
        handleBotMessageState(normalized);
      }
    };
    const handleError = (error: { message: string }) => {
      const message = resolveErrorMessage(error);
      setLastError(message);
      setStatus('ERROR');
      logger.clawbot.error('[TrixNativeContext] transport error', error);
    };

    trixNativeChannelClient.on('connecting', handleConnecting);
    trixNativeChannelClient.on('connected', handleConnected);
    trixNativeChannelClient.on('disconnected', handleDisconnected);
    trixNativeChannelClient.on('reconnecting', handleReconnecting);
    trixNativeChannelClient.on('pairing_success', handlePairingSuccess);
    trixNativeChannelClient.on('unpaired', handleUnpaired);
    trixNativeChannelClient.on('bot_online', handleBotOnline);
    trixNativeChannelClient.on('bot_offline', handleBotOffline);
    trixNativeChannelClient.on('history', handleHistory);
    trixNativeChannelClient.on('message', handleMessage);
    trixNativeChannelClient.on('error', handleError);

    return () => {
      trixNativeChannelClient.off('connecting', handleConnecting);
      trixNativeChannelClient.off('connected', handleConnected);
      trixNativeChannelClient.off('disconnected', handleDisconnected);
      trixNativeChannelClient.off('reconnecting', handleReconnecting);
      trixNativeChannelClient.off('pairing_success', handlePairingSuccess);
      trixNativeChannelClient.off('unpaired', handleUnpaired);
      trixNativeChannelClient.off('bot_online', handleBotOnline);
      trixNativeChannelClient.off('bot_offline', handleBotOffline);
      trixNativeChannelClient.off('history', handleHistory);
      trixNativeChannelClient.off('message', handleMessage);
      trixNativeChannelClient.off('error', handleError);
    };
  }, [enterIdle, handleBotMessageState, resetSessionScopedState, toPersistedMessageId, upsertMessageState]);

  useEffect(() => {
    if (!user?.id) {
      trixNativeChannelClient.disconnect();
      resetSessionScopedState();
      return;
    }

    const session = trixNativeChannelClient.getSession();
    setDeviceId(session?.clientId || trixNativeChannelClient.getOrCreateClientId());
    setPairingCode(session?.pairingCode ?? null);
    setPairingStatus(session ? 'paired' : 'idle');

    if (session) {
      void trixNativeChannelClient.connect().catch((error: unknown) => {
        const message = resolveErrorMessage(error);
        setStatus('ERROR');
        setLastError(message);
      });
    }
  }, [resetSessionScopedState, user?.id]);

  const connect = useCallback(async (): Promise<void> => {
    try {
      await trixNativeChannelClient.connect();
      const pairing = await trixNativeChannelClient.checkPairingStatus();
      setPairingStatus(pairing.paired ? 'paired' : 'idle');
      setBotOnline(pairing.botOnline);
      setDeviceId(pairing.deviceId || trixNativeChannelClient.getOrCreateClientId());
      setLastError(null);
    } catch (error) {
      const message = resolveErrorMessage(error);
      setStatus('ERROR');
      setLastError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const disconnect = useCallback(() => {
    trixNativeChannelClient.disconnect();
    setStatus('DISCONNECTED');
  }, []);

  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      setPairingStatus('pairing');
      setStatus('CONNECTING');
      const result = await trixNativeChannelClient.pairWithCode(code.trim().toUpperCase());
      const session = trixNativeChannelClient.getSession();
      setPairingCode(session?.pairingCode ?? code.trim().toUpperCase());
      setLastError(null);
      return result.success;
    } catch (error) {
      const message = resolveErrorMessage(error);
      setPairingStatus('idle');
      setStatus('ERROR');
      setLastError(message);
      toast.error(message);
      return false;
    }
  }, []);

  const pairWithQR = useCallback(async (payload: string): Promise<boolean> => {
    try {
      setPairingStatus('pairing');
      setStatus('CONNECTING');
      const result = await trixNativeChannelClient.pairWithQR(payload);
      const session = trixNativeChannelClient.getSession();
      setPairingCode(session?.pairingCode ?? null);
      setLastError(null);
      return result.success;
    } catch (error) {
      const message = resolveErrorMessage(error);
      setPairingStatus('idle');
      setStatus('ERROR');
      setLastError(message);
      toast.error(message);
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    contentType: ClawbotChannelMessage['contentType'] = 'text',
    mediaUrl?: string,
    mediaMimeType?: string,
    mediaMetadata?: ClawbotChannelMessage['mediaMetadata'],
    attachments?: NativeMessageAttachmentInput[],
  ): Promise<void> => {
    const optimisticMessageId = `client_${generateSecureRandomString(18)}`;
    const optimisticAttachments = (attachments ?? []).map((attachment) => ({
      id: attachment.uploadId,
      kind: attachment.kind || 'file',
      url: attachment.url || '',
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
    }));

    const optimisticMessage: ClawbotChannelMessage = {
      id: optimisticMessageId,
      content,
      contentType,
      mediaUrl: mediaUrl || optimisticAttachments[0]?.url,
      mediaMimeType: mediaMimeType || optimisticAttachments[0]?.mimeType,
      mediaMetadata: mediaMetadata || (optimisticAttachments[0] ? {
        width: optimisticAttachments[0].width,
        height: optimisticAttachments[0].height,
        duration: optimisticAttachments[0].duration,
        originalName: optimisticAttachments[0].fileName,
        size: optimisticAttachments[0].size,
      } : undefined),
      attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
      metadata: {
        clientMessageId: optimisticMessageId,
      },
      timestamp: Date.now(),
      sender: 'user',
    };

    setHasSessionConversationStarted(true);
    enterThinking();
    upsertMessageState(optimisticMessage);

    try {
      await trixNativeChannelClient.sendMessage({
        text: content,
        contentType,
        mediaUrl,
        mediaMimeType,
        mediaMetadata,
        attachments,
        clientMessageId: optimisticMessageId,
      });
      setLastError(null);
    } catch (error) {
      setMessages((prev) => prev.filter((message) => toPersistedMessageId(message) !== optimisticMessageId));
      const message = resolveErrorMessage(error);
      setLastError(message);
      toast.error(message);
      enterIdle();
      throw error instanceof Error ? error : new Error(message);
    }
  }, [enterIdle, enterThinking, toPersistedMessageId, upsertMessageState]);

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
    const url = await trixNativeChannelClient.uploadMedia(file);
    setLastError(null);
    return url;
  }, []);

  const uploadAttachment = useCallback(async (
    file: File | Blob,
    options?: { fileName?: string; kind?: NativeUploadAttachment['kind'] },
  ): Promise<NativeUploadAttachment> => {
    const attachment = await trixNativeChannelClient.uploadAttachment(file, options);
    setLastError(null);
    return attachment;
  }, []);

  const unpair = useCallback(() => {
    trixNativeChannelClient.unpair();
    resetSessionScopedState();
    setDeviceId(trixNativeChannelClient.getOrCreateClientId());
  }, [resetSessionScopedState]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value = useMemo<ClawbotChannelContextType>(() => ({
    status,
    isConnected: status === 'CONNECTED' || status === 'PAIRED',
    isPaired: pairingStatus === 'paired',
    botOnline,
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
    uploadAttachment,
    unpair,
    clearMessages,
    lastError,
  }), [
    status,
    pairingStatus,
    botOnline,
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
    uploadAttachment,
    unpair,
    clearMessages,
    lastError,
  ]);

  return <ClawbotChannelContext.Provider value={value}>{children}</ClawbotChannelContext.Provider>;
};

export const useClawbotChannel = () => {
  const context = useContext(ClawbotChannelContext);
  if (!context) {
    throw new Error('useClawbotChannel must be used within ClawbotChannelProvider');
  }
  return context;
};

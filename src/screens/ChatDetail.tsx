import React, { useState, useRef, useEffect } from 'react';
import botAvatarImg from '../assets/roles/role1/AvatarHead.png';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Mic, MicOff, MoreVertical, X,
  Presentation, Table, FileText, MessageSquare, Image as ImageIcon, Video, Plus
} from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { IMAGES } from '../constants';
import { logger } from '../utils/logger';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useNotification } from '../hooks/useNotification';
import { useErrorHandler } from '../utils/errorHandler';
import { formatTime } from '../utils/dateFormat';
import Avatar from '../components/Avatar';
import MediaMessage from '../components/MediaMessage';
import AIActionSelector from '../components/AIActionSelector';
import { useConfirmModal } from '../hooks/useConfirmModal';
import VoiceRecorder from '../components/VoiceRecorder';
import VoiceMessage from '../components/VoiceMessage';
import { uploadAudio } from '../services/uploadService';
import {
  AIActionId,
  applyAIActionPrefix,
  detectAIActionFromInput,
} from '../features/chat/utils/aiPrompt';
import { getChatHistory, sendMessage as dbSendMessage, sendMessageWithMedia, markMessagesAsRead, getFriendById } from '../services/databaseService';
import { uploadFile, IMAGE_COMPRESSION_OPTIONS } from '../services/uploadService';
import { isServerOssUploadEnabled, uploadFileToServerOss } from '../services/serverOssUploadService';
import imageCompression from 'browser-image-compression';
import { supabase } from '../config/supabase';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import type { ChatMessage } from '../config/supabase';

// UI Message interface
interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'mixed' | 'voice';
  mediaUri?: string;
  mediaType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

// Mock conversations removed; use database data.

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { showError, showSuccess } = useNotification();
  const { requestConfirm, ConfirmModalRenderer } = useConfirmModal();
  const { handleError } = useErrorHandler();

  // 优先从 URL 参数获取 friendId，否则从 location.state 获取。
  const urlFriendId = params.friendId;
  const stateData = location.state || {};
  const autoSendPrompt = typeof stateData.autoSendPrompt === 'string' ? stateData.autoSendPrompt.trim() : '';

  const [friendData, setFriendData] = useState<{
    name: string;
    avatar: string;
    isBot: boolean;
    friendId: string;
    photoUri: string | null;
  }>({
    name: stateData.name || 'Clawdbot Gateway',
    avatar: stateData.avatar || IMAGES.WIZARD_BOY_LOGIN,
    isBot: stateData.isBot ?? true,
    friendId: urlFriendId || stateData.friendId || 'clawbot',
    photoUri: stateData.photoUri || null
  });

  const { name, avatar, isBot, friendId, photoUri } = friendData;
  const isBotConversation = friendId === 'clawbot' || friendId === 'clawbot_channel';

  // 如果存在 URL 参数且不是 state 传入，则从数据库加载好友信息。
  useEffect(() => {
    if (urlFriendId && !stateData.name && !['clawbot', 'clawbot_channel'].includes(urlFriendId)) {
      loadFriendData(urlFriendId);
    }
  }, [urlFriendId]);

  const loadFriendData = async (id: string) => {
    try {
      const friend = await getFriendById(id);
      if (friend) {
        setFriendData({
          name: friend.name,
          avatar: friend.avatar_url || IMAGES.SHIBA_AVATAR,
          isBot: false,
          friendId: friend.friend_id,
          photoUri: null
        });
      }
    } catch (error) {
      // 使用统一错误处理器。
      handleError(error, '加载好友信息失败');
    }
  };

  // 从路由参数中接收附件预览状态（包含完整媒体信息）。
  interface AttachmentPreview {
    uri: string;
    type: string;
    size?: number;
    category: 'image' | 'video';
    metadata?: Record<string, unknown>;
  }

  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);

  // Clawbot Channel connection
  const {
    messages: clawbotMessages,
    sendMessage: clawbotSendMessage,
    isPaired,
    unpair,
    status,
    botState,
  } = useClawbotChannel();

  // 鑿滃崟鏄剧ず鐘舵€?
  const [showMenu, setShowMenu] = useState(false);

  // Speech to text
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: isSpeechSupported,
  } = useSpeechToText({
    lang: 'zh-CN',
    continuous: false,
    interimResults: true,
    onResult: (text) => {
      setInput(prev => prev + text);
    },
    onError: (err) => {
      logger.chat.error('Speech error:', err);
    }
  });

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedAIAction, setSelectedAIAction] = useState<AIActionId>('chat');
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // 文件输入引用
  const autoPromptPrefilledRef = useRef(false);
  const autoSendTriggeredRef = useRef(false);

  // 语音录音状态
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  // 当 photoUri 变化时，将其加入附件列表。
  useEffect(() => {
    if (photoUri && !attachmentPreviews.some(p => p.uri === photoUri)) {
      setAttachmentPreviews(prev => [...prev, {
        uri: photoUri,
        type: 'image/jpeg',
        category: 'image',
        metadata: {}
      }]);
    }
  }, [photoUri]);

  // 从快照进入时，先把自动提示词填入输入框（可编辑）
  useEffect(() => {
    if (!autoSendPrompt || autoPromptPrefilledRef.current) return;
    setInput(autoSendPrompt);
    autoPromptPrefilledRef.current = true;
  }, [autoSendPrompt]);

  useEffect(() => {
    setSelectedAIAction(detectAIActionFromInput(input));
  }, [input]);

  // Realtime channel 引用（防止重复连接）。
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 组件卸载时清理所有订阅。
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');

  // 将数据库消息转换为 UI 消息。
  const convertDbMessageToUI = (dbMsg: ChatMessage): UIMessage => {
    const uiMessage: UIMessage = {
      id: dbMsg.id,
      sender: dbMsg.sender,
      text: typeof dbMsg.text === 'string' ? dbMsg.text : '',
      timestamp: formatTime(dbMsg.created_at)
    };

    // Add media fields if present
    if (dbMsg.message_type && dbMsg.message_type !== 'text') {
      uiMessage.messageType = dbMsg.message_type;
      uiMessage.mediaUri = dbMsg.media_uri;
      uiMessage.mediaType = dbMsg.media_type;
      uiMessage.mediaMetadata = dbMsg.media_metadata;
    }

    return uiMessage;
  };

  // 加载聊天历史。
  useEffect(() => {
    const loadChatHistory = async () => {
      // 特殊处理：机器人会话不从数据库加载历史，直接监听通道消息。
      if (isBotConversation) {
        setLoading(false);
        return;
      }

      // 普通好友会话：从数据库加载历史记录。
      try {
        setLoading(true);

        // 获取当前用户 ID。
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);

          // 计算会话 ID。
          const convId = session.user.id < friendId
            ? `${session.user.id}_${friendId}`
            : `${friendId}_${session.user.id}`;
          setConversationId(convId);
        }

        const history = await getChatHistory(friendId);
        const uiMessages = history.map(convertDbMessageToUI);
        setMessages(uiMessages);

        // 标记消息为已读。
        await markMessagesAsRead(friendId);
      } catch (error) {
        // 使用统一错误处理器。
        handleError(error, '加载聊天记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [friendId, isBotConversation]);

  // 监听 Clawbot Channel 消息。
  useEffect(() => {
    if (!isBotConversation) return;

    // 从 context 获取最新消息。
    setMessages(clawbotMessages.map(msg => ({
      id: msg.id || `bot-${msg.timestamp}`,
      sender: msg.sender,
      text: typeof msg.content === 'string' ? msg.content : '',
      timestamp: formatTime(new Date(msg.timestamp)),
      messageType: msg.contentType === 'file' ? 'image' : msg.contentType || 'text',
      mediaUri: msg.mediaUrl
    })));

    return () => {
      // Cleanup
    };
  }, [isBotConversation, clawbotMessages]);

  // 实时订阅新消息。
  useEffect(() => {
    // 如果没有会话 ID，则跳过订阅。
    if (!conversationId) {
      return;
    }

    // 1) 创建频道。
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: {
        broadcast: { self: false }
      }
    });
    channelRef.current = channel;

    // 2) 绑定事件。
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;

          // 鎵嬪姩杩囨护閫昏緫
          if (newMessage.conversation_id !== conversationId) {
            return;
          }

          // 只有当消息不是当前用户发送时，才加入消息列表。
          if (newMessage.sender_id !== currentUserId) {
            // 使用函数式更新，避免将 messages 放入依赖数组。
            setMessages((prev) => {
              // Prevent duplicate additions
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }

              const uiMessage: UIMessage = {
                id: newMessage.id,
                sender: 'friend',
                text: newMessage.text || '',
                timestamp: formatTime(newMessage.created_at)
              };

              // 处理媒体消息类型（包括语音）
              if (newMessage.message_type && newMessage.message_type !== 'text') {
                uiMessage.messageType = newMessage.message_type;
                uiMessage.mediaUri = newMessage.media_uri;
                uiMessage.mediaType = newMessage.media_type;
                uiMessage.mediaMetadata = newMessage.media_metadata;
              }

              return [...prev, uiMessage];
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Subscription successful
        } else if (status === 'CHANNEL_ERROR') {
          logger.chat.error('频道错误');
        } else if (status === 'TIMED_OUT') {
          logger.chat.error('连接超时');
        } else if (status === 'CLOSED') {
          // Connection closed
        }
      });

    // 3. conversationId 变化或组件卸载时清理订阅
    return () => {
      // 使用 channelRef.current 确保清理正确的频道
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // 关键：依赖数组只保留 conversationId，避免重复订阅
  }, [conversationId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ESC 閿叧闂彍鍗?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMenu) {
        setShowMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMenu]);


  const handleSend = async (overrideText?: string) => {
    // 检查是否有媒体或文本
    const draftText = String(overrideText ?? input ?? '');
    const hasMedia = attachmentPreviews.length > 0;
    const hasText = draftText.trim().length > 0;

    if (!hasMedia && !hasText) return;

    const messageText = draftText.trim();

    // 从 attachmentPreviews 获取媒体数据（使用第一个）
    const mediaData = hasMedia ? attachmentPreviews[0] : null;

    // 特殊处理：机器人会话直接发送到对应 Bridge，不保存到 Supabase
    if (isBotConversation) {
      const botContentType: 'text' | 'image' | 'mixed' = hasMedia
        ? (hasText ? 'mixed' : 'image')
        : 'text';

      const tempUserMessage: UIMessage = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        text: messageText,
        timestamp: formatTime(new Date()),
        messageType: botContentType,
        mediaUri: mediaData?.uri,
        mediaType: mediaData?.type,
      };

      try {
        // 清空输入
        setInput('');
        setAttachmentPreviews([]);

        // 临时显示用户消息(乐观更新 UI)
        setMessages(prev => [...prev, tempUserMessage]);

        // 使用 ClawbotChannelContext 发送消息
        await clawbotSendMessage(
          messageText,
          botContentType,
          mediaData?.uri,
          mediaData?.type
        );
      } catch (error) {
        logger.chat.error('Bot 消息发送失败:', error);
        showError('发送失败，请重试');

        // 发送失败，移除临时消息
        setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      }
      return;
    }

    // 普通好友：保存到 Supabase（现有逻辑）
    setInput('');
    setAttachmentPreviews([]);

    const timeString = formatTime(new Date());

    // Determine message type
    const messageType: 'text' | 'image' | 'video' | 'mixed' = hasMedia && hasText
      ? 'mixed'
      : hasMedia
        ? (mediaData?.category === 'image' ? 'image' : 'video')
        : 'text';

    // 临时显示用户消息(乐观更新 UI)
    const tempUserMessage: UIMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: timeString,
      messageType,
      mediaUri: mediaData?.uri,
      mediaType: mediaData?.type,
      mediaMetadata: mediaData?.metadata,
    };

    setMessages(prev => [...prev, tempUserMessage]);

    // 保存用户消息到数据库
    try {
      let messageId: string | null = null;

      if (hasMedia) {
        if (!mediaData) {
          throw new Error('Media data is required when hasMedia is true');
        }
        messageId = await sendMessageWithMedia(
          friendId,
          'user',
          messageText,
          {
            uri: mediaData.uri,
            type: mediaData.type,
            size: mediaData.size ?? 0,
            category: mediaData.category,
            metadata: mediaData.metadata ?? {},
          },
          messageType as 'image' | 'video' | 'mixed'
        );
      } else {
        messageId = await dbSendMessage(friendId, 'user', messageText);
      }

      // 用真实数据库 ID 替换临时 ID
      if (messageId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempUserMessage.id
              ? { ...msg, id: messageId }
              : msg
          )
        );
      }
    } catch (error) {
      logger.chat.error('保存用户消息失败:', error);
      // 发送失败，移除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      showError('发送消息失败，请检查网络连接');
    }

    // 对于好友聊天，好友回复会通过实时订阅自动显示
  };

  // 处理语音消息发送
  const handleVoiceSend = async (audioBlob: Blob, duration: number) => {
    // 机器人会话不支持语音消息
    if (isBotConversation) {
      showError('Clawbot 暂不支持语音消息');
      return;
    }

    setIsUploadingVoice(true);
    setShowVoiceRecorder(false);

    try {
      // 将 Blob 转换为 File
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: audioBlob.type || 'audio/webm'
      });

      // 上传音频文件
      const result = await uploadAudio(audioFile);

      const timeString = formatTime(new Date());

      // 临时显示用户消息(乐观更新 UI)
      const tempUserMessage: UIMessage = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        text: '',
        timestamp: timeString,
        messageType: 'voice',
        mediaUri: result.uri,
        mediaType: result.type,
        mediaMetadata: { duration },
      };

      setMessages(prev => [...prev, tempUserMessage]);

      // 保存语音消息到数据库
      const messageId = await sendMessageWithMedia(
        friendId,
        'user',
        '',
        {
          uri: result.uri,
          type: result.type,
          size: result.size,
          category: 'audio',
          metadata: { duration },
        },
        'voice'
      );

      // 用真实数据库 ID 替换临时 ID
      if (messageId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempUserMessage.id
              ? { ...msg, id: messageId }
              : msg
          )
        );
      }
    } catch (error) {
      logger.chat.error('发送语音消息失败:', error);
      showError('发送语音消息失败，请重试');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // 快照入口：图片预览就绪后自动发送一次到 Clawbot
  useEffect(() => {
    if (!autoSendPrompt || autoSendTriggeredRef.current) return;
    if (!isBotConversation || !isPaired) return;

    const mediaReady = !photoUri || attachmentPreviews.some(preview => preview.uri === photoUri);
    if (!mediaReady) return;

    autoSendTriggeredRef.current = true;
    void handleSend(autoSendPrompt);
  }, [autoSendPrompt, isBotConversation, isPaired, attachmentPreviews, photoUri]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);

      const category = file.type.startsWith('image/') ? 'image' : 'video';
      if (isBotConversation) {
        if (category !== 'image') {
          throw new Error('Clawbot 当前仅支持图片附件');
        }

        if (isServerOssUploadEnabled()) {
          // Compress image before upload for better performance
          let fileToUpload = file;
          try {
            fileToUpload = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
          } catch (compressError) {
            console.warn('[Upload] Compression failed, using original:', compressError);
          }

          const result = await uploadFileToServerOss(fileToUpload);
          setAttachmentPreviews(prev => [...prev, {
            uri: result.url,
            type: result.mimeType,
            size: result.size,
            category: 'image',
            metadata: {}
          }]);
          return;
        }
      }

      const result = await uploadFile(file, category);

      // Add to preview list (including media metadata)?
      setAttachmentPreviews(prev => [...prev, {
        uri: result.uri,
        type: result.type,
        size: result.size,
        category,
        metadata: result.metadata
      }]);

    } catch (error) {
      // 使用统一错误处理器。
      handleError(error, '文件上传失败，请重试');
      // 清理状态，避免上传失败后残留预览。
      setAttachmentPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // 澶勭悊鏂囦欢閫夋嫨
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // 重置 input，允许再次选择同一文件。
    e.target.value = '';
  };

  const getStatusColor = () => {
    if (!isBotConversation) return 'bg-green-500';

    switch (status) {
      case 'CONNECTED': return 'bg-green-500';
      case 'CONNECTING':
      case 'RECONNECTING': return 'bg-yellow-500 animate-pulse';
      case 'ERROR': return 'bg-red-500';
      case 'DISCONNECTED':
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'CONNECTED': return 'Online';
      case 'CONNECTING':
      case 'RECONNECTING': return 'Connecting...';
      case 'ERROR': return 'Error';
      case 'DISCONNECTED':
      default: return 'Offline';
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 font-sans dark:bg-slate-950">
      <header className="z-40 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-4 pt-12 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors duration-200 hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-200" />
          </button>

          <div className="flex items-center gap-3">
            <div className="relative">
              {isBot ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800">
                  <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="relative">
                  <Avatar name={name} avatar={avatar} size="md" />
                </div>
              )}
              <div
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${getStatusColor()}`}
              />
            </div>

            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">{name}</h1>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {isBot ? getStatusText() : 'Online'}
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label="更多选项"
            aria-expanded={showMenu}
            aria-haspopup="true"
          >
            <MoreVertical size={20} className="text-slate-700 dark:text-slate-200" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 z-40"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                  {isBotConversation && isPaired && (
                    <>
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Clawbot 配对管理</p>
                      </div>
                      <button
                        onClick={async () => {
                          const accepted = await requestConfirm({
                            title: '解除 Clawbot 配对',
                            message: '确定要取消与 Clawbot 的配对吗？\n\n取消后需要重新配对才能继续使用。',
                            confirmText: '解除配对',
                            cancelText: '保留配对',
                            variant: 'danger',
                          });
                          if (!accepted) return;

                          unpair();
                          setShowMenu(false);
                          navigate('/chat');
                          showSuccess('配对已取消，你可以重新进入配对页连接新的 Clawbot');
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <X size={18} />
                        <span className="font-medium">解除配对</span>
                      </button>
                    </>
                  )}

                  {!isBot && (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      聊天设置
                    </div>
                  )}

                  {isBotConversation && !isPaired && (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      <p className="text-xs">当前未配对</p>
                      <p className="mt-1 text-xs">请在 Clawbot 端发起配对</p>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/60 px-4 py-6 pb-6 dark:bg-slate-900/40">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500 animate-pulse dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              加载聊天记录中...
            </span>
          </div>
        ) : (
          <>
            <div className="my-4 text-center text-xs text-slate-400 dark:text-slate-500">Today</div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`group flex animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender !== 'user' && (
                  <div className="mr-2 mt-auto shrink-0">
                    {isBot ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <Avatar name={name} avatar={avatar} size="xs" />
                    )}
                  </div>
                )}

                <div className="flex max-w-[75%] flex-col gap-1">
                  
                  {/* 图片/视频消息 - 接收者 */}
                  {msg.mediaUri && msg.sender !== 'user' && msg.messageType !== 'voice' && (
                    <div className="mb-1 overflow-hidden rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800">
                      <MediaMessage
                        uri={msg.mediaUri}
                        type={msg.messageType === 'video' || msg.mediaUri?.endsWith('.mp4') || msg.mediaUri?.endsWith('.webm') || msg.mediaUri?.endsWith('.mov') ? 'video' : 'image'}
                        alt="Attachment"
                        maxSize="sm"
                        className="w-full max-w-[240px] h-auto object-cover"
                      />
                    </div>
                  )}

                  {/* 图片/视频消息 - 发送者 */}
                  {msg.mediaUri && msg.sender === 'user' && msg.messageType !== 'voice' && (
                    <div className="mb-1 flex justify-end">
                      <div className="relative overflow-hidden rounded-2xl rounded-tr-sm bg-slate-100 dark:bg-slate-800 shadow-sm">
                        {msg.messageType === 'video' || msg.mediaUri?.endsWith('.mp4') || msg.mediaUri?.endsWith('.webm') || msg.mediaUri?.endsWith('.mov') ? (
                          <video src={msg.mediaUri} className="max-w-[240px] max-h-[300px] object-cover" controls />
                        ) : (
                          <img src={msg.mediaUri} alt="Attachment" className="max-w-[240px] max-h-[240px] object-cover" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bubble for Voice or Text */}
                  {(msg.messageType === 'voice' || (msg.text && typeof msg.text === 'string' && msg.text !== '[object Object]')) && (
                    <div
                      className={`relative px-4 py-3 text-sm leading-relaxed transition-all duration-200 ${
                        msg.sender === 'user'
                          ? 'rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm'
                          : 'rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {/* 语音消息 */}
                      {msg.messageType === 'voice' && msg.mediaUri && (
                        <div className="-mx-2 -my-1">
                          <VoiceMessage
                            url={msg.mediaUri}
                            duration={msg.mediaMetadata?.duration || 0}
                            variant={msg.sender === 'user' ? 'sender' : 'receiver'}
                          />
                        </div>
                      )}
                      
                      {/* 文本消息 */}
                      {msg.text && typeof msg.text === 'string' && msg.text !== '[object Object]' && (
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      )}
                    </div>
                  )}
                  <span
                    className={`px-1 text-[10px] text-slate-400 dark:text-slate-500 ${
                      msg.sender === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isBotConversation && botState === 'THINKING' && (
              <div className="group flex animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start">
                <div className="mr-2 mt-auto shrink-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="flex max-w-[75%] flex-col gap-1">
                  <div className="relative px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce dark:bg-slate-300"
                          style={{ animationDelay: `${index * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isBot && status === 'CONNECTING' && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500 animate-pulse dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Connecting to Secure Gateway...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-6 pt-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto max-w-lg">
          <AnimatePresence>
            {attachmentPreviews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-2"
              >
                <div className="flex flex-wrap gap-2">
                  {attachmentPreviews.map((preview, index) => (
                    <div key={index} className="relative shrink-0">
                      <div className="h-[80px] w-[80px] overflow-hidden rounded-lg border-2 border-slate-300 shadow-lg dark:border-slate-600">
                        {preview.category === 'video' ? (
                          <video
                            src={preview.uri}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={preview.uri}
                            alt={`附件预览 ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const nextPreviews = attachmentPreviews.filter((_, i) => i !== index);
                          setAttachmentPreviews(nextPreviews);
                        }}
                        className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow-md transition-colors hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        aria-label="删除附件"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex flex-col gap-2 rounded-3xl bg-slate-100 p-2 transition-all duration-300 dark:bg-slate-800 ${isInputFocused || input.trim().length > 0 ? "shadow-md" : ""}`}>
            <AnimatePresence>
              {(isInputFocused || input.trim().length > 0 || attachmentPreviews.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden px-1"
                >
                  <AIActionSelector
                    value={selectedAIAction}
                    onSelect={(action) => {
                      setSelectedAIAction(action);
                      setInput((previous) => applyAIActionPrefix(previous, action));
                      setIsInputFocused(true);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label="添加附件"
              >
                <span className="text-xl text-slate-600 dark:text-slate-200" style={{ lineHeight: '1' }}>+</span>
              </button>

              <textarea
                value={isListening ? transcript : input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsInputFocused(false), 200);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? 'Listening...' : '输入消息，或使用 AI 指令'}
                rows={isInputFocused || input.trim().length > 0 ? 4 : 1}
                className="flex-1 resize-none rounded-xl border-0 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 transition-all dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                style={{ 
                  minHeight: isInputFocused || input.trim().length > 0 ? '96px' : '32px',
                  maxHeight: '160px'
                }}
              />

              {isSpeechSupported && isBotConversation && (
                <button
                  onClick={() => (isListening ? stopListening() : startListening())}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                    isListening
                      ? 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
                      : 'bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                  }`}
                  aria-label={isListening ? '停止语音输入' : '开始语音输入'}
                >
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}

              {/* 语音录制按钮 - 仅在非机器人会话显示 */}
              {!isBotConversation && (
                <button
                  onClick={() => setShowVoiceRecorder(true)}
                  disabled={isUploadingVoice}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                    isUploadingVoice
                      ? 'bg-slate-300 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                  }`}
                  aria-label="录制语音消息"
                >
                  {isUploadingVoice ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-400" />
                  ) : (
                    <Mic size={14} />
                  )}
                </button>
              )}

              <button
                onClick={handleSend}
                disabled={
                  (!input.trim() && attachmentPreviews.length === 0) ||
                  (isBotConversation && !isPaired) ||
                  uploadingFile
                }
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  input.trim() || attachmentPreviews.length > 0
                    ? 'bg-black text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500'
                    : 'bg-slate-300 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                }`}
                aria-label="发送消息"
              >
                {uploadingFile ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send size={14} className={input.trim() ? '-rotate-45 transition-transform' : 'transition-transform'} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModalRenderer />

      {/* 语音录制弹窗 */}
      <VoiceRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onComplete={handleVoiceSend}
      />
    </div>
  );
};

export default ChatDetail;











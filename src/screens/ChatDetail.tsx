import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { IMAGES } from '../constants';
import { useNotification } from '../hooks/useNotification';
import { useErrorHandler } from '../utils/errorHandler';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useConfirmModal } from '../hooks/useConfirmModal';
import VoiceRecorder from '../components/VoiceRecorder';
import { uploadAudio } from '../services/uploadService';
import {
  AIActionId,
  detectAIActionFromInput,
} from '../features/chat/utils/aiPrompt';
import { getChatHistory, sendMessage as dbSendMessage, sendMessageWithMedia, markMessagesAsRead, getFriendById } from '../services/databaseService';
import { uploadFile, IMAGE_COMPRESSION_OPTIONS, resolveFileCategory } from '../services/uploadService';
import imageCompression from 'browser-image-compression';
import { supabase, getUsersLastActive } from '../config/supabase';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import type { ChatMessage } from '../config/supabase';
import { formatTime } from '../utils/dateFormat';
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

// UI Message interface
interface UIAttachment {
  id?: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  uri: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
  mediaUri?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
  attachments?: UIAttachment[];
}

// 从路由参数中接收附件预览状态（包含完整媒体信息）。
interface AttachmentPreview {
  uri: string;
  type: string;
  size?: number;
  category: 'image' | 'video' | 'audio' | 'file';
  uploadId?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
}

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { showError, showSuccess, showWarning } = useNotification();
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
    name: stateData.name || 'TRIX 原生助手',
    avatar: stateData.avatar || IMAGES.WIZARD_BOY_LOGIN,
    isBot: stateData.isBot ?? true,
    friendId: urlFriendId || stateData.friendId || 'clawbot',
    photoUri: stateData.photoUri || null
  });

  const { name, avatar, isBot, friendId, photoUri } = friendData;
  const isBotConversation = friendId === 'clawbot' || friendId === 'clawbot_channel';

  const [friendLastActive, setFriendLastActive] = useState<string | null>(null);

  // 获取好友最后活跃时间（如果不是机器人）
  useEffect(() => {
    if (isBotConversation) return;

    const fetchActiveTime = async () => {
      try {
        const times = await getUsersLastActive([friendId]);
        if (times && times[friendId] !== undefined) {
          setFriendLastActive(times[friendId]);
        }
      } catch (err) {
        // ignore
      }
    };

    fetchActiveTime();
    const interval = setInterval(fetchActiveTime, 30000);
    return () => clearInterval(interval);
  }, [friendId, isBotConversation]);

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
      handleError(error, '加载好友信息失败');
    }
  };

  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);

  // Clawbot Channel connection
  const {
    messages: clawbotMessages,
    sendMessage: clawbotSendMessage,
    uploadAttachment,
    isPaired,
    botOnline,
    unpair,
    status,
    botState,
  } = useClawbotChannel();

  // 菜单显示状态
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
      if (err.includes('网络错误') || err.includes('network')) {
        showWarning('语音识别网络错误。国内访问Chrome内置识别可能需要代理，或尝试使用Edge浏览器。');
      } else {
        showError(`语音识别失败: ${err}`);
      }
      setIsInputFocused(true);
    }
  });

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedAIAction, setSelectedAIAction] = useState<AIActionId>('chat');
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  // 分页加载状态
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      uiMessage.mediaSize = dbMsg.media_size;
      uiMessage.mediaMetadata = dbMsg.media_metadata;
    }

    return uiMessage;
  };

  // 加载聊天历史。
  useEffect(() => {
    isFirstScrollRef.current = true;
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

        const result = await getChatHistory(friendId);
        const uiMessages = result.messages.map(convertDbMessageToUI);
        setMessages(uiMessages);
        setHasMoreMessages(result.hasMore);

        // 标记消息为已读。
        await markMessagesAsRead(friendId);
      } catch (error) {
        handleError(error, '加载聊天记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [friendId, isBotConversation]);

  // 加载更多历史消息
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) {
      return;
    }

    // 获取最早消息的时间戳
    const earliestMessage = messages[0];
    if (!earliestMessage?.timestamp) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const result = await getChatHistory(friendId, {
        beforeTimestamp: earliestMessage.timestamp,
        limit: 50,
      });

      if (result.messages.length > 0) {
        const uiMessages = result.messages.map(convertDbMessageToUI);
        // 将新消息添加到列表开头
        setMessages((prev) => [...uiMessages, ...prev]);
        setHasMoreMessages(result.hasMore);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      handleError(error, '加载更多消息失败');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 监听 Clawbot Channel 消息。
  useEffect(() => {
    if (!isBotConversation) return;

    // 从 context 获取最新消息。
    setMessages(clawbotMessages.map((msg) => ({
      id: msg.id || `bot-${msg.timestamp}`,
      sender: msg.sender,
      text: typeof msg.content === 'string' ? msg.content : '',
      timestamp: formatTime(new Date(msg.timestamp)),
      messageType: msg.contentType || 'text',
      mediaUri: msg.mediaUrl,
      mediaType: msg.mediaMimeType,
      mediaSize: typeof msg.mediaMetadata?.size === 'number' ? msg.mediaMetadata.size : undefined,
      mediaMetadata: msg.mediaMetadata,
      attachments: msg.attachments?.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        uri: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        size: attachment.size,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration,
      })),
    })));

    return () => {
      // Cleanup
    };
  }, [isBotConversation, clawbotMessages]);

  // 实时订阅新消息。
  useEffect(() => {
    // 如果没有会话 ID 或用户 ID，则跳过订阅。
    if (!conversationId || !currentUserId) {
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

          // 手动过滤逻辑
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
                uiMessage.mediaSize = newMessage.media_size;
                uiMessage.mediaMetadata = newMessage.media_metadata;
              }

              return [...prev, uiMessage];
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // WebSocket 订阅成功
        } else if (status === 'CHANNEL_ERROR') {
          // 频道错误
        } else if (status === 'TIMED_OUT') {
          // 连接超时
        } else if (status === 'CLOSED') {
          // WebSocket 连接关闭
        }
      });

    // 3. conversationId 变化或组件卸载时清理订阅
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUserId]);

  const isFirstScrollRef = useRef(true);

  // 滚动到底部逻辑
  useEffect(() => {
    if (loading) return;

    const scroll = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: isFirstScrollRef.current ? 'auto' : 'smooth'
        });
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: isFirstScrollRef.current ? 'auto' : 'smooth'
        });
      }
    };

    scroll();

    const timers = [
      setTimeout(() => {
        scroll();
        if (messages.length > 0) {
          isFirstScrollRef.current = false;
        }
      }, 50),
      setTimeout(scroll, 150),
      setTimeout(scroll, 350)
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [messages, loading]);

  // ESC 键关闭菜单
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

    // 特殊处理：机器人会话直接发送到新原生通道，不保存到 Supabase
    if (isBotConversation) {
      const nativeAttachments = attachmentPreviews.map((preview) => ({
        uploadId: preview.uploadId,
        kind: preview.category,
        url: preview.uri,
        mimeType: preview.type,
        fileName: preview.metadata?.originalName,
        size: preview.size,
        width: preview.metadata?.width,
        height: preview.metadata?.height,
        duration: preview.metadata?.duration,
      }));

      const botContentType: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice' = hasMedia
        ? nativeAttachments.length === 1 && nativeAttachments[0]?.kind === 'audio' && !hasText
          ? 'voice'
          : nativeAttachments.length > 1 || hasText
            ? 'mixed'
            : (nativeAttachments[0]?.kind === 'audio'
                ? 'voice'
                : nativeAttachments[0]?.kind === 'file'
                  ? 'file'
                  : nativeAttachments[0]?.kind || 'image')
        : 'text';

      try {
        setInput('');
        setAttachmentPreviews([]);
        await clawbotSendMessage(
          messageText,
          botContentType,
          mediaData?.uri,
          mediaData?.type,
          mediaData?.metadata,
          nativeAttachments,
        );
      } catch (error) {
        showError('发送失败，请重试');
      }
      return;
    }

    // 普通好友：保存到 Supabase（现有逻辑）
    setInput('');
    setAttachmentPreviews([]);

    const timeString = formatTime(new Date());

    // Determine message type
    const messageType: 'text' | 'image' | 'video' | 'file' | 'mixed' = hasMedia && mediaData?.category === 'file'
      ? 'file'
      : hasMedia && hasText
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
      mediaSize: mediaData?.size,
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
          messageType as 'image' | 'video' | 'file' | 'mixed'
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
      // 发送失败，移除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      showError('发送消息失败，请检查网络连接');
    }
  };

  // 处理语音消息发送
  const handleVoiceSend = async (audioBlob: Blob, duration: number) => {
    setIsUploadingVoice(true);
    setShowVoiceRecorder(false);

    try {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: audioBlob.type || 'audio/webm',
      });

      if (isBotConversation) {
        const uploaded = await uploadAttachment(audioFile, { kind: 'audio', fileName: audioFile.name });
        await clawbotSendMessage(
          '',
          'voice',
          uploaded.url,
          uploaded.mimeType,
          {
            duration,
            originalName: uploaded.fileName,
            size: uploaded.size,
          },
          [{
            uploadId: uploaded.attachmentId,
            kind: 'audio',
            url: uploaded.url,
            mimeType: uploaded.mimeType,
            fileName: uploaded.fileName,
            size: uploaded.size,
            duration,
          }],
        );
        return;
      }

      const result = await uploadAudio(audioFile);
      const timeString = formatTime(new Date());

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
        'voice',
      );

      if (messageId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempUserMessage.id
              ? { ...msg, id: messageId }
              : msg,
          ),
        );
      }
    } catch (error) {
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

      const uploadCategory = resolveFileCategory(file);
      if (!uploadCategory) {
        throw new Error('不支持的文件类型');
      }

      const previewCategory: AttachmentPreview['category'] = uploadCategory === 'image' || uploadCategory === 'video' || uploadCategory === 'audio'
        ? uploadCategory
        : 'file';

      if (isBotConversation) {
        let fileToUpload = file;
        if (uploadCategory === 'image') {
          try {
            fileToUpload = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
          } catch (compressError) {
            // Compression failed, using original
          }
        }

        const uploaded = await uploadAttachment(fileToUpload, {
          fileName: file.name,
          kind: previewCategory === 'audio' ? 'audio' : previewCategory,
        });
        setAttachmentPreviews(prev => [...prev, {
          uri: uploaded.url,
          type: uploaded.mimeType,
          size: uploaded.size,
          category: uploaded.kind,
          uploadId: uploaded.attachmentId,
          metadata: {
            originalName: uploaded.fileName,
            size: uploaded.size,
            width: uploaded.width,
            height: uploaded.height,
            duration: uploaded.duration,
          }
        }]);
        return;
      }

      const result = await uploadFile(file, uploadCategory);

      setAttachmentPreviews(prev => [...prev, {
        uri: result.uri,
        type: result.type,
        size: result.size,
        category: previewCategory,
        metadata: {
          ...(result.metadata ?? {}),
          originalName: result.metadata?.originalName || file.name,
          size: result.size,
        }
      }]);

    } catch (error) {
      handleError(error, '文件上传失败，请重试');
      setAttachmentPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // 处理文件选择（支持多附件）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await handleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAIActionSelect = (action: AIActionId) => {
    setSelectedAIAction(action);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 font-sans dark:bg-slate-950">
      <ChatHeader
        name={name}
        avatar={avatar}
        isBot={isBot}
        isBotConversation={isBotConversation}
        isPaired={isPaired}
        botOnline={botOnline}
        status={status}
        botState={botState}
        friendLastActive={friendLastActive}
        onNavigateBack={() => navigate(-1)}
        onToggleMenu={() => setShowMenu(!showMenu)}
        showMenu={showMenu}
        onUnpair={() => {
          unpair();
          setShowMenu(false);
          navigate('/chat');
        }}
        onRequestConfirm={requestConfirm}
        onShowSuccess={showSuccess}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-6 overflow-y-auto bg-slate-50/60 px-4 py-6 pb-6 dark:bg-slate-900/40"
      >
        <MessageList
          messages={messages}
          loading={loading}
          hasMoreMessages={hasMoreMessages}
          isLoadingMore={isLoadingMore}
          isBot={isBot}
          isBotConversation={isBotConversation}
          botState={botState}
          status={status}
          name={name}
          avatar={avatar}
          onLoadMore={loadMoreMessages}
          ref={messagesEndRef}
        />
      </div>

      <MessageInput
        input={input}
        isInputFocused={isInputFocused}
        isListening={isListening}
        transcript={transcript}
        isSpeechSupported={isSpeechSupported}
        isBotConversation={isBotConversation}
        isPaired={isPaired}
        uploadingFile={uploadingFile}
        attachmentPreviews={attachmentPreviews}
        selectedAIAction={selectedAIAction}
        onInputChange={setInput}
        onInputFocus={() => setIsInputFocused(true)}
        onInputBlur={() => setIsInputFocused(false)}
        onSend={() => handleSend()}
        onFileSelect={handleFileSelect}
        onStartListening={startListening}
        onStopListening={stopListening}
        onToggleVoiceRecorder={() => setShowVoiceRecorder(true)}
        onRemoveAttachment={handleRemoveAttachment}
        onAIActionSelect={handleAIActionSelect}
        fileInputRef={fileInputRef}
        isUploadingVoice={isUploadingVoice}
      />

      <ConfirmModalRenderer />

      {/* 语音录制弹窗 (真人好友会话) */}
      <VoiceRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onComplete={handleVoiceSend}
      />
    </div>
  );
};

export default ChatDetail;

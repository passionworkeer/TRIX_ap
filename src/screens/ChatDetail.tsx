import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Mic, MicOff, MoreVertical, Bot, X } from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { IMAGES } from '../constants';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useNotification } from '../hooks/useNotification';
import { useErrorHandler } from '../utils/errorHandler';
import { formatTime } from '../utils/dateFormat';
import Avatar from '../components/Avatar';
import MediaMessage from '../components/MediaMessage';
import AIActionSelector from '../components/AIActionSelector';
import { getChatHistory, sendMessage as dbSendMessage, sendMessageWithMedia, markMessagesAsRead, getFriendById } from '../services/databaseService';
import { uploadFile } from '../services/uploadService';
import { supabase } from '../config/supabase';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import type { ChatMessage } from '../config/supabase';

// UI Message interface
interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'mixed';
  mediaUri?: string;
  mediaType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

// Mock conversations - 已删除,使用数据库数据替代

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { showError } = useNotification();
  const { handleError } = useErrorHandler();

  // 优先从 URL 参数获取 friendId，否则从 location.state 获取
  const urlFriendId = params.friendId;
  const stateData = location.state || {};

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

  // 如果有 URL 参数且不是 state，从数据库加载好友信息
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
      // 使用统一的错误处理器
      handleError(error, '加载好友信息失败');
    }
  };

  // 从路由参数接收到的图片预览状态（包含完整媒体数据）
  interface AttachmentPreview {
    uri: string;
    type: string;
    size?: number;
    category: 'image' | 'video';
    metadata?: any;
  }

  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);

  // Clawbot Channel connection
  const { messages: clawbotMessages, sendMessage: clawbotSendMessage, isPaired, unpair, status } = useClawbotChannel();

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
      console.error('Speech error:', err);
    }
  });

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // 文件输入引用

  // 当 photoUri 改变时，添加到图片列表
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

  // 🔌 Realtime Channel 引用 (防止重复连接)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 组件卸载时确保清理所有订阅
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

  // 转换数据库消息为 UI 消息
  const convertDbMessageToUI = (dbMsg: ChatMessage): UIMessage => {
    const uiMessage: UIMessage = {
      id: dbMsg.id,
      sender: dbMsg.sender,
      text: dbMsg.text,
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

  // 加载聊天历史
  useEffect(() => {
    const loadChatHistory = async () => {
      // 特殊处理：机器人会话不从数据库加载历史，直接监听消息通道
      if (isBotConversation) {
        setLoading(false);
        return;
      }

      // 📝 普通好友：从数据库加载历史（现有逻辑）
      try {
        setLoading(true);

        // 获取当前用户ID（用于测试模式显示）
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);

          // 计算会话ID
          const convId = session.user.id < friendId
            ? `${session.user.id}_${friendId}`
            : `${friendId}_${session.user.id}`;
          setConversationId(convId);
        }

        const history = await getChatHistory(friendId);
        const uiMessages = history.map(convertDbMessageToUI);
        setMessages(uiMessages);

        // 标记消息为已读
        await markMessagesAsRead(friendId);
      } catch (error) {
        // 使用统一的错误处理器
        handleError(error, '加载聊天记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [friendId, isBotConversation]);

  // 监听 Clawbot Channel 消息
  useEffect(() => {
    if (!isBotConversation) return;

    // 从 context 获取最新消息
    setMessages(clawbotMessages.map(msg => ({
      id: msg.id || `bot-${msg.timestamp}`,
      sender: msg.sender,
      text: msg.content,
      timestamp: formatTime(new Date(msg.timestamp)),
      messageType: msg.contentType === 'file' ? 'image' : msg.contentType || 'text',
      mediaUri: msg.mediaUrl
    })));

    return () => {
      // Cleanup
    };
  }, [isBotConversation, clawbotMessages]);

  // 实时订阅新消息 - 防抖动标准写法
  useEffect(() => {
    // 如果没有会话ID,则跳过
    if (!conversationId) {
      return;
    }

    // 1️⃣ 创建频道
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: {
        broadcast: { self: false }
      }
    });
    channelRef.current = channel;

    // 2️⃣ 绑定事件 (无 filter,手动过滤)
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

          // 只有当消息不是当前用户发送的,才添加到消息列表
          if (newMessage.sender_id !== currentUserId) {
            // 使用函数式更新,不需要将 messages 加入依赖数组
            setMessages((prev) => {
              // 防止重复添加
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }

              const uiMessage: UIMessage = {
                id: newMessage.id,
                sender: 'friend',
                text: newMessage.text,
                timestamp: formatTime(newMessage.created_at)
              };

              return [...prev, uiMessage];
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Subscription successful
        } else if (status === 'CHANNEL_ERROR') {
          console.error('频道错误');
        } else if (status === 'TIMED_OUT') {
          console.error('连接超时');
        } else if (status === 'CLOSED') {
          // Connection closed
        }
      });

    // 3️⃣ 清理函数：conversationId 改变或组件卸载时都会执行
    return () => {
      // 使用 channelRef.current 确保清理正确的频道
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // ⚠️ 致命关键：依赖数组里只有 conversationId！绝对不能有 messages！
  }, [conversationId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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


  const handleSend = async () => {
    // 检查是否有媒体或文字
    const hasMedia = attachmentPreviews.length > 0;
    const hasText = input.trim();

    if (!hasMedia && !hasText) return;

    const messageText = input;

    // 从 attachmentPreviews 获取媒体数据（使用第一个）
    const mediaData = hasMedia ? attachmentPreviews[0] : null;

    // ✨ 特殊处理：机器人会话直接发送到对应 Bridge，不保存到 Supabase
    if (isBotConversation) {
      const tempUserMessage: UIMessage = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        text: messageText,
        timestamp: formatTime(new Date()),
        messageType: hasMedia ? 'mixed' : 'text',
        mediaUri: mediaData?.uri,
        mediaType: mediaData?.type
      };

      try {
        // 清空输入
        setInput('');
        setAttachmentPreviews([]);

        // 临时显示用户消息(乐观更新UI)
        setMessages(prev => [...prev, tempUserMessage]);

        // 使用 ClawbotChannelContext 发送消息
        await clawbotSendMessage(
          messageText,
          hasMedia && mediaData?.type ? (mediaData.type as 'text' | 'image' | 'video' | 'file') : 'text',
          mediaData?.uri
        );

        // Message sent successfully
      } catch (error) {
        console.error('Bot 消息发送失败:', error);
        showError('发送失败，请重试');

        // 发送失败，移除临时消息
        setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      }
      return;
    }

    // 📝 普通好友：保存到 Supabase（现有逻辑）
    setInput(''); // Clear input
    setAttachmentPreviews([]); // Clear all attachment previews

    const timeString = formatTime(new Date());

    // Determine message type
    const messageType: 'text' | 'image' | 'video' | 'mixed' = hasMedia && hasText ? 'mixed'
      : hasMedia ? (mediaData?.category === 'image' ? 'image' : 'video')
      : 'text';

    // 临时显示用户消息(乐观更新UI)
    const tempUserMessage: UIMessage = {
      id: `temp-${Date.now()}`, // 临时 ID
      sender: 'user',
      text: messageText,
      timestamp: timeString,
      messageType,
      mediaUri: mediaData?.uri,
      mediaType: mediaData?.type,
      mediaMetadata: mediaData?.metadata
    };

    setMessages(prev => [...prev, tempUserMessage]);

    // 保存用户消息到数据库
    try {
      let messageId: string | null = null;

      if (hasMedia) {
        // Send message with media - 使用类型断言，因为 hasMedia 为 true 时 messageType 不会是 'text'
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
            metadata: mediaData.metadata ?? {}
          },
          messageType as 'image' | 'video' | 'mixed'
        );
      } else {
        // Send text-only message
        messageId = await dbSendMessage(friendId, 'user', messageText);
      }

      // 用真实的数据库 ID 替换临时 ID
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
      console.error('保存用户消息失败:', error);
      // 发送失败,移除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      showError('发送消息失败,请检查网络连接');
    }

    // 对于好友聊天,好友的回复会通过实时订阅自动显示
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);

      const category = file.type.startsWith('image/') ? 'image' : 'video';
      const result = await uploadFile(file, category);

      // 添加到预览列表（包含完整媒体数据）
      setAttachmentPreviews(prev => [...prev, {
        uri: result.uri,
        type: result.type,
        size: result.size,
        category,
        metadata: result.metadata
      }]);

    } catch (error) {
      // 使用统一的错误处理器
      handleError(error, '文件上传失败，请重试');
      // 清理状态，避免上传失败后预览残留
      setAttachmentPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // 重置 input，允许重复选择同一文件
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
    <div className="h-screen w-full bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="px-4 py-4 pt-16 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white/20 flex-shrink-0 z-40 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors border border-white/50 active:scale-95 duration-200"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              {isBot ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-200/50">
                  <Bot className="text-white" size={24} />
                </div>
              ) : (
                <div className="relative">
                   <Avatar name={name} avatar={avatar} size="md" />
                </div>
              )}
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor()}`}></div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="font-bold text-slate-800 text-sm">{name}</h1>
              <p className="text-[10px] text-slate-500 font-medium">
                {isBot ? getStatusText() : 'Online'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors border border-white/50"
            aria-label="更多选项"
            aria-expanded={showMenu}
            aria-haspopup="true"
          >
            <MoreVertical size={20} className="text-slate-700" />
          </button>

          {/* 下拉菜单 */}
          <AnimatePresence>
            {showMenu && (
              <>
                {/* 遮罩层 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 z-40"
                />

                {/* 菜单内容 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                >
                  {isBotConversation && isPaired && (
                    <>
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <p className="text-xs text-slate-500">Clawbot 配对管理</p>
                      </div>
                      <button
                        onClick={() => {
                          const confirmed = window.confirm('确定要取消与 Clawbot 的配对吗？\n\n取消后需要重新配对才能继续使用。');
                          if (confirmed) {
                            unpair();
                            setShowMenu(false);
                            // 导航回聊天列表
                            navigate('/chat');
                            // 提示用户
                            alert('配对已取消，您可以重新进入配对页面连接新的 Clawbot');
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <X size={18} />
                        <span className="font-medium">取消配对</span>
                      </button>
                    </>
                  )}

                  {!isBot && (
                    <div className="px-4 py-3 text-slate-500 text-sm">
                      聊天设置
                    </div>
                  )}

                  {isBotConversation && !isPaired && (
                    <div className="px-4 py-3 text-slate-500 text-sm">
                      <p className="text-xs">当前未配对</p>
                      <p className="text-xs mt-1">请在 Clawbot 端发起配对</p>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-6 bg-slate-50/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-slate-400 animate-pulse bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              加载聊天记录中...
            </span>
          </div>
        ) : (
          <>
            <div className="text-center text-xs text-slate-400 my-4">Today</div>
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            {msg.sender !== 'user' && (
              <div className="shrink-0 mr-2 mt-auto">
                {isBot ? (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px]">
                    <Bot size={14} />
                  </div>
                ) : (
                   <Avatar name={name} avatar={avatar} size="xs" />
                )}
              </div>
            )}
            
            <div className="flex flex-col gap-1 max-w-[75%]">
               <div
                className={`px-4 py-3 shadow-sm text-sm leading-relaxed relative transition-all duration-200 ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-[#F5F5F5] text-[#333333] border-0 rounded-2xl rounded-tl-sm'
                }`}
              >
                {/* Render media if present - 使用优化的缩略图样式 */}
                {msg.mediaUri && msg.sender !== 'user' && (
                  <div className="mb-2 -ml-2 -mt-2">
                    <MediaMessage
                      uri={msg.mediaUri}
                      type={msg.messageType === 'video' ? 'video' : 'image'}
                      alt="Attachment"
                      maxSize="sm"
                      className="rounded-lg"
                    />
                  </div>
                )}
                {/* 用户消息的媒体 - 使用 inline 样式带黑色外框 */}
                {msg.mediaUri && msg.sender === 'user' && (
                  <div className="mb-2 -mr-2 -mt-2">
                    <div className="relative w-[80px] h-[80px]">
                      <div className="absolute inset-0 rounded-lg border-2 border-white/30 overflow-hidden shadow-sm">
                        {msg.messageType === 'video' ? (
                          <video
                            src={msg.mediaUri}
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <img
                            src={msg.mediaUri}
                            alt="Attachment"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Render text if present */}
                {msg.text && (
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                )}
              </div>
              <span 
                className={`text-[10px] px-1 ${
                  msg.sender === 'user' ? 'text-right text-slate-400' : 'text-left text-slate-400'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        
        {isBot && status === 'CONNECTING' && (
            <div className="flex justify-center my-4">
                 <span className="text-xs text-slate-400 animate-pulse bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Connecting to Secure Gateway...</span>
            </div>
        )}
        
        <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area - 优化样式，图片和输入框融为一体 */}
      <div className="flex-shrink-0 px-4 py-3 pb-6 bg-white border-t border-gray-100">
          {/* 主容器 */}
          <div className="max-w-lg mx-auto">
            {/* 图片附件预览 - 在输入框内部上方 */}
            <AnimatePresence>
              {attachmentPreviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-2"
                >
                  <div className="flex gap-2 flex-wrap">
                    {attachmentPreviews.map((preview, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <div className="w-[80px] h-[80px] rounded-lg overflow-hidden border-2 border-black shadow-lg">
                          <img
                            src={preview.uri}
                            alt={`附件预览 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* 删除按钮 */}
                        <button
                          onClick={() => {
                            const newPreviews = attachmentPreviews.filter((_, i) => i !== index);
                            setAttachmentPreviews(newPreviews);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors z-10"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 输入框容器 */}
            <div className="bg-[#F5F5F5] rounded-2xl p-2">
              {/* 实际输入区域 */}
              <div className="flex items-end gap-2">
                {/* 隐藏的文件输入 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 添加按钮 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <span className="text-sm text-gray-600">+</span>
                </button>

                {/* 输入框 */}
                <input
                  type="text"
                  value={isListening ? transcript : input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Listening..." : "问我任何事，创造任何东西"}
                  className="flex-1 px-3 py-2 bg-white rounded-xl text-sm text-[#333333] placeholder:text-gray-500 border-0 outline-none"
                />

                {/* 麦克风按钮 */}
                {isSpeechSupported && (
                  <button
                    onClick={() => isListening ? stopListening() : startListening()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      isListening ? 'bg-gray-200 text-gray-600' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                )}

                {/* 发送按钮 */}
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachmentPreviews.length === 0) || (isBot && !isPaired && false) || uploadingFile}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    input.trim() || attachmentPreviews.length > 0
                      ? 'bg-black text-white hover:bg-gray-800 shadow-md'
                      : 'bg-gray-300 text-gray-400'
                  }`}
                >
                  {uploadingFile ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Send size={14} className={input.trim() ? '-rotate-45' : ''} />
                  )}
                </button>
              </div>
            </div>

            {/* AI 功能选择 - 在输入框下方，只要有图片就显示 */}
            <AnimatePresence>
              {attachmentPreviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2"
                >
                  <AIActionSelector
                    onSelect={(action: string) => {
                      // AI功能指令映射（使用特殊标记，clawbot端可以识别）
                      const aiPrompts: Record<string, string> = {
                        chat: '', // 默认聊天，无前缀
                        doc: '@AI_DOC 请帮我创建文档：',
                        slide: '@AI_SLIDE 请帮我创建幻灯片：',
                        table: '@AI_TABLE 请帮我创建表格：',
                        image: '@AI_IMAGE 请帮我生成图片：',
                        video: '@AI_VIDEO 请帮我生成视频：'
                      };

                      // 添加AI指令前缀
                      const prefix = aiPrompts[action] || '';
                      if (prefix) {
                        setInput(prev => prefix + (prev ? '\n' + prev : ''));
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </div>
    </div>
  );
};

export default ChatDetail;

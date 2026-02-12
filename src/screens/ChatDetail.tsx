import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, MicOff, Image as ImageIcon, MoreVertical, Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import { useGlobalConnection } from '../contexts/WebSocketContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import Avatar from '../components/Avatar';
import FilePicker from '../components/FilePicker';
import MediaMessage from '../components/MediaMessage';
import { getChatHistory, sendMessage as dbSendMessage, sendMessageWithMedia } from '../services/databaseService';
import { uploadFile } from '../services/uploadService';
import { supabase } from '../config/supabase';
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
  const { name, avatar, isBot, friendId } = location.state || { 
    name: 'Clawdbot Gateway', 
    avatar: IMAGES.WIZARD_BOY_LOGIN, 
    isBot: true,
    friendId: 'clawbot'
  };
  
  // WebSocket connection for Bot
  const { status, sendMessage: wsSendMessage, fullResponse, currentStreamId, isConnected } = useGlobalConnection();
  
  // Speech to text
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    reset: resetSpeech,
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
  const [pendingMedia, setPendingMedia] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 🔌 Realtime Channel 引用 (防止重复连接)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // 🧪 测试模式状态
  const [testMode, setTestMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');

  // 格式化时间戳为 HH:MM 格式
  const formatTimestamp = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 转换数据库消息为 UI 消息
  const convertDbMessageToUI = (dbMsg: ChatMessage): UIMessage => {
    const uiMessage: UIMessage = {
      id: dbMsg.id,
      sender: dbMsg.sender,
      text: dbMsg.text,
      timestamp: formatTimestamp(dbMsg.created_at)
    };

    // Add media fields if present
    if (dbMsg.message_type && dbMsg.message_type !== 'text') {
      uiMessage.messageType = dbMsg.message_type;
      uiMessage.mediaUri = dbMsg.media_uri;
      uiMessage.mediaType = dbMsg.media_type;
      uiMessage.mediaMetadata = dbMsg.media_metadata;
      
      console.log('🖼️ [ChatDetail] Loading media message:', {
        messageType: dbMsg.message_type,
        mediaUri: dbMsg.media_uri,
        mediaType: dbMsg.media_type
      });
    }

    return uiMessage;
  };

  // 加载聊天历史
  useEffect(() => {
    const loadChatHistory = async () => {
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
        console.error('加载聊天记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [friendId]);

  // 实时订阅新消息 - 防抖动标准写法
  useEffect(() => {
    // 🚫 如果没有会话ID,则跳过
    if (!conversationId) {
      console.log('⚠️ [Realtime] 会话ID未就绪,跳过订阅');
      return;
    }
    
    console.log('🔌 [Realtime] 启动监听:', conversationId);
    
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
          
          //  手动过滤逻辑
          if (newMessage.conversation_id !== conversationId) {
            console.log('⚠️ [Realtime] 消息不属于当前会话:', {
              received: newMessage.conversation_id,
              expected: conversationId
            });
            return;
          }
          
          console.log('🔥 [Realtime] 收到新消息:', newMessage.text);
          
          // 只有当消息不是当前用户发送的,才添加到消息列表
          if (newMessage.sender_id !== currentUserId) {
            console.log('✅ [Realtime] 消息来自好友，添加到UI');
            
            // ✅ 关键：使用函数式更新,不需要将 messages 加入依赖数组
            setMessages((prev) => {
              // 防止重复添加
              if (prev.some(msg => msg.id === newMessage.id)) {
                console.log('⚠️ [Realtime] 消息已存在，跳过');
                return prev;
              }
              
              const uiMessage: UIMessage = {
                id: newMessage.id,
                sender: 'friend',
                text: newMessage.text,
                timestamp: formatTimestamp(newMessage.created_at)
              };
              
              console.log('✅ [Realtime] 添加新消息到列表');
              return [...prev, uiMessage];
            });
          } else {
            console.log('⚠️ [Realtime] 消息来自自己，跳过');
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [Realtime] 连接状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] 订阅成功,长连接已建立');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] 频道错误');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ [Realtime] 连接超时');
        } else if (status === 'CLOSED') {
          console.log('🔌 [Realtime] 连接已关闭');
        }
      });
    
    // 3️⃣ 仅在 conversationId 真正改变时才清理
    return () => {
      console.log('🧹 [Realtime] 清理连接:', conversationId);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  // ⚠️ 致命关键：依赖数组里只有 conversationId！绝对不能有 messages！
  }, [conversationId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Bot Streaming Response Handler
  useEffect(() => {
    if (!fullResponse || !isBot || !currentStreamId) return;

    setMessages(prev => {
      const existingIndex = prev.findIndex(msg => msg.id === currentStreamId);
      
      const timeString = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          text: fullResponse,
          timestamp: timeString,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: currentStreamId,
            sender: 'bot',
            text: fullResponse,
            timestamp: timeString,
          }
        ];
      }
    });
  }, [fullResponse, currentStreamId, isBot]);

  const handleSend = async () => {
    // Check if we have media or text
    const hasMedia = pendingMedia !== null;
    const hasText = input.trim();

    if (!hasMedia && !hasText) return;

    const messageText = input;
    const mediaData = pendingMedia;

    setInput(''); // Clear input
    setPendingMedia(null); // Clear pending media

    const timeString = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // Determine message type
    const messageType = hasMedia && hasText ? 'mixed'
      : hasMedia ? (mediaData.category === 'image' ? 'image' : 'video')
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
        // Send message with media
        messageId = await sendMessageWithMedia(
          friendId,
          'user',
          messageText,
          {
            uri: mediaData.uri,
            type: mediaData.type,
            size: mediaData.size,
            category: mediaData.category,
            metadata: mediaData.metadata
          },
          messageType
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
      alert('发送消息失败,请检查网络连接');
    }

    // Handle Bot Logic (仅用于 Bot 聊天，暂不支持媒体)
    if (isBot && !hasMedia) {
      if (isConnected) {
        wsSendMessage(messageText);
      } else {
        // Fallback Mock Bot Response if offline
        setTimeout(async () => {
          const botResponse: UIMessage = {
            id: `temp-bot-${Date.now()}`,
            sender: 'bot',
            text: '[Mock Mode] Gateway is offline. Echo: ' + messageText,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, botResponse]);

          // 保存 Bot 消息到数据库
          try {
            const botMessageId = await dbSendMessage(friendId, 'bot', botResponse.text);
            if (botMessageId) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === botResponse.id
                    ? { ...msg, id: botMessageId }
                    : msg
                )
              );
            }
          } catch (error) {
            console.error('保存 Bot 消息失败:', error);
          }
        }, 1000);
      }
    }
    // 对于好友聊天,好友的回复会通过实时订阅自动显示
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const category = file.type.startsWith('image/') ? 'image' : 'video';
      const result = await uploadFile(file, category);

      setPendingMedia({
        uri: result.uri,
        type: result.type,
        size: result.size,
        metadata: result.metadata,
        category
      });

      console.log('Upload successful:', result);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = () => {
    if (!isBot) return 'bg-green-500';
    switch (status) {
      case 'CONNECTED': return 'bg-green-500';
      case 'CONNECTING': return 'bg-yellow-500 animate-pulse';
      case 'AUTH_FAILED':
      case 'ERROR': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'CONNECTED': return 'Online';
      case 'CONNECTING': return 'Connecting...';
      case 'AUTH_FAILED': return 'Auth Failed';
      case 'ERROR': return 'Error';
      default: return 'Offline';
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col font-sans">
      {/* 🧪 测试模式信息面板 */}
      {testMode && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-yellow-50 to-orange-50 border-b-2 border-yellow-400 p-3 z-50 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-yellow-900 flex items-center gap-2">
                🧪 测试模式 - 聊天诊断信息
              </h3>
              <button
                onClick={() => setTestMode(false)}
                className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-yellow-900 font-medium"
              >
                关闭
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-mono">
              <div className="bg-white/60 rounded p-2 border border-yellow-200">
                <span className="text-yellow-800 font-semibold">当前用户 ID:</span>
                <div className="text-yellow-900 mt-1 break-all select-all">{currentUserId || '加载中...'}</div>
              </div>
              <div className="bg-white/60 rounded p-2 border border-yellow-200">
                <span className="text-yellow-800 font-semibold">好友 ID:</span>
                <div className="text-yellow-900 mt-1 break-all select-all">{friendId}</div>
              </div>
              <div className="bg-white/60 rounded p-2 border border-orange-200">
                <span className="text-orange-800 font-semibold">会话 ID:</span>
                <div className="text-orange-900 mt-1 break-all select-all">{conversationId || '加载中...'}</div>
              </div>
              <div className="bg-blue-50 rounded p-2 border border-blue-200">
                <span className="text-blue-800 font-semibold">💡 使用方法:</span>
                <div className="text-blue-700 mt-1 space-y-1">
                  <p>1. 复制上面的 UUID 到另一个账号的聊天界面</p>
                  <p>2. 打开浏览器控制台 (F12) 查看详细日志</p>
                  <p>3. 发送消息时检查控制台的发送和接收日志</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className={`px-4 py-4 ${testMode ? 'pt-20' : 'pt-16'} flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white/20 flex-shrink-0 z-40 shadow-sm transition-all duration-300`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors border border-white/50 active:scale-95 duration-200"
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
        
        <div className="flex items-center gap-2">
          {/* 🧪 测试模式切换按钮 */}
          <button 
            onClick={() => setTestMode(!testMode)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              testMode 
                ? 'bg-yellow-500 text-white' 
                : 'bg-white/50 text-slate-600 hover:bg-white border border-white/50'
            }`}
          >
            {testMode ? '🧪 测试中' : '🧪'}
          </button>
          
          <button className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors border border-white/50">
            <MoreVertical size={20} className="text-slate-700" />
          </button>
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
                    : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm'
                }`}
              >
                {/* Render media if present */}
                {msg.mediaUri && (
                  <div className="mb-2 -mx-2 -mt-2">
                    <MediaMessage
                      uri={msg.mediaUri}
                      type={msg.messageType === 'video' ? 'video' : 'image'}
                      alt="Attachment"
                      maxSize="lg"
                      className="rounded-t-lg"
                    />
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

      {/* Input Area */}
      <div className="flex-shrink-0 px-4 py-3 pb-6 bg-transparent pointer-events-none z-40">
          {/* Floating Input Container */}
          <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/50 rounded-3xl p-1.5 flex items-center gap-2 pointer-events-auto max-w-lg mx-auto w-full transition-all duration-200 hover:shadow-2xl hover:shadow-slate-200/60 ring-1 ring-slate-100">

            <FilePicker
              onFileSelect={handleFileUpload}
              isUploading={isUploading}
            />
            
            <input
              type="text"
              value={isListening ? transcript : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening..." : "Message..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 h-10 px-2 min-w-0"
              disabled={isBot && !isConnected}
            />
            
            {isSpeechSupported && (
               <button 
                  onClick={() => isListening ? stopListening() : startListening()}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                     isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
               >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
               </button>
            )}

            <button
              onClick={handleSend}
              disabled={!input.trim() || (isBot && !isConnected && false)} 
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                input.trim() 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-indigo-300/50 hover:scale-105 active:scale-95' 
                  : 'bg-slate-100 text-slate-300'
              }`}
            >
              <Send size={18} className={input.trim() ? 'ml-0.5' : ''} />
            </button>
          </div>
      </div>
    </div>
  );
};

export default ChatDetail;

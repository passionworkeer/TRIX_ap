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

// Mock conversations - 宸插垹闄?浣跨敤鏁版嵁搴撴暟鎹浛浠?

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { showError } = useNotification();
  const { handleError } = useErrorHandler();

  // 浼樺厛浠?URL 鍙傛暟鑾峰彇 friendId锛屽惁鍒欎粠 location.state 鑾峰彇
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

  // 濡傛灉鏈?URL 鍙傛暟涓斾笉鏄?state锛屼粠鏁版嵁搴撳姞杞藉ソ鍙嬩俊鎭?
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
      // 浣跨敤缁熶竴鐨勯敊璇鐞嗗櫒
      handleError(error, '鍔犺浇濂藉弸淇℃伅澶辫触');
    }
  };

  // 浠庤矾鐢卞弬鏁版帴鏀跺埌鐨勫浘鐗囬瑙堢姸鎬侊紙鍖呭惈瀹屾暣濯掍綋鏁版嵁锛?
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

  // 鑿滃崟鏄剧ず鐘舵�?
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
  const fileInputRef = useRef<HTMLInputElement>(null); // 鏂囦欢杈撳叆寮曠敤
  const autoPromptPrefilledRef = useRef(false);
  const autoSendTriggeredRef = useRef(false);

  // 褰?photoUri 鏀瑰彉鏃讹紝娣诲姞鍒板浘鐗囧垪琛?
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

  // 馃攲 Realtime Channel 寮曠敤 (闃叉閲嶅杩炴帴)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 缁勪欢鍗歌浇鏃剁‘淇濇竻鐞嗘墍鏈夎闃?
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

  // 杞崲鏁版嵁搴撴秷鎭负 UI 娑堟伅
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

  // 鍔犺浇鑱婂ぉ鍘嗗彶
  useEffect(() => {
    const loadChatHistory = async () => {
      // 鐗规畩澶勭悊锛氭満鍣ㄤ汉浼氳瘽涓嶄粠鏁版嵁搴撳姞杞藉巻鍙诧紝鐩存帴鐩戝惉娑堟伅閫氶亾
      if (isBotConversation) {
        setLoading(false);
        return;
      }

      // 馃摑 鏅�氬ソ鍙嬶細浠庢暟鎹簱鍔犺浇鍘嗗彶锛堢幇鏈夐�昏緫锛?
      try {
        setLoading(true);

        // 鑾峰彇褰撳墠鐢ㄦ埛ID锛堢敤浜庢祴璇曟ā寮忔樉绀猴級
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUserId(session.user.id);

          // 璁＄畻浼氳瘽ID
          const convId = session.user.id < friendId
            ? `${session.user.id}_${friendId}`
            : `${friendId}_${session.user.id}`;
          setConversationId(convId);
        }

        const history = await getChatHistory(friendId);
        const uiMessages = history.map(convertDbMessageToUI);
        setMessages(uiMessages);

        // 鏍囪娑堟伅涓哄凡璇?
        await markMessagesAsRead(friendId);
      } catch (error) {
        // 浣跨敤缁熶竴鐨勯敊璇鐞嗗櫒
        handleError(error, '鍔犺浇鑱婂ぉ璁板綍澶辫触');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [friendId, isBotConversation]);

  // 鐩戝惉 Clawbot Channel 娑堟伅
  useEffect(() => {
    if (!isBotConversation) return;

    // 浠?context 鑾峰彇鏈�鏂版秷鎭?
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

  // 瀹炴椂璁㈤槄鏂版秷鎭?- 闃叉姈鍔ㄦ爣鍑嗗啓娉?
  useEffect(() => {
    // 濡傛灉娌℃湁浼氳瘽ID,鍒欒烦杩?
    if (!conversationId) {
      return;
    }

    // 1锔忊儯 鍒涘缓棰戦亾
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: {
        broadcast: { self: false }
      }
    });
    channelRef.current = channel;

    // 2锔忊儯 缁戝畾浜嬩欢 (鏃?filter,鎵嬪姩杩囨护)
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

          // 鍙湁褰撴秷鎭笉鏄綋鍓嶇敤鎴峰彂閫佺殑,鎵嶆坊鍔犲埌娑堟伅鍒楄〃
          if (newMessage.sender_id !== currentUserId) {
            // 浣跨敤鍑芥暟寮忔洿鏂?涓嶉渶瑕佸皢 messages 鍔犲叆渚濊禆鏁扮粍
            setMessages((prev) => {
              // 闃叉閲嶅娣诲姞
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
          console.error('棰戦亾閿欒');
        } else if (status === 'TIMED_OUT') {
          console.error('杩炴帴瓒呮椂');
        } else if (status === 'CLOSED') {
          // Connection closed
        }
      });

    // 3锔忊儯 娓呯悊鍑芥暟锛歝onversationId 鏀瑰彉鎴栫粍浠跺嵏杞芥椂閮戒細鎵ц
    return () => {
      // 浣跨敤 channelRef.current 纭繚娓呯悊姝ｇ‘鐨勯閬?
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // 鈿狅笍 鑷村懡鍏抽敭锛氫緷璧栨暟缁勯噷鍙湁 conversationId锛佺粷瀵逛笉鑳芥湁 messages锛?
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
    const draftText = overrideText ?? input;
    const hasMedia = attachmentPreviews.length > 0;
    const hasText = draftText.trim().length > 0;

    if (!hasMedia && !hasText) return;

    const messageText = draftText.trim();

    // 从 attachmentPreviews 获取媒体数据（使用第一个）
    const mediaData = hasMedia ? attachmentPreviews[0] : null;

    // 特殊处理：机器人会话直接发送到对应 Bridge，不保存到 Supabase
    if (isBotConversation) {
      const tempUserMessage: UIMessage = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        text: messageText,
        timestamp: formatTime(new Date()),
        messageType: hasMedia ? 'mixed' : 'text',
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
          hasMedia && mediaData?.category ? mediaData.category : 'text',
          mediaData?.uri
        );
      } catch (error) {
        console.error('Bot 消息发送失败:', error);
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
      console.error('保存用户消息失败:', error);
      // 发送失败，移除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      showError('发送消息失败，请检查网络连接');
    }

    // 对于好友聊天，好友回复会通过实时订阅自动显示
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
      const result = await uploadFile(file, category);

      // 娣诲姞鍒伴瑙堝垪琛紙鍖呭惈瀹屾暣濯掍綋鏁版嵁锛?
      setAttachmentPreviews(prev => [...prev, {
        uri: result.uri,
        type: result.type,
        size: result.size,
        category,
        metadata: result.metadata
      }]);

    } catch (error) {
      // 浣跨敤缁熶竴鐨勯敊璇鐞嗗櫒
      handleError(error, '鏂囦欢涓婁紶澶辫触锛岃閲嶈瘯');
      // 娓呯悊鐘舵�侊紝閬垮厤涓婁紶澶辫触鍚庨瑙堟畫鐣?
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
    // 閲嶇疆 input锛屽厑璁搁噸澶嶉�夋嫨鍚屼竴鏂囦欢
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
            aria-label="杩斿洖"
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
            aria-label="鏇村閫夐」"
            aria-expanded={showMenu}
            aria-haspopup="true"
          >
            <MoreVertical size={20} className="text-slate-700" />
          </button>

          {/* 涓嬫媺鑿滃崟 */}
          <AnimatePresence>
            {showMenu && (
              <>
                {/* 閬僵灞?*/}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 z-40"
                />

                {/* 鑿滃崟鍐呭 */}
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
                        <p className="text-xs text-slate-500">Clawbot 閰嶅绠＄悊</p>
                      </div>
                      <button
                        onClick={() => {
                          const confirmed = window.confirm('确定要取消与 Clawbot 的配对吗？\\n\\n取消后需要重新配对才能继续使用。');
                          if (confirmed) {
                            unpair();
                            setShowMenu(false);
                            // 瀵艰埅鍥炶亰澶╁垪琛?
                            navigate('/chat');
                            // 鎻愮ず鐢ㄦ埛
                            alert('配对已取消，你可以重新进入配对页连接新的 Clawbot');
                          }
                        }}
                        className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <X size={18} />
                        <span className="font-medium">鍙栨秷閰嶅</span>
                      </button>
                    </>
                  )}

                  {!isBot && (
                    <div className="px-4 py-3 text-slate-500 text-sm">
                      鑱婂ぉ璁剧疆
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
              鍔犺浇鑱婂ぉ璁板綍涓?..
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
                {/* Render media if present - 浣跨敤浼樺寲鐨勭缉鐣ュ浘鏍峰紡 */}
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
                {/* 鐢ㄦ埛娑堟伅鐨勫獟浣?- 浣跨敤 inline 鏍峰紡甯﹂粦鑹插妗?*/}
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

      {/* Input Area - 浼樺寲鏍峰紡锛屽浘鐗囧拰杈撳叆妗嗚瀺涓轰竴浣?*/}
      <div className="flex-shrink-0 px-4 py-3 pb-6 bg-white border-t border-gray-100">
          {/* 涓诲鍣?*/}
          <div className="max-w-lg mx-auto">
            {/* 鍥剧墖闄勪欢棰勮 - 鍦ㄨ緭鍏ユ鍐呴儴涓婃柟 */}
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
                            alt={`闄勪欢棰勮 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* 鍒犻櫎鎸夐挳 */}
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

            {/* 杈撳叆妗嗗鍣?*/}
            <div className="bg-[#F5F5F5] rounded-2xl p-2">
              {/* 瀹為檯杈撳叆鍖哄煙 */}
              <div className="flex items-end gap-2">
                {/* 闅愯棌鐨勬枃浠惰緭鍏?*/}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 娣诲姞鎸夐挳 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <span className="text-sm text-gray-600">+</span>
                </button>

                {/* 杈撳叆妗?*/}
                <input
                  type="text"
                  value={isListening ? transcript : input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? 'Listening...' : 'Ask anything, create anything'}
                  className="flex-1 px-3 py-2 bg-white rounded-xl text-sm text-[#333333] placeholder:text-gray-500 border-0 outline-none"
                />

                {/* 楹﹀厠椋庢寜閽?*/}
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

                {/* 鍙戦�佹寜閽?*/}
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachmentPreviews.length === 0) || (isBotConversation && !isPaired) || uploadingFile}
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

            {/* AI 鍔熻兘閫夋嫨 - 鍦ㄨ緭鍏ユ涓嬫柟锛屽彧瑕佹湁鍥剧墖灏辨樉绀?*/}
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
                      // AI鍔熻兘鎸囦护鏄犲皠锛堜娇鐢ㄧ壒娈婃爣璁帮紝clawbot绔彲浠ヨ瘑鍒級
                      const aiPrompts: Record<string, string> = {
                        chat: '', // 榛樿鑱婂ぉ锛屾棤鍓嶇紑
                        doc: '@AI_DOC 璇峰府鎴戝垱寤烘枃妗ｏ細',
                        slide: '@AI_SLIDE Please create slides:',
                        table: '@AI_TABLE 璇峰府鎴戝垱寤鸿〃鏍硷細',
                        image: '@AI_IMAGE 璇峰府鎴戠敓鎴愬浘鐗囷細',
                        video: '@AI_VIDEO 璇峰府鎴戠敓鎴愯棰戯細'
                      };

                      // 娣诲姞AI鎸囦护鍓嶇紑
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








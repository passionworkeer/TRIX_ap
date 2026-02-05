import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, MicOff, Image as ImageIcon, MoreVertical, Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import { useGlobalConnection } from '../src/contexts/WebSocketContext';
import { useSpeechToText } from '../src/hooks/useSpeechToText';
import { getChatHistory, sendMessage as dbSendMessage, markMessagesAsRead, subscribeToChatMessages } from '../src/services/databaseService';
import type { ChatMessage } from '../src/config/supabase';
import Avatar from '../components/Avatar';

// 将数据库消息格式转换为UI格式
interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
}

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, avatar, isBot, friendId } = location.state || { 
    name: 'Clawdbot Gateway', 
    avatar: IMAGES.WIZARD_BOY_LOGIN, 
    isBot: true,
    friendId: 'clawbot'
  };
  
  // 🌐 使用全局 WebSocket 连接 (包含 currentStreamId)
  const { status, sendMessage: wsSendMessage, fullResponse, currentStreamId, isConnected } = useGlobalConnection();
  
  // Speech to text for voice input
  const {
    isListening,
    transcript,
    fullTranscript,
    startListening,
    stopListening,
    reset: resetSpeech,
    isSupported: isSpeechSupported,
    error: speechError,
  } = useSpeechToText({
    lang: 'zh-CN',
    continuous: false,
    interimResults: true,
    onResult: (text) => {
      // 当语音识别完成时,自动填充到输入框
      setInput(prev => prev + text);
    },
    onError: (err) => {
      console.error('语音识别错误:', err);
    }
  });
  
  // 🔥 从数据库加载聊天记录
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔥 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 🔥 加载聊天记录
  const loadMessages = async () => {
    setLoading(true);
    const history = await getChatHistory(friendId || 'clawbot');
    const uiMessages: UIMessage[] = history.map(msg => ({
      id: msg.id,
      sender: msg.sender,
      text: msg.text,
      timestamp: formatTimestamp(msg.created_at)
    }));
    setMessages(uiMessages);
    setLoading(false);
  };

  // 🔥 加载聊天记录
  useEffect(() => {
    loadMessages();
  }, [friendId]);

  // 🔥 实时订阅新消息
  useEffect(() => {
    if (!friendId) return;
    
    const unsubscribe = subscribeToChatMessages(friendId, (newMessage) => {
      // 将数据库消息转换为UI格式
      const uiMessage: UIMessage = {
        id: newMessage.id,
        sender: newMessage.sender,
        text: newMessage.text,
        timestamp: formatTimestamp(newMessage.created_at)
      };
      setMessages(prev => [...prev, uiMessage]);
    });

    return unsubscribe;
  }, [friendId]);

  // 🔥 进入聊天时标记消息为已读
  useEffect(() => {
    if (friendId && friendId !== 'clawbot') {
      markMessagesAsRead(friendId);
    }
  }, [friendId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔥 修复：使用 ID 绑定机制处理流式回复，避免重复气泡
  useEffect(() => {
    if (!fullResponse || !isBot || !currentStreamId) return;

    setMessages(prev => {
      // 查找是否已存在该 streamId 的消息
      const existingIndex = prev.findIndex(msg => msg.id === currentStreamId);
      
      if (existingIndex !== -1) {
        // ✅ 找到了 → 更新该消息的文本内容
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          text: fullResponse,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        return updated;
      } else {
        // ✅ 没找到 → 创建新消息，使用 streamId 作为 id
        return [
          ...prev,
          {
            id: currentStreamId, // 🔥 使用 streamId 作为唯一标识
            sender: 'bot',
            text: fullResponse,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          }
        ];
      }
    });
  }, [fullResponse, currentStreamId, isBot]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageText = input;
    setInput(''); // 立即清空输入框

    // Add user message to UI immediately
    const userMessage: UIMessage = {
      id: Date.now(),
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);

    // 保存到数据库
    await dbSendMessage(friendId || 'clawbot', 'user', messageText);

    // Send to Clawdbot Gateway if bot chat
    if (isBot) {
      if (!isConnected) {
        // Show error if not connected
        const errorMessage: UIMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          text: '⚠️ 未连接到 Gateway。请检查连接状态。',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        // Send message via WebSocket using RPC protocol
        wsSendMessage(messageText);
      }
    }
  };

  // Connection status display
  const getStatusColor = () => {
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
      case 'CONNECTED': return '🟢 已连接';
      case 'CONNECTING': return '🟡 连接中';
      case 'AUTH_FAILED': return '🔴 认证失败';
      case 'ERROR': return '🔴 错误';
      default: return '⚪ 离线';
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              {isBot ? (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Bot className="text-white" size={24} />
                </div>
              ) : (
                <Avatar name={name} avatar={avatar} size="lg" />
              )}
              {isBot && (
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor()}`}></div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-slate-800">{name}</h1>
              <p className="text-xs text-slate-500">
                {isBot ? getStatusText() : '在线'}
              </p>
            </div>
          </div>
        </div>
        <button className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
          <MoreVertical size={20} className="text-slate-700" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-32">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender !== 'user' && (
              <div className="shrink-0 mr-3">
                {isBot ? (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Bot className="text-white" size={20} />
                  </div>
                ) : (
                  <Avatar name={name} avatar={avatar} size="md" />
                )}
              </div>
            )}
            <div 
              className={`max-w-[75%] ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-slate-800 border border-slate-200'
              } rounded-2xl px-4 py-3 shadow-sm`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              <span 
                className={`text-[10px] mt-1 block ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection Status Banner (if not connected and is bot) */}
      {isBot && !isConnected && (
        <div className="px-5 py-2 bg-yellow-50 border-t border-yellow-200">
          <p className="text-xs text-yellow-800 text-center">
            ⚠️ Gateway 未连接 - 请检查 WebSocket 配置
          </p>
        </div>
      )}

      {/* Input Bar */}
      <div className="fixed bottom-20 left-0 right-0 px-5 py-4 bg-white/90 backdrop-blur-lg border-t border-slate-100">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <ImageIcon size={20} className="text-slate-600" />
          </button>
          <div className="flex-1 flex items-center bg-slate-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={isListening ? fullTranscript : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                isListening 
                  ? "🎤 正在监听..." 
                  : isBot 
                    ? "发送消息给 Gateway..." 
                    : "输入消息..."
              }
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
              disabled={isBot && !isConnected}
            />
            {isSpeechSupported && (
              <button 
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    resetSpeech();
                    startListening();
                  }
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ml-2 ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-slate-200 hover:bg-slate-300'
                }`}
              >
                {isListening ? (
                  <MicOff size={18} className="text-white" />
                ) : (
                  <Mic size={18} className="text-slate-600" />
                )}
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || (isBot && !isConnected)}
            className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetail;
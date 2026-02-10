import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, MicOff, Image as ImageIcon, MoreVertical, Bot } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import { useGlobalConnection } from '../contexts/WebSocketContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import Avatar from '../components/Avatar';

// Mock messages for different friends
interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
}

const MOCK_CONVERSATIONS: Record<string, UIMessage[]> = {
  'elara': [
    { id: 1, sender: 'friend', text: 'Hey! The new spatial algorithm is fascinating.', timestamp: '09:41' },
    { id: 2, sender: 'user', text: 'I know right? I tried implementing it yesterday.', timestamp: '09:42' },
    { id: 3, sender: 'friend', text: 'How did it go? Did you solve the latency?', timestamp: '09:42' }
  ],
  'kael': [
    { id: 1, sender: 'friend', text: 'Are we still meeting for the study session?', timestamp: '14:20' },
    { id: 2, sender: 'user', text: 'Yes, definitely. 3 PM roughly?', timestamp: '14:25' }
  ],
  'clawbot': [
    { id: 1, sender: 'bot', text: 'Gateway connected. Ready for instructions.', timestamp: 'NOW' }
  ]
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize messages
  useEffect(() => {
    // Load mock conversation or empty array
    const initialMessages = MOCK_CONVERSATIONS[friendId] || [];
    // Deep copy to avoid mutating the mock store directly during this session
    const uniqueMessages = JSON.parse(JSON.stringify(initialMessages)).map((msg: UIMessage) => {
       if (msg.timestamp === 'NOW') {
         msg.timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
       }
       return msg;
    });
    setMessages(uniqueMessages);
  }, [friendId]);

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
    if (!input.trim()) return;

    const messageText = input;
    setInput(''); // Clear input

    const timeString = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // User Message
    const userMessage: UIMessage = {
      id: Date.now(),
      sender: 'user',
      text: messageText,
      timestamp: timeString,
    };

    setMessages(prev => [...prev, userMessage]);

    // Handle Bot Logic
    if (isBot) {
      if (isConnected) {
        wsSendMessage(messageText);
      } else {
        // Fallback Mock Bot Response if offline
        setTimeout(() => {
          const botResponse: UIMessage = {
            id: Date.now() + 1,
            sender: 'bot',
            text: '[Mock Mode] Gateway is offline. Echo: ' + messageText,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, botResponse]);
        }, 1000);
      }
    } else {
      // Handle Friend Logic (Mock Reply)
      setTimeout(() => {
        const replies = [
          "That's interesting!",
          "Tell me more about it.",
          "I'm currently busy checking the nav logs.",
          "Haha, totally agree.",
          "Wait, are you sure?",
          "See you later then."
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        
        const friendResponse: UIMessage = {
          id: Date.now() + 1,
          sender: 'friend',
          text: randomReply,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, friendResponse]);
      }, 1500 + Math.random() * 2000);
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
      {/* Header */}
      <header className="px-4 py-4 pt-16 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white/20 flex-shrink-0 z-50 shadow-sm transition-all duration-300">
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
        
        <button className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors border border-white/50">
          <MoreVertical size={20} className="text-slate-700" />
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-6 bg-slate-50/50">
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
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
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
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-4 py-3 pb-6 bg-transparent pointer-events-none z-40">
          {/* Floating Input Container */}
          <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-200/50 rounded-3xl p-1.5 flex items-center gap-2 pointer-events-auto max-w-lg mx-auto w-full transition-all duration-200 hover:shadow-2xl hover:shadow-slate-200/60 ring-1 ring-slate-100">
            
            <button className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600 active:scale-90 duration-200">
               <ImageIcon size={20} />
            </button>
            
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

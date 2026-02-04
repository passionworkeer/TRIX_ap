import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, Image as ImageIcon, MoreVertical, Bot, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import { usePCConnection, PCMessage } from '../hooks/usePCConnection';

interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  type?: 'text' | 'task';
  progress?: number;
  taskStatus?: 'pending' | 'running' | 'completed';
}

// Task Bubble Component with real-time progress
const TaskBubble: React.FC<{ 
  text: string; 
  progress: number;
  status: 'pending' | 'running' | 'completed';
}> = ({ text, progress, status }) => {
  return (
    <div className="w-64">
        <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              status === 'completed' ? 'bg-green-100 text-green-600' :
              status === 'running' ? 'bg-indigo-100 text-indigo-600' :
              'bg-slate-100 text-slate-400'
            }`}>
                <CheckCircle2 size={18} />
            </div>
            <div>
                <h4 className="font-bold text-sm text-slate-800">{text}</h4>
                <p className="text-xs text-slate-500">
                  {status === 'completed' ? '已完成' : 
                   status === 'running' ? '进行中...' : 
                   '等待中...'}
                </p>
            </div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  status === 'completed' ? 'bg-green-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
            ></div>
        </div>
    </div>
  );
};

const ChatDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, avatar, isBot } = location.state || { name: '未知', avatar: IMAGES.FRIEND_1, isBot: false };
  
  // WebSocket connection
  const { status: pcStatus, sendCommand, lastMessage } = usePCConnection();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'bot',
      text: isBot ? '你好！我是 TRIX 助手，可以帮你控制电脑。试试输入"整理文件"、"清理下载"或"截图"。' : '嘿，最近怎么样？',
      timestamp: '10:30',
      type: 'text',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage || !isBot) return;

    const messageId = Date.now();
    
    if (lastMessage.type === 'progress') {
      // Update the last task message with progress
      setMessages(prev => {
        const lastTaskIndex = prev.findIndex(m => m.type === 'task' && m.taskStatus !== 'completed');
        if (lastTaskIndex === -1) return prev;

        const updated = [...prev];
        updated[lastTaskIndex] = {
          ...updated[lastTaskIndex],
          progress: lastMessage.progress || 0,
          taskStatus: 'running',
          text: lastMessage.output || updated[lastTaskIndex].text,
        };
        return updated;
      });
    } else if (lastMessage.type === 'success') {
      // Mark task as completed and add success message
      setMessages(prev => {
        const lastTaskIndex = prev.findIndex(m => m.type === 'task' && m.taskStatus !== 'completed');
        const updated = [...prev];
        
        if (lastTaskIndex !== -1) {
          updated[lastTaskIndex] = {
            ...updated[lastTaskIndex],
            progress: 100,
            taskStatus: 'completed',
          };
        }

        // Add success message
        updated.push({
          id: messageId,
          sender: 'bot',
          text: lastMessage.message || '任务完成！',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
        });

        return updated;
      });
    } else if (lastMessage.type === 'error') {
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: messageId,
          sender: 'bot',
          text: `❌ ${lastMessage.message || '执行失败'}`,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
        },
      ]);
    }
  }, [lastMessage, isBot]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);

    // If bot, process command
    if (isBot) {
      const lowerText = inputText.toLowerCase();
      
      // Command mapping
      let command: string | null = null;
      let taskName = inputText;

      if (lowerText.includes('整理') || lowerText.includes('organize')) {
        command = 'organize_files';
        taskName = '整理桌面文件';
      } else if (lowerText.includes('清理') || lowerText.includes('clean')) {
        command = 'clean_downloads';
        taskName = '清理下载文件夹';
      } else if (lowerText.includes('截图') || lowerText.includes('screenshot')) {
        command = 'take_screenshot';
        taskName = '截图';
      }

      if (command) {
        // Check PC connection
        if (pcStatus !== 'online') {
          setTimeout(() => {
            setMessages(prev => [
              ...prev,
              {
                id: Date.now(),
                sender: 'bot',
                text: '⚠️ 电脑未连接。请确保 Python 服务器正在运行。',
                timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                type: 'text',
              },
            ]);
          }, 500);
        } else {
          // Add task bubble
          setTimeout(() => {
            setMessages(prev => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: 'bot',
                text: taskName,
                timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                type: 'task',
                progress: 0,
                taskStatus: 'pending',
              },
            ]);

            // Send command via WebSocket
            sendCommand(command!);
          }, 300);
        }
      } else {
        // Generic response for non-command messages
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 2,
              sender: 'bot',
              text: '我可以帮你执行以下任务:\n• 整理文件\n• 清理下载\n• 截图\n\n请告诉我你想做什么！',
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              type: 'text',
            },
          ]);
        }, 500);
      }
    } else {
      // Regular chat (mock response)
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: '收到！稍后回复你～',
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            type: 'text',
          },
        ]);
      }, 1000);
    }

    setInputText('');
  };

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              {isBot ? (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Bot className="text-white" size={24} />
                </div>
              ) : (
                <img src={avatar} className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm" alt={name} />
              )}
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isBot && pcStatus === 'online' ? 'bg-green-500' :
                isBot && pcStatus === 'connecting' ? 'bg-yellow-500' :
                isBot ? 'bg-gray-400' :
                'bg-green-500'
              }`}></div>
            </div>
            <div>
              <h1 className="font-bold text-slate-800">{name}</h1>
              <p className="text-xs text-slate-500">
                {isBot ? (pcStatus === 'online' ? '🟢 已连接' : pcStatus === 'connecting' ? '🟡 连接中' : '⚪ 离线') : '在线'}
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
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.type === 'task' && msg.sender === 'bot' ? (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot className="text-white" size={20} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <TaskBubble 
                    text={msg.text} 
                    progress={msg.progress || 0}
                    status={msg.taskStatus || 'pending'}
                  />
                </div>
              </div>
            ) : (
              <div className={`max-w-[75%] ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'} rounded-2xl px-4 py-3 shadow-sm`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                <span className={`text-[10px] mt-1 block ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="fixed bottom-20 left-0 right-0 px-5 py-4 bg-white/90 backdrop-blur-lg border-t border-slate-100">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <ImageIcon size={20} className="text-slate-600" />
          </button>
          <div className="flex-1 flex items-center bg-slate-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isBot ? "试试说 '整理文件'..." : "输入消息..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
            />
            <button className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors ml-2">
              <Mic size={18} className="text-slate-600" />
            </button>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
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

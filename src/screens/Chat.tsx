import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { motion } from 'framer-motion';

// Mock Data
const MOCK_CHATS = [
  { 
    id: 'clawbot', 
    name: 'Clawbot', 
    avatar: IMAGES.WIZARD_BOY, 
    lastMessage: 'Gateway connected and syncing.', 
    time: 'Just now', 
    unread: 1, 
    isOnline: true, 
    isBot: true,
    status: 'online'
  },
  { 
    id: 'elara', 
    name: 'Elara', 
    avatar: IMAGES.FRIEND_1, 
    lastMessage: 'How did the navigation test go?', 
    time: '09:42', 
    unread: 1, 
    isOnline: true,
    status: 'online'
  },
  { 
    id: 'kael', 
    name: 'Kael', 
    avatar: IMAGES.FRIEND_2, 
    lastMessage: 'See you at 3 PM.', 
    time: '14:25', 
    unread: 0, 
    isOnline: false,
    status: 'offline'
  },
  { 
    id: 'ghost', 
    name: 'Ghost', 
    avatar: IMAGES.FRIEND_3, 
    lastMessage: '[Image] Snapshot sent', 
    time: 'Mon', 
    unread: 0, 
    isOnline: false,
    status: 'offline'
  },
  { 
    id: '5', 
    name: 'Team Alpha', 
    avatar: '/assets/map.png', 
    lastMessage: 'Alex: 周五之前必须提交报告', 
    time: '周一', 
    unread: 0, 
    isOnline: true,
    isGroup: true,
    status: ''
  }
];

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [chats, setChats] = useState(MOCK_CHATS);

  return (
    <div className="h-screen w-full bg-slate-900 relative overflow-hidden flex flex-col text-white">
       {/* Aurora Background (Dark Mode) */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
       <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

       {/* Header */}
       <header className="px-6 pt-12 pb-4 sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-black tracking-tight text-white">消息</h1>
            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
               <Plus size={24} className="text-white" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
             <input 
               type="text" 
               placeholder="搜索好友或消息..." 
               className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
             />
          </div>
       </header>

       {/* Chat List */}
       <div className="flex-1 overflow-y-auto pb-32">
          {chats.map((chat, index) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(AppRoutes.CHAT_DETAIL, { 
                state: { 
                  name: chat.name, 
                  avatar: chat.avatar, 
                  isBot: chat.isBot, 
                  friendId: chat.id 
                } 
              })}
              className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer border-b border-white/5 last:border-0"
            >
              {/* Avatar */}
              <div className="relative">
                 <div className={`w-14 h-14 rounded-full p-0.5 ${chat.isBot ? 'bg-gradient-to-tr from-cyan-400 to-blue-600' : 'bg-transparent'}`}>
                    <img src={chat.avatar} className="w-full h-full rounded-full object-cover border-2 border-slate-900" alt={chat.name} />
                 </div>
                 {chat.isOnline && (
                   <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full shadow-sm"></div>
                 )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`font-bold text-base truncate ${chat.isBot ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400' : 'text-slate-100'}`}>
                      {chat.name}
                    </h3>
                    <span className="text-xs text-white/40">{chat.time}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <p className={`text-sm truncate pr-4 ${chat.status === 'typing...' ? 'text-cyan-400 italic' : 'text-white/50'}`}>
                      {chat.status === 'typing...' ? '正在输入...' : chat.lastMessage}
                    </p>
                    {chat.unread > 0 ? (
                      <div className="min-w-[20px] h-[20px] bg-cyan-500 rounded-full flex items-center justify-center px-1.5">
                         <span className="text-[10px] font-bold text-black">{chat.unread}</span>
                      </div>
                    ) : (
                       <div className="text-white/20">
                         <CheckCheck size={16} />
                       </div>
                    )}
                 </div>
              </div>
            </motion.div>
          ))}
          
          {/* End padding for dock */}
          <div className="h-6"></div>
       </div>
    </div>
  );
};

export default Chat;


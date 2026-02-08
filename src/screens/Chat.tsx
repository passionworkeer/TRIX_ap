import React, { useState, useEffect } from 'react';
import { Plus, FileText, CheckCircle2, Bot, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useGlobalConnection } from '../src/contexts/WebSocketContext';
import { getFriends, subscribeToUnreadCounts } from '../src/services/databaseService';
import type { FriendLatestMessage } from '../src/config/supabase';
import Avatar from '../components/Avatar';

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { status, isConnected } = useGlobalConnection();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔥 从数据库加载好友列表
  useEffect(() => {
    loadFriends();
  }, []);

  // 🔥 实时订阅未读计数更新
  useEffect(() => {
    const unsubscribe = subscribeToUnreadCounts(() => {
      loadFriends(); // 未读计数变化时重新加载好友列表
    });

    return unsubscribe;
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    const data = await getFriends();
    setFriends(data);
    setLoading(false);
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
      case 'CONNECTED': return '已连接';
      case 'CONNECTING': return '连接中';
      case 'AUTH_FAILED': return '认证失败';
      case 'ERROR': return '错误';
      default: return '离线';
    }
  };

  // 🔥 获取在线状态颜色
  const getOnlineStatusColor = (status: FriendLatestMessage['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-red-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  // 🔥 格式化时间戳
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#fdfdfd] flex items-center justify-center">
        <p className="text-slate-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#fdfdfd] relative overflow-hidden flex flex-col">
       {/* Aurora Background */}
       <div className="absolute -top-[10%] -right-[10%] w-[400px] h-[400px] bg-cyan-200/40 rounded-full blur-[80px] mix-blend-multiply pointer-events-none"></div>
       <div className="absolute top-[30%] -left-[20%] w-[300px] h-[300px] bg-pink-200/30 rounded-full blur-[80px] mix-blend-multiply pointer-events-none"></div>
       <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-yellow-100/40 rounded-full blur-[80px] mix-blend-multiply pointer-events-none"></div>

       <header className="px-6 pt-12 pb-4 flex justify-between items-center sticky top-0 z-20">
          <h1 className="text-3xl font-extrabold text-slate-800">聊天</h1>
          <button className="w-10 h-10 rounded-full border border-slate-200 bg-white/60 flex items-center justify-center shadow-sm hover:bg-white transition-colors">
             <Plus size={24} className="text-slate-600" />
          </button>
       </header>

       <div className="flex-1 overflow-y-auto px-5 pb-32">
          {/* Avatar Header */}
          <div className="flex justify-center mb-8 relative">
             <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-white to-transparent shadow-lg shadow-cyan-100">
                <div className="w-full h-full rounded-full overflow-hidden bg-white relative group">
                   <img src={IMAGES.WIZARD_BOY_LOGIN} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" alt="Avatar" />
                </div>
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
             </div>
          </div>

          <div className="flex flex-col gap-4">
             {/* 🔥 动态渲染好友列表 */}
             {friends.map(friend => {
               const isClawbot = friend.friend_id === 'clawbot';
               
               return (
                 <div 
                    key={friend.friend_id}
                    onClick={() => navigate(AppRoutes.CHAT_DETAIL, { 
                      state: { 
                        name: friend.name, 
                        avatar: friend.avatar_url, 
                        isBot: isClawbot,
                        friendId: friend.friend_id
                      } 
                    })}
                    className={`${
                      isClawbot 
                        ? 'bg-gradient-to-r from-indigo-50/50 to-white/60' 
                        : 'bg-white/60'
                    } backdrop-blur-md border border-white/60 p-4 rounded-2xl shadow-sm flex items-center gap-4 hover:bg-white/80 transition-colors cursor-pointer relative overflow-hidden`}>
                    
                    {isClawbot && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 opacity-50"></div>}
                    
                    <div className="relative shrink-0">
                       {isClawbot ? (
                         <div className="w-14 h-14 rounded-full bg-indigo-50 border border-white flex items-center justify-center">
                           <Bot className="text-indigo-500" size={28} />
                           <div className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor()} border-2 border-white`}></span>
                           </div>
                         </div>
                       ) : (
                         <div className="relative">
                           <Avatar name={friend.name} avatar={friend.avatar_url || ''} size="lg" />
                           <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 ${getOnlineStatusColor(friend.status)} border-2 border-white rounded-full`}></div>
                         </div>
                       )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 text-base">{friend.name}</h3>
                          {isClawbot && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                              isConnected 
                                ? 'bg-green-50 text-green-600 border-green-200' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {getStatusText()}
                            </span>
                          )}
                          {friend.is_studying && !isClawbot && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                              学习中
                            </span>
                          )}
                       </div>
                       <div className="flex justify-between items-center mt-1">
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-slate-500 text-sm truncate">
                              {isClawbot 
                                ? (isConnected ? 'Gateway 已就绪，可以发送消息' : '等待连接...') 
                                : friend.last_message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!isClawbot && friend.status === 'offline' && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                已离线
                              </span>
                            )}
                            {friend.unread_count && friend.unread_count > 0 && (
                              <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{friend.unread_count}</span>
                              </div>
                            )}
                          </div>
                       </div>
                    </div>
                    
                    <span className="text-xs font-medium text-slate-400 self-start mt-1">
                      {isClawbot ? '刚刚' : formatTime(friend.last_message_time)}
                    </span>
                 </div>
               );
             })}
          </div>
       </div>
    </div>
  );
};

export default Chat;
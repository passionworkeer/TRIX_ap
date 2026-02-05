import React, { useState, useEffect } from 'react';
import { Mail, Bell, MessageCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useAuth } from '../src/contexts/AuthContext';
import { useGlobalConnection } from '../src/contexts/WebSocketContext';
import { getUnreadMailCount, getUnreadNotificationCount, getFriends } from '../src/services/databaseService';
import MailPanel from '../components/MailPanel';
import NotificationPanel from '../components/NotificationPanel';
import StudyRoom from '../components/StudyRoom';
import ProjectProgress from '../components/ProjectProgress';
import Avatar from '../components/Avatar';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { status: pcStatus } = useGlobalConnection();
  
  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showStudyRoom, setShowStudyRoom] = useState(false);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [studyingCount, setStudyingCount] = useState(0);
  const [studyingFriends, setStudyingFriends] = useState<any[]>([]);

  useEffect(() => {
    const updateCounts = async () => {
      const mailCount = await getUnreadMailCount();
      const notifCount = await getUnreadNotificationCount();
      const friends = await getFriends();
      
      const studying = friends.filter(f => f.is_studying);
      
      setUnreadMailCount(mailCount);
      setUnreadNotifCount(notifCount);
      setStudyingCount(studying.length);
      setStudyingFriends(studying);
    };
    
    updateCounts();
    const interval = setInterval(updateCounts, 5000); // 每5秒更新一次
    return () => clearInterval(interval);
  }, [showMailPanel, showNotificationPanel, showStudyRoom]);

  return (
    <div className="relative h-screen flex flex-col bg-gradient-to-b from-yellow-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white overflow-y-auto overflow-x-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-yellow-200/40 rounded-full blur-[80px]" />
         <div className="absolute bottom-[20%] left-[-10%] w-[300px] h-[300px] bg-blue-200/40 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-white to-white/20 shadow-md">
            <img src={IMAGES.FRIEND_1} className="w-full h-full rounded-full object-cover" alt="User" />
          </div>
          <div className="flex items-center gap-1.5 bg-white/40 dark:bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
            <div className={`w-2.5 h-2.5 rounded-full ${pcStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : pcStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {pcStatus === 'CONNECTED' ? '在线' : pcStatus === 'CONNECTING' ? '连接中' : '离线'}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowMailPanel(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-sm relative hover:bg-white/60 transition-colors"
          >
            <Mail size={20} className="text-slate-700 dark:text-white" />
            {unreadMailCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white px-1">
                {unreadMailCount > 9 ? '9+' : unreadMailCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setShowNotificationPanel(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-sm relative hover:bg-white/60 transition-colors"
          >
            <Bell size={20} className="text-slate-700 dark:text-white" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white px-1">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Character - 缩小高度以便显示下方内容 */}
      <div className="relative z-0 flex flex-col items-center justify-center shrink-0" style={{ height: '40vh' }}>
        <img 
          src={IMAGES.WIZARD_BOY} 
          alt="Wizard Boy" 
          className="h-full w-auto object-cover object-top drop-shadow-2xl animate-float pointer-events-none"
        />
        {/* Floating Greeting */}
        <div className="absolute top-[25%] right-[15%] animate-bounce bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-t-2xl rounded-br-2xl rounded-bl-sm shadow-lg border border-white/50">
           <span className="text-sm font-bold flex items-center gap-1">你好～ 👋</span>
        </div>
      </div>

      {/* Quick Chat Trigger - Magic Bubble Design */}
      <button 
         onClick={() => navigate(AppRoutes.CHAT_DETAIL, { state: { name: 'Trixie', avatar: IMAGES.WIZARD_BOY_LOGIN, isBot: true, friendId: 'clawbot' } })}
         className="absolute top-[45vh] right-8 z-40 w-20 h-20 rounded-full bg-gradient-to-b from-white/40 to-white/10 backdrop-blur-xl border border-white/50 shadow-[0_0_20px_rgba(167,139,250,0.6)] flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 animate-float group"
         aria-label="Quick Chat"
      >
         {/* Inner Glow/Shine */}
         <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
         
         <MessageCircle size={32} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] relative z-10" strokeWidth={2.5} />
         
         {/* Decorative Sparkle */}
         <Sparkles size={20} className="text-white absolute top-4 right-4 opacity-80 animate-pulse" />
      </button>

      {/* Cards Container - 可滚动区域 */}
      <div className="relative z-10 px-4 pb-8 space-y-4 overflow-y-auto flex-1">
        {/* Project Progress Card */}
        <div className="pointer-events-auto">
          <ProjectProgress />
        </div>

        {/* Study Room Card */}
        <div 
          onClick={() => setShowStudyRoom(true)}
          className="pointer-events-auto bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[2.5rem] p-5 shadow-xl hover:scale-[1.02] transition-transform cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                好友自习室
                <span className="bg-green-500/20 text-green-600 dark:text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-200/20 animate-pulse">
                  {studyingCount} 人在线
                </span>
              </h2>
              <div className="flex gap-2 mt-2">
                <span className="bg-white/50 dark:bg-slate-700/50 px-2.5 py-1 rounded-full text-[10px] font-bold text-indigo-600 border border-indigo-100/30">
                  🏠 3D 书桌
                </span>
                <span className="bg-white/50 dark:bg-slate-700/50 px-2.5 py-1 rounded-full text-[10px] font-bold text-pink-500 border border-pink-100/30">
                  🙂 3D 形象
                </span>
              </div>
            </div>
            <button className="w-10 h-10 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-lg transform rotate-45 group-hover:rotate-0 transition-transform">
              <span className="text-xl font-bold">↑</span>
            </button>
          </div>
          
          <div className="mt-4 flex justify-between items-end">
            <div className="flex -space-x-3 pl-1">
              {studyingCount > 0 ? (
                <>
                  {studyingFriends.slice(0, 3).map((friend, idx) => (
                    <div key={friend.friend_id} className="ring-2 ring-white rounded-full shadow-md" style={{ zIndex: 30 - idx * 10 }}>
                      <Avatar name={friend.name} avatar={friend.avatar_url || ''} size="md" />
                    </div>
                  ))}
                  {studyingCount > 3 && (
                    <div className="w-10 h-10 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 z-0">
                      +{studyingCount - 3}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex -space-x-3 opacity-30">
                  <div className="ring-2 ring-white rounded-full shadow-md z-30">
                    <Avatar name="User 1" size="md" />
                  </div>
                  <div className="ring-2 ring-white rounded-full shadow-md z-20">
                    <Avatar name="User 2" size="md" />
                  </div>
                  <div className="ring-2 ring-white rounded-full shadow-md z-10">
                    <Avatar name="User 3" size="md" />
                  </div>
                </div>
              )}
            </div>
            <div className="w-24 h-16 relative -mr-2 -mb-2">
              <img src={IMAGES.STUDY_ROOM_MINI} className="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform" alt="room" />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
      <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
      <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
    </div>
  );
};

export default Home;
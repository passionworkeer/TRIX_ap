import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Camera, BookOpen, MessageCircle, User, Map as MapIcon } from 'lucide-react';
import { AppRoutes } from '../types';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav on specific screens (like full screen timer or login)
  const hideNavRoutes = [AppRoutes.TIMER, AppRoutes.LOGIN, AppRoutes.REGISTER, AppRoutes.CHAT_DETAIL];
  if (hideNavRoutes.includes(location.pathname as AppRoutes)) {
    return null;
  }

  const navItems = [
    { icon: Home, label: '首页', path: AppRoutes.HOME },
    { icon: MapIcon, label: '地图', path: AppRoutes.MAP },
    { icon: Camera, label: '快照', path: AppRoutes.SNAPSHOT },
    { icon: BookOpen, label: '自修室', path: AppRoutes.STUDY },
    { icon: MessageCircle, label: '聊天', path: AppRoutes.CHAT },
    { icon: User, label: '个人', path: AppRoutes.PROFILE },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[32px] px-2 py-3 flex items-center justify-between w-full max-w-[420px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                           (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 group relative"
            >
              <div 
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 overflow-hidden
                  ${isActive 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl -translate-y-3 rotate-[10deg]' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
              >
                <div className={`${isActive ? 'animate-bounce' : ''}`}>
                  <Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
              </div>
              <span className={`text-[10px] font-black transition-all duration-300 ${isActive ? 'text-slate-900 dark:text-white opacity-100' : 'text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-6 h-1 rounded-full bg-slate-900 dark:bg-white animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;

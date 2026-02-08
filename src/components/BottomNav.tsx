import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Camera, BookOpen, MessageCircle, User } from 'lucide-react';
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
    { icon: Camera, label: '快照', path: AppRoutes.SNAPSHOT },
    { icon: BookOpen, label: '自习室', path: AppRoutes.STUDY },
    { icon: MessageCircle, label: '聊天', path: AppRoutes.CHAT },
    { icon: User, label: '个人', path: AppRoutes.PROFILE },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
      <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] rounded-full px-2 py-3 flex items-center justify-between w-full max-w-[380px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                           (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex-1 flex flex-col items-center justify-center gap-1 group relative"
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isActive 
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg -translate-y-2 scale-110' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
              >
                <Icon size={isActive ? 20 : 22} strokeWidth={2.5} />
              </div>
              <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-800 dark:bg-white"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
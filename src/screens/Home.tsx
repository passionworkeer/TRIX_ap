import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IMAGES } from "../constants";
import { AppRoutes } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useClawbotChannel } from "../contexts/ClawbotChannelContext";
import { useNotification } from "../hooks/useNotification";
import { getUnreadMailCount, getUnreadNotificationCount } from "../services/databaseService";
import MailPanel from "../components/MailPanel";
import NotificationPanel from "../components/NotificationPanel";
import StudyRoom from "../components/StudyRoom";
import {
  PAIRING_REQUIRED_TOAST_ID,
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS
} from "../utils/pairingToast";

interface HomeProps {
  onBackgroundClick?: () => void;
}

const Home: React.FC<HomeProps> = ({ onBackgroundClick }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isConnected, isPaired } = useClawbotChannel();
  const { showWarning } = useNotification();
  const { t } = useTranslation();
  
  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showStudyRoom, setShowStudyRoom] = useState(false);

  useEffect(() => {
    const updateCounts = async () => {
      await getUnreadMailCount();
      await getUnreadNotificationCount();
    };
    updateCounts();
    const interval = setInterval(updateCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenTrixBot = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!isConnected || !isPaired) {
      showWarning(PAIRING_REQUIRED_TOAST_MESSAGE, {
        ...PAIRING_REQUIRED_TOAST_OPTIONS,
        id: PAIRING_REQUIRED_TOAST_ID,
      });
      navigate(AppRoutes.PAIRING);
      return;
    }

    navigate(AppRoutes.CHAT_DETAIL, {
      state: {
        friendId: 'clawbot',
        name: 'TRIX Bot',
        avatar: IMAGES.WIZARD_BOY_LOGIN,
        isBot: true
      }
    });
  };

  return (
    <div 
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
      onClick={onBackgroundClick}
    >
      {/* 🎯 Layer 50: 人物对话气泡 - 固定定位防止跳转飞走 */}
      <div 
        className="fixed top-[15%] right-[5%] z-50 cursor-pointer"
        onClick={handleOpenTrixBot}
      >
        <div className="relative max-w-[180px] sm:max-w-[200px]">
          {/* 玻璃气泡容器 - 磨砂效果 */}
          <div className="relative bg-white/15 backdrop-blur-xl rounded-2xl rounded-br-none border border-white/25 shadow-lg p-3 hover:shadow-xl hover:scale-[1.02] transition-transform duration-200">
            {/* 发光图标 */}
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                <Sparkles className="w-4 h-4 text-yellow-400 animate-glow-pulse" />
              </div>
              
              {/* 消息内容 */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium leading-relaxed">
                  {profile?.username ? `${t('home.greeting')} ${profile.username},` : `${t('home.greeting')},`} {t('home.whatToLearn')}
                </p>
              </div>
            </div>
            
            {/* 右下角装饰性光晕 */}
            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-yellow-400/20 rounded-full blur-lg pointer-events-none" />
          </div>
          
          {/* 对话框尖角 (右下，指向人物) */}
          <div 
            className="absolute -bottom-1 right-0 w-3 h-3 bg-white/15 backdrop-blur-xl border-r border-b border-white/25 transform rotate-45 origin-top-left pointer-events-none" 
            style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          />
        </div>
      </div>
      
      {/* Main Content Area - Empty (Zero UI) */}
      {/* 整个区域都可点击切换导航栏 */}

      {/* Panels (Modals) */}
      <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
      <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
      <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
    </div>
  );
};

export default Home;

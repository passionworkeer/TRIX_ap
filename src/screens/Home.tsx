import React, { useState, useEffect } from "react";
import { Mail, Bell, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IMAGES } from "../constants";
import { AppRoutes } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useGlobalConnection } from "../contexts/WebSocketContext";
import { getUnreadMailCount, getUnreadNotificationCount, getFriends } from "../services/databaseService";
import MailPanel from "../components/MailPanel";
import NotificationPanel from "../components/NotificationPanel";
import StudyRoom from "../components/StudyRoom";
import ProjectProgress from "../components/ProjectProgress";
import Avatar from "../components/Avatar";
import StatusHeader from "../components/StatusHeader";

interface HomeProps {
  onBackgroundClick?: () => void;
}

const Home: React.FC<HomeProps> = ({ onBackgroundClick }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { status: pcStatus } = useGlobalConnection();
  
  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showStudyRoom, setShowStudyRoom] = useState(false);
  
  // Data for background logic only (red dots)
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    const updateCounts = async () => {
      const mailCount = await getUnreadMailCount();
      const notifCount = await getUnreadNotificationCount();
      setUnreadMailCount(mailCount);
      setUnreadNotifCount(notifCount);
    };
    updateCounts();
    const interval = setInterval(updateCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="relative h-screen flex flex-col bg-transparent overflow-hidden"
      onClick={onBackgroundClick}
    >
      {/* Header - 极其简约的状态栏 */}
      <StatusHeader />
      
      {/* 🎨 高级气泡提示 - Premium Glass Bubble */}
      <div className="absolute top-24 left-6 right-6 z-50 pointer-events-none animate-float">
        <div className="relative max-w-xs">
          {/* 玻璃气泡容器 */}
          <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl rounded-bl-none border border-white/20 shadow-lg p-4 pr-6">
            {/* 发光图标 */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 animate-glow-pulse">
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>
              
              {/* 消息内容 */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-relaxed">
                  {profile?.full_name ? `嘿 ${profile.full_name},` : '嘿,'} 今天想学点什么?
                </p>
                <p className="text-white/70 text-xs mt-1">
                  轻触屏幕显示导航
                </p>
              </div>
            </div>
            
            {/* 左下角装饰性光晕 */}
            <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-yellow-400/20 rounded-full blur-xl" />
          </div>
          
          {/* 对话框尖角 (左下) */}
          <div className="absolute -bottom-1 left-0 w-4 h-4 bg-white/10 backdrop-blur-xl border-l border-b border-white/20 transform rotate-45 origin-top-right" 
               style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}
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

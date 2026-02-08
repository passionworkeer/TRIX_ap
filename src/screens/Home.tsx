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
import HeroBackground from "../components/HeroBackground";
import StatusHeader from "../components/StatusHeader";

const Home: React.FC = () => {
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
    <div className="relative h-screen flex flex-col bg-transparent overflow-hidden">
      {/* Background (Layer 0) - 全屏背景与呼吸动画 - 移出了 div 内部流，完全独立 */}
      <HeroBackground />

      {/* Header - 极其简约的状态栏 */}
      <StatusHeader />
      
      {/* Main Content Area - Empty (Zero UI) */}
      {/* 可以在这里放点击触发对话的隐形区域 */}

      {/* Panels (Modals) */}
      <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
      <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
      <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
    </div>
  );
};

export default Home;

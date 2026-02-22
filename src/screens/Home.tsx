import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import { getUnreadMailCount, getUnreadNotificationCount } from '../services/databaseService';
import MailPanel from '../components/MailPanel';
import NotificationPanel from '../components/NotificationPanel';
import StudyRoom from '../components/StudyRoom';
import HomeBotBubble from '../components/HomeBotBubble';
import {
  PAIRING_REQUIRED_TOAST_ID,
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS,
} from '../utils/pairingToast';

interface HomeProps {
  onBackgroundClick?: () => void;
  devVideoSource?: string;
}

const Home: React.FC<HomeProps> = ({ onBackgroundClick, devVideoSource }) => {
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();
  const { isConnected, isPaired, botState } = useClawbotChannel();
  const { showWarning } = useNotification();

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
        isBot: true,
      },
    });
  };

  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
      onClick={onBackgroundClick}
    >
      {isDev && (
        <div className="fixed top-3 left-3 z-[110] pointer-events-none">
          <div className="rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-[11px] text-white/95 backdrop-blur-sm shadow-lg">
            <div className="font-semibold tracking-wide">DEV</div>
            <div>botState: {botState}</div>
            <div>video: {devVideoSource || 'unknown'}</div>
          </div>
        </div>
      )}

      <HomeBotBubble onClick={handleOpenTrixBot} />

      <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
      <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
      <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
    </div>
  );
};

export default Home;

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
}

const Home: React.FC<HomeProps> = ({ onBackgroundClick }) => {
  const navigate = useNavigate();
  const { isConnected, isPaired } = useClawbotChannel();
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
      <HomeBotBubble onClick={handleOpenTrixBot} />

      <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
      <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
      <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
    </div>
  );
};

export default Home;

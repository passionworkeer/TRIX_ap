import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import { logger } from '../utils/logger';
import MailPanel from '../components/MailPanel';
import NotificationPanel from '../components/NotificationPanel';
import StudyRoom from '../components/StudyRoom';
import HomeBotBubble from '../components/HomeBotBubble';
import WorkbenchModal from '../components/WorkbenchModal';
import { TodoList, TodoProvider } from '../features/todo';
import { ScheduleList, ScheduleProvider } from '../features/schedule';
import { LocationPicker } from '../features/location';
import {
  PAIRING_REQUIRED_TOAST_ID,
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS,
} from '../utils/pairingToast';

interface HomeProps {
  isUIVisible?: boolean;
  onToggleUI?: () => void;
  devVideoSource?: string;
  botState?: string;
}

const Home: React.FC<HomeProps> = ({ isUIVisible, onToggleUI, devVideoSource, botState: propBotState }) => {
  const navigate = useNavigate();
  const { isClawbotConnected: isClawbotConnected, isClawbotPaired: isClawbotPaired, botState: contextBotState, sendMessage } = useClawbotChannel();
  const { showWarning, showSuccess } = useNotification();

  // 优先使用 prop_botState，否则使用 context 中的 botState
  const botState = propBotState ?? contextBotState;

  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showStudyRoom, setShowStudyRoom] = useState(false);
  const [showTodo, setShowTodo] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

  const handleOpenTrixBot = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!isClawbotConnected || !isClawbotPaired) {
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

  // Handle workbench card clicks
  const handleWorkbenchCardClick = (itemId: string) => {
    switch (itemId) {
      case 'snapshot':
        if (!isClawbotConnected || !isClawbotPaired) {
          showWarning(PAIRING_REQUIRED_TOAST_MESSAGE, {
            ...PAIRING_REQUIRED_TOAST_OPTIONS,
            id: PAIRING_REQUIRED_TOAST_ID,
          });
          navigate(AppRoutes.PAIRING);
          return;
        }
        navigate(AppRoutes.SNAPSHOT);
        break;
      case 'location':
        setShowLocation(true);
        break;
      case 'schedule':
        setShowSchedule(true);
        break;
      case 'todo':
        setShowTodo(true);
        break;
      default:
        logger.ui.debug('Unknown workbench action:', itemId);
    }
  };

  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
    >
      {import.meta.env.DEV && (
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

      <WorkbenchModal
        isOpen={!!isUIVisible}
        onClose={() => onToggleUI?.()}
        onCardClick={handleWorkbenchCardClick}
      />

      {/* Todo Panel */}
      {showTodo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setShowTodo(false);
          }}
        >
          <div className="relative w-full max-w-md max-h-[75vh] overflow-hidden rounded-[24px] bg-slate-900/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col backdrop-blur-xl">
            
            <TodoProvider>
              <TodoList onClose={() => setShowTodo(false)} />
            </TodoProvider>
          </div>
        </div>
      )}

      {/* Schedule Panel */}
      {showSchedule && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setShowSchedule(false);
          }}
        >
          <div className="relative w-full max-w-md max-h-[75vh] overflow-hidden rounded-[24px] bg-slate-900/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col backdrop-blur-xl">
            
            <ScheduleProvider>
              <ScheduleList onClose={() => setShowSchedule(false)} />
            </ScheduleProvider>
          </div>
        </div>
      )}

      {/* Location Picker - Already a full modal */}
      <LocationPicker
        isOpen={showLocation}
        onClose={() => setShowLocation(false)}
        onLocationSelected={(location) => {
          logger.ui.debug('Selected location:', location);
          
          if (!isClawbotConnected || !isClawbotPaired) {
             showWarning(PAIRING_REQUIRED_TOAST_MESSAGE, { ...PAIRING_REQUIRED_TOAST_OPTIONS });
             return;
          }
          
          try {
            sendMessage(`我当前的位置是: ${location.name}\n纬度: ${location.latitude}, 经度: ${location.longitude}`, 'text');
            showSuccess('位置信息已发送');
            setShowLocation(false);
          } catch (error) {
            showWarning('发送位置失败，请重试');
            logger.ui.error('Failed to send location message:', error);
          }
        }}
      />
    </div>
  );
};

export default Home;

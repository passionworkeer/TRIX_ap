import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import MailPanel from '../components/MailPanel';
import NotificationPanel from '../components/NotificationPanel';
import StudyRoom from '../components/StudyRoom';
import HomeBotBubble from '../components/HomeBotBubble';
import WorkbenchModal from '../components/WorkbenchModal';
import SnapshotModal from '../components/SnapshotModal';
import { TodoList, TodoProvider } from '../features/todo';
import { ScheduleList, ScheduleProvider } from '../features/schedule';
import { LocationPicker } from '../features/location';
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
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showTodo, setShowTodo] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

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

  // Handle background click to show workbench
  const handleBackgroundClick = () => {
    setShowWorkbench(true);
    // Also call the parent handler if provided
    onBackgroundClick?.();
  };

  // Handle workbench card clicks
  const handleWorkbenchCardClick = (itemId: string) => {
    setShowWorkbench(false); // Close workbench first

    switch (itemId) {
      case 'snapshot':
        setShowSnapshot(true);
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
        console.log('Unknown workbench action:', itemId);
    }
  };

  // Handle image selection from SnapshotModal
  const handleImageSelect = (imageUri: string) => {
    setShowSnapshot(false);
    setShowWorkbench(false);

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
        photoUri: imageUri
      }
    });
  };

  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
      onClick={handleBackgroundClick}
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

      <WorkbenchModal
        isOpen={showWorkbench}
        onClose={() => setShowWorkbench(false)}
        onCardClick={handleWorkbenchCardClick}
      />

      {/* Snapshot Modal */}
      <SnapshotModal
        isOpen={showSnapshot}
        onImageSelect={handleImageSelect}
      />

      {/* Todo Panel */}
      {showTodo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowTodo(false)}
        >
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setShowTodo(false)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <TodoProvider>
              <TodoList />
            </TodoProvider>
          </div>
        </div>
      )}

      {/* Schedule Panel */}
      {showSchedule && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowSchedule(false)}
        >
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setShowSchedule(false)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <ScheduleProvider>
              <ScheduleList />
            </ScheduleProvider>
          </div>
        </div>
      )}

      {/* Location Picker - Already a full modal */}
      <LocationPicker
        isOpen={showLocation}
        onClose={() => setShowLocation(false)}
        onLocationSelected={(location) => {
          console.log('Selected location:', location);
          // TODO: Handle location selection (e.g., send to chat)
        }}
      />
    </div>
  );
};

export default Home;

import React, { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import { logger } from '../utils/logger';
import HomeBotBubble from '../components/HomeBotBubble';
import {
  PAIRING_REQUIRED_TOAST_ID,
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS,
} from '../utils/pairingToast';

const MailPanel = lazy(() => import('../components/MailPanel'));
const NotificationPanel = lazy(() => import('../components/NotificationPanel'));
const StudyRoom = lazy(() => import('../components/StudyRoom'));
const WorkbenchModal = lazy(() => import('../components/WorkbenchModal'));
const LocationPicker = lazy(() =>
  import('../features/location').then((module) => ({ default: module.LocationPicker }))
);
const TodoModalContent = lazy(() =>
  import('../features/todo').then((module) => ({
    default: function TodoModalContent({ onClose }: { onClose: () => void }) {
      return (
        <module.TodoProvider>
          <module.TodoList onClose={onClose} />
        </module.TodoProvider>
      );
    },
  }))
);
const ScheduleModalContent = lazy(() =>
  import('../features/schedule').then((module) => ({
    default: function ScheduleModalContent({ onClose }: { onClose: () => void }) {
      return (
        <module.ScheduleProvider>
          <module.ScheduleList onClose={onClose} />
        </module.ScheduleProvider>
      );
    },
  }))
);

const DeferredOverlayFallback: React.FC = () => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/25 backdrop-blur-sm">
    <div className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 shadow-lg">
      加载中...
    </div>
  </div>
);

interface HomeProps {
  isUIVisible?: boolean;
  onToggleUI?: () => void;
  devVideoSource?: string;
  botState?: string;
}

const Home: React.FC<HomeProps> = ({ isUIVisible, onToggleUI, devVideoSource: _devVideoSource, botState: propBotState }) => {
  const navigate = useNavigate();
  const { isConnected: isClawbotConnected, isPaired: isClawbotPaired, botState: contextBotState, sendMessage } = useClawbotChannel();
  const { showWarning, showSuccess } = useNotification();

  // 使用 prop_botState 优先，确保正确处理状态
  const resolvedBotState = propBotState ?? contextBotState;

  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showStudyRoom, setShowStudyRoom] = useState(false);
  const [showTodo, setShowTodo] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

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
      data-bot-state={resolvedBotState}
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
    >
      <HomeBotBubble />

      {showMailPanel && (
        <Suspense fallback={<DeferredOverlayFallback />}>
          <MailPanel isOpen={showMailPanel} onClose={() => setShowMailPanel(false)} />
        </Suspense>
      )}

      {showNotificationPanel && (
        <Suspense fallback={<DeferredOverlayFallback />}>
          <NotificationPanel isOpen={showNotificationPanel} onClose={() => setShowNotificationPanel(false)} />
        </Suspense>
      )}

      {showStudyRoom && (
        <Suspense fallback={<DeferredOverlayFallback />}>
          <StudyRoom isOpen={showStudyRoom} onClose={() => setShowStudyRoom(false)} />
        </Suspense>
      )}

      {!!isUIVisible && (
        <Suspense fallback={<DeferredOverlayFallback />}>
          <WorkbenchModal
            isOpen={!!isUIVisible}
            onClose={() => onToggleUI?.()}
            onCardClick={handleWorkbenchCardClick}
          />
        </Suspense>
      )}

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
            <Suspense fallback={<DeferredOverlayFallback />}>
              <TodoModalContent onClose={() => setShowTodo(false)} />
            </Suspense>
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
            <Suspense fallback={<DeferredOverlayFallback />}>
              <ScheduleModalContent onClose={() => setShowSchedule(false)} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Location Picker - Already a full modal */}
      {showLocation && (
        <Suspense fallback={<DeferredOverlayFallback />}>
          <LocationPicker
            isOpen={showLocation}
            onClose={() => setShowLocation(false)}
            onLocationSelected={(location) => {
              logger.ui.debug('Selected location:', location);

              if (!isClawbotPaired) {
                showWarning(PAIRING_REQUIRED_TOAST_MESSAGE, { ...PAIRING_REQUIRED_TOAST_OPTIONS });
                return;
              }

              try {
                sendMessage(`📍 分享位置: ${location.name}\n纬度: ${location.latitude}, 经度: ${location.longitude}`, 'text');
                showSuccess('位置消息已发送');
                setShowLocation(false);
              } catch (error) {
                showWarning('发送位置消息失败，请稍后重试');
                logger.ui.error('Failed to send location message:', error);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Home;

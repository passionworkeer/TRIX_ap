import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import GlassDock from './components/GlassDock';
import HeroBackground from './components/HeroBackground';
import ErrorBoundary from './components/ErrorBoundary';
import { AppRoutes } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClawbotChannelProvider, useClawbotChannel } from './contexts/ClawbotChannelContext';
import { QRCodePairingProvider } from './contexts/QRCodePairingContext';
import { useNotification } from './hooks/useNotification';
import { useImmersiveVoice } from './hooks/useImmersiveVoice';
import { ResourcePreloader } from './hooks/useResourcePreloader';
import { audioContextUnlock } from './services/voicePlaybackService';
import { useWebVitals, usePageLoadTiming } from './hooks/useWebVitals';

const Home = lazy(() => import('./screens/Home'));
const Snapshot = lazy(() => import('./screens/Snapshot'));
const Study = lazy(() => import('./screens/Study'));
const Chat = lazy(() => import('./screens/Chat'));
const ChatDetail = lazy(() => import('./screens/ChatDetail'));
const Profile = lazy(() => import('./screens/Profile'));
const Diagnostic = lazy(() => import('./screens/Diagnostic'));
const DiagnosticAdvanced = lazy(() => import('./screens/DiagnosticAdvanced'));
const Pairing = lazy(() => import('./screens/Pairing'));
const QRCodePairing = lazy(() => import('./screens/QRCodePairing'));
const SnapMapScreen = lazy(() => import('./screens/SnapMapScreen'));
const PointsMall = lazy(() => import('./screens/PointsMall'));
const Wardrobe = lazy(() => import('./screens/Wardrobe'));
const Login = lazy(async () => ({ default: (await import('./screens/Auth')).Login }));
const Register = lazy(async () => ({ default: (await import('./screens/Auth')).Register }));

const RouteLoading: React.FC = () => (
  <div
    className="h-screen w-full flex items-center justify-center"
    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
  >
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-medium">页面加载中...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { showWarning } = useNotification();
  const [shouldRedirect, setShouldRedirect] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user && !shouldRedirect) {
      showWarning('请先登录以访问此页面');

      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 500);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [loading, user, shouldRedirect, showWarning]);

  if (loading) {
    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (shouldRedirect) {
      return <Navigate to={AppRoutes.LOGIN} replace />;
    }

    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-medium">跳转到登录页...</p>
        </div>
      </div>
    );
  }

  return children;
};

function AppContent() {
  // 资源预加载 - 提升首屏体验
  ResourcePreloader();

  // 性能监控 - 首屏加载时间和 Web Vitals
  usePageLoadTiming();
  useWebVitals({ debug: import.meta.env.DEV, reportToServer: false });

  const isDev = import.meta.env.DEV;
  const location = useLocation();
  const { user } = useAuth();
  const {
    botState,
  } = useClawbotChannel();
  const [showDockOnHome, setShowDockOnHome] = useState(false);
  const [devActiveVideoSource, setDevActiveVideoSource] = useState<string>('');
  const hasUnlockedAudioRef = useRef(false);

  useImmersiveVoice();

  const isHomePage = location.pathname === '/' || location.pathname === '';
  const isChatDetailPage = location.pathname === AppRoutes.CHAT_DETAIL;
  const isTimerPage = location.pathname === '/study/timer';
  const isAuthPage = location.pathname === AppRoutes.LOGIN || location.pathname === AppRoutes.REGISTER;
  const isPairingPage = location.pathname === AppRoutes.PAIRING;

  const toggleDock = () => {
    if (isHomePage) {
      setShowDockOnHome(prev => !prev);
    }
  };

  useEffect(() => {
    if (!isHomePage) {
      setShowDockOnHome(false);
    }
  }, [isHomePage]);

  const handleFirstGestureUnlock = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    if (hasUnlockedAudioRef.current) {
      return;
    }

    const nativeEvent = event.nativeEvent as Event | undefined;
    const eventType = nativeEvent?.type ?? event.type;
    if (eventType !== 'click' && eventType !== 'touchstart') {
      return;
    }

    const isTrusted = nativeEvent?.isTrusted ?? false;
    if (!isTrusted) {
      return;
    }

    hasUnlockedAudioRef.current = true;
    audioContextUnlock();
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden font-sans"
      style={{ background: 'transparent' }}
      onClickCapture={handleFirstGestureUnlock}
      onTouchStartCapture={handleFirstGestureUnlock}
    >
      {isHomePage && (
        <HeroBackground
          botState={botState}
          onActiveVideoSourceChange={isDev ? setDevActiveVideoSource : undefined}
        />
      )}

      <div
        data-home-scroll="true"
        onClick={isHomePage ? toggleDock : undefined}
        className={`relative w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y ${isHomePage ? 'home-transparent-scroll' : ''}`}
        style={{
          zIndex: 10,
          backgroundColor: (isHomePage || isPairingPage) ? 'transparent' : 'var(--bg-primary)'
        }}
      >
        <div className="min-h-full">
          <Suspense fallback={<RouteLoading />}>
            <Routes location={location} key={location.pathname}>
              <Route path={AppRoutes.LOGIN} element={<Login />} />
              <Route path={AppRoutes.REGISTER} element={<Register />} />

              <Route
                path={AppRoutes.HOME}
                element={
                  <ProtectedRoute>
                    <Home
                      botState={botState}
                      devVideoSource={isDev ? devActiveVideoSource : undefined}
                      isUIVisible={showDockOnHome}
                      onToggleUI={toggleDock}
                    />
                  </ProtectedRoute>
                }
              />
              <Route path={AppRoutes.SNAPSHOT} element={<ProtectedRoute><Snapshot /></ProtectedRoute>} />
              <Route path={AppRoutes.SNAPSHOT_RESULT} element={<ProtectedRoute><Snapshot /></ProtectedRoute>} />
              <Route path={AppRoutes.STUDY} element={<ProtectedRoute><Study key="study-home" /></ProtectedRoute>} />
              <Route path="/study/timer" element={<ProtectedRoute><Study key="study-timer" /></ProtectedRoute>} />
              <Route path={AppRoutes.CHAT} element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/chat/:friendId" element={<ProtectedRoute><ChatDetail /></ProtectedRoute>} />
              <Route path={AppRoutes.PROFILE} element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path={AppRoutes.PAIRING} element={<ProtectedRoute><Pairing /></ProtectedRoute>} />
              <Route
                path={AppRoutes.QR_PAIRING}
                element={
                  <ProtectedRoute>
                    <QRCodePairingProvider>
                      <QRCodePairing />
                    </QRCodePairingProvider>
                  </ProtectedRoute>
                }
              />
              <Route path={AppRoutes.MAP} element={<ProtectedRoute><SnapMapScreen /></ProtectedRoute>} />
              <Route path="/snapmap" element={<Navigate to={AppRoutes.MAP} replace />} />
              <Route path={AppRoutes.DIAGNOSTIC} element={<ProtectedRoute><Diagnostic /></ProtectedRoute>} />
              <Route path={AppRoutes.DIAGNOSTIC_ADV} element={<ProtectedRoute><DiagnosticAdvanced /></ProtectedRoute>} />
              <Route path={AppRoutes.POINTS_MALL} element={<ProtectedRoute><PointsMall /></ProtectedRoute>} />
              <Route path={AppRoutes.WARDROBE} element={<ProtectedRoute><Wardrobe /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </div>

        {!isChatDetailPage && !isTimerPage && !isAuthPage && user && (
          <div
            className="w-full flex-shrink-0 pointer-events-none"
            style={{
              height: 'calc(120px + env(safe-area-inset-bottom, 20px))',
              background: 'transparent'
            }}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        {user && (!isHomePage || showDockOnHome) && !isChatDetailPage && !isTimerPage && !isAuthPage && (
          <GlassDock key="dock" />
        )}
      </AnimatePresence>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
        containerStyle={{
          position: 'fixed',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
        gutter={8}
      />
    </div>
  );
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ClawbotChannelProvider>
          <HashRouter>
            <AppContent />
          </HashRouter>
        </ClawbotChannelProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

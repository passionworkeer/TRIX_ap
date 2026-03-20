import React, { useState, useCallback, Suspense, lazy } from 'react';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { VoiceSettingsProvider } from '@/contexts/VoiceSettingsContext';
import { ClawbotChannelProvider } from '@/contexts/ClawbotChannelContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DesktopTitleBar } from './DesktopTitleBar';
import { DesktopSidebar } from './DesktopSidebar';
import DesktopSettings from '../pages/DesktopSettings';
import OpenClawDashboard from '../pages/OpenClawDashboard';
import OpenClawAgents from '../pages/OpenClawAgents';
import OpenClawChannels from '../pages/OpenClawChannels';

// Lazy load web screens — same as App.tsx
const Home = lazy(() => import('@/screens/Home'));
const Snapshot = lazy(() => import('@/screens/Snapshot'));
const Study = lazy(() => import('@/screens/Study'));
const Chat = lazy(() => import('@/screens/Chat'));
const ChatDetail = lazy(() => import('@/screens/ChatDetail'));
const Profile = lazy(() => import('@/screens/Profile'));
const Pairing = lazy(() => import('@/screens/Pairing'));
const SnapMapScreen = lazy(() => import('@/screens/SnapMapScreen'));
const Login = lazy(async () => ({ default: (await import('@/screens/Auth')).Login }));

const DESKTOP_NAV_TO_ROUTE: Record<string, string> = {
  home: '/',
  chat: '/chat',
  study: '/study',
  snapshot: '/snapshot',
  map: '/map',
  profile: '/profile',
  agents: '/desktop/agents',
  skills: '/desktop/skills',
  backups: '/desktop/backups',
  pairing: '/pairing',
  settings: '/desktop/settings',
};

type DesktopRoute =
  | 'home' | 'chat' | 'study' | 'snapshot' | 'map' | 'profile' | 'pairing' | 'chat-detail'
  | 'dashboard' | 'agents' | 'channels'
  | 'skills' | 'backups' | 'settings';

interface ChatRouteParams {
  friendId?: string;
}

interface DesktopLayoutProps {
  initialRoute?: DesktopRoute;
}

const RouteLoading = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-secondary)',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      <p style={{ fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>加载中...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

export function DesktopLayout({ initialRoute = 'home' }: DesktopLayoutProps) {
  const [activeRoute, setActiveRoute] = useState<DesktopRoute>(initialRoute);
  const [chatDetailId, setChatDetailId] = useState<string | null>(null);

  const handleNavigate = useCallback((id: string) => {
    if (id === 'chat-detail') return; // chat-detail is pushed from chat screen
    setChatDetailId(null);
    setActiveRoute(id as DesktopRoute);
  }, []);

  const handleOpenChatDetail = useCallback((friendId: string) => {
    setChatDetailId(friendId);
    setActiveRoute('chat-detail');
  }, []);

  const handleBackToChat = useCallback(() => {
    setChatDetailId(null);
    setActiveRoute('chat');
  }, []);

  // For web screens that expect a `navigate` prop
  const navigateFn = useCallback(
    (path: string) => {
      // Map web route paths to desktop routes
      if (path === '/' || path === '') {
        setActiveRoute('home');
      } else if (path.startsWith('/chat')) {
        if (path.startsWith('/chat/')) {
          const friendId = path.replace('/chat/', '');
          handleOpenChatDetail(friendId);
        } else {
          setActiveRoute('chat');
        }
      } else if (path.startsWith('/study')) {
        setActiveRoute('study');
      } else if (path.startsWith('/snapshot')) {
        setActiveRoute('snapshot');
      } else if (path.startsWith('/map')) {
        setActiveRoute('map');
      } else if (path.startsWith('/profile')) {
        setActiveRoute('profile');
      } else if (path.startsWith('/pairing') || path === '/qr-pairing') {
        setActiveRoute('pairing');
      } else if (path.startsWith('/diagnostic')) {
        // Desktop doesn't have diagnostic screens yet
        setActiveRoute('home');
      } else if (path.startsWith('/points')) {
        // Not a primary desktop nav item
        setActiveRoute('home');
      } else if (path.startsWith('/wardrobe')) {
        setActiveRoute('home');
      }
    },
    [handleOpenChatDetail]
  );

  const renderContent = () => {
    // Desktop-native screens
    if (activeRoute === 'settings') {
      return <DesktopSettings />;
    }
    if (activeRoute === 'dashboard') {
      return <OpenClawDashboard />;
    }
    if (activeRoute === 'agents') {
      return <OpenClawAgents />;
    }
    if (activeRoute === 'channels') {
      return <OpenClawChannels />;
    }
    if (activeRoute === 'skills' || activeRoute === 'backups') {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {activeRoute === 'skills' ? '⚡' : '💾'}
            </div>
            <p style={{ marginBottom: 8, color: '#94a3b8' }}>
              {activeRoute === 'skills' ? 'Skill 管理' : '配置备份'}
            </p>
            <p style={{ fontSize: 12, color: '#475569' }}>
              请在「桌面设置」中使用对应标签页
            </p>
            <button
              onClick={() => handleNavigate('settings')}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              打开桌面设置
            </button>
          </div>
        </div>
      );
    }

    // Web screens wrapped in desktop layout
    const contentStyle: React.CSSProperties = {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
    };

    const wrappedContentStyle: React.CSSProperties = {
      ...contentStyle,
      height: '100%',
      width: '100%',
    };

    // Web screens need HashRouter + all providers for useNavigate, useAuth, useClawbotChannel, useTheme, useVoiceSettings
    const WebScreenWrapper = ({ children }: { children: React.ReactNode }) => (
      <HashRouter>
        <ThemeProvider>
          <VoiceSettingsProvider>
            <AuthProvider>
              <ClawbotChannelProvider>
                <div style={wrappedContentStyle}>{children}</div>
              </ClawbotChannelProvider>
            </AuthProvider>
          </VoiceSettingsProvider>
        </ThemeProvider>
      </HashRouter>
    );

    switch (activeRoute) {
      case 'home':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Home
                botState="IDLE"
                isUIVisible={true}
                onToggleUI={() => {}}
              />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'chat':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Chat />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'chat-detail':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <ChatDetail />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'study':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Study key="study-desktop" />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'snapshot':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Snapshot />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'map':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <SnapMapScreen />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'profile':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Profile />
            </Suspense>
          </WebScreenWrapper>
        );
      case 'pairing':
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Pairing />
            </Suspense>
          </WebScreenWrapper>
        );
      default:
        return (
          <WebScreenWrapper>
            <Suspense fallback={<RouteLoading />}>
              <Home botState="IDLE" isUIVisible={true} onToggleUI={() => {}} />
            </Suspense>
          </WebScreenWrapper>
        );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Title Bar (window controls area) */}
      <DesktopTitleBar standAlone />

      {/* Main content area: sidebar + page */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <DesktopSidebar activeItem={activeRoute} onNavigate={handleNavigate} />

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useCallback, Suspense, lazy } from 'react';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { VoiceSettingsProvider } from '@/contexts/VoiceSettingsContext';
import { ClawbotChannelProvider } from '@/contexts/ClawbotChannelContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { LuminaTitleBar } from '../lumina/components/TitleBar';
import { LuminaSidebar, type SidebarRoute } from '../lumina/components/Sidebar';
import { cn } from './cn';

// Desktop-native pages (stitch/noir/pages/)
// These will be imported once they're created
const StitchDashboard = lazy(() =>
  import('../noir/pages/DashboardPage').catch(() => ({ default: PlaceholderPage }))
);
const StitchAgents = lazy(() =>
  import('../noir/pages/AgentsPage').catch(() => ({ default: PlaceholderPage }))
);
const StitchChannels = lazy(() =>
  import('../noir/pages/ChannelsPage').catch(() => ({ default: PlaceholderPage }))
);
const StitchSettings = lazy(() =>
  import('../noir/pages/SettingsPage').catch(() => ({ default: PlaceholderPage }))
);

// Web screens
const Home = lazy(() => import('@/screens/Home'));
const Snapshot = lazy(() => import('@/screens/Snapshot'));
const Study = lazy(() => import('@/screens/Study'));
const Chat = lazy(() => import('@/screens/Chat'));
const ChatDetail = lazy(() => import('@/screens/ChatDetail'));
const Profile = lazy(() => import('@/screens/Profile'));
const Pairing = lazy(() => import('@/screens/Pairing'));
const SnapMapScreen = lazy(() => import('@/screens/SnapMapScreen'));

// Placeholder page shown before noir pages are created
const PlaceholderPage = ({ title, description }: { title: string; description?: string }) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#131313',
      color: '#e5e2e1',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 13, color: '#919191' }}>{description}</p>
      )}
    </div>
  </div>
);

type DesktopRoute =
  | 'home' | 'chat' | 'study' | 'snapshot' | 'map' | 'profile' | 'pairing' | 'chat-detail'
  | 'dashboard' | 'agents' | 'channels'
  | 'skills' | 'backups' | 'settings';

// Routes that use the dark Noir theme for content area
const DARK_ROUTES: DesktopRoute[] = [
  'dashboard',
  'agents',
  'channels',
  'settings',
  'backups',
  'skills',
];

// Routes that use the Lumina light theme for content area
const LIGHT_ROUTES: DesktopRoute[] = [
  'home',
  'chat',
  'study',
  'snapshot',
  'map',
  'profile',
  'pairing',
  'chat-detail',
];

interface LuminaLayoutProps {
  initialRoute?: DesktopRoute;
}

const RouteLoading = ({ dark = false }: { dark?: boolean }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: dark ? '#131313' : '#f7f9fb',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(0,0,0,0.1)',
          borderTopColor: dark ? '#ffffff' : '#630ed4',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      <p style={{ fontSize: 13, color: dark ? '#919191' : '#7b7487' }}>加载中...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

export function LuminaLayout({ initialRoute = 'home' }: LuminaLayoutProps) {
  const [activeRoute, setActiveRoute] = useState<DesktopRoute>(initialRoute);
  const [chatDetailId, setChatDetailId] = useState<string | null>(null);

  const isDark = DARK_ROUTES.includes(activeRoute);

  const handleNavigate = useCallback((id: string) => {
    if (id === 'chat-detail') return;
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

  // Web screen wrapper — provides all context providers + HashRouter
  const WebScreenWrapper = ({ children }: { children: React.ReactNode }) => (
    <HashRouter>
      <ThemeProvider>
        <VoiceSettingsProvider>
          <AuthProvider>
            <ClawbotChannelProvider>
              <div style={{ height: '100%', width: '100%' }}>{children}</div>
            </ClawbotChannelProvider>
          </AuthProvider>
        </VoiceSettingsProvider>
      </ThemeProvider>
    </HashRouter>
  );

  const renderContent = () => {
    // ── Dark desktop-native screens (Noir) ─────────────────────────────
    if (activeRoute === 'dashboard') {
      return (
        <Suspense fallback={<RouteLoading dark />}>
          <StitchDashboard />
        </Suspense>
      );
    }
    if (activeRoute === 'agents') {
      return (
        <Suspense fallback={<RouteLoading dark />}>
          <StitchAgents />
        </Suspense>
      );
    }
    if (activeRoute === 'channels') {
      return (
        <Suspense fallback={<RouteLoading dark />}>
          <StitchChannels />
        </Suspense>
      );
    }
    if (activeRoute === 'settings') {
      return (
        <Suspense fallback={<RouteLoading dark />}>
          <StitchSettings />
        </Suspense>
      );
    }
    if (activeRoute === 'skills' || activeRoute === 'backups') {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#131313',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#e5e2e1',
                marginBottom: 8,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {activeRoute === 'skills' ? 'Skill 管理' : '配置备份'}
            </p>
            <p style={{ fontSize: 12, color: '#919191', fontFamily: 'system-ui, sans-serif' }}>
              请在「桌面设置」中使用对应标签页
            </p>
            <button
              onClick={() => handleNavigate('settings')}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #ffffff, #d4d4d4)',
                color: '#1a1c1c',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              打开桌面设置
            </button>
          </div>
        </div>
      );
    }

    // ── Light web screens (Lumina) ──────────────────────────────────────
    const lightContentStyle: React.CSSProperties = {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f7f9fb',
    };

    switch (activeRoute) {
      case 'home':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Home botState="IDLE" isUIVisible={true} onToggleUI={() => {}} />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'chat':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Chat />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'chat-detail':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <ChatDetail />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'study':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Study key="study-desktop" />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'snapshot':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Snapshot />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'map':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <SnapMapScreen />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'profile':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Profile />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      case 'pairing':
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Pairing />
              </Suspense>
            </div>
          </WebScreenWrapper>
        );
      default:
        return (
          <WebScreenWrapper>
            <div style={lightContentStyle}>
              <Suspense fallback={<RouteLoading />}>
                <Home botState="IDLE" isUIVisible={true} onToggleUI={() => {}} />
              </Suspense>
            </div>
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
        overflow: 'hidden',
      }}
    >
      {/* Title Bar */}
      <LuminaTitleBar />

      {/* Main: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar (always Lumina light) */}
        <LuminaSidebar
          activeRoute={activeRoute as SidebarRoute}
          onNavigate={handleNavigate}
        />

        {/* Content area — switches between Lumina light and Noir dark */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#131313' : '#f7f9fb',
            transition: 'background 0.2s ease',
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

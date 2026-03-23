import React, { Component, useState, useCallback, Suspense, lazy } from 'react';
import { LuminaTitleBar } from '../lumina/components/TitleBar';
import { LuminaSidebar, type SidebarRoute } from '../lumina/components/Sidebar';

// Noir pages (stitch/noir/pages/) — dark themed
const NoirDashboard = lazy(() =>
  import('../noir/pages/DashboardPage').catch(() => ({ default: NoirPlaceholder }))
);
const NoirAgents = lazy(() =>
  import('../noir/pages/AgentsPage').catch(() => ({ default: NoirPlaceholder }))
);
const NoirChannels = lazy(() =>
  import('../noir/pages/ChannelsPage').catch(() => ({ default: NoirPlaceholder }))
);
const NoirSettings = lazy(() =>
  import('../noir/settings/SettingsContainer').catch(() => ({ default: NoirPlaceholder }))
);
const NoirBackups = lazy(() =>
  import('../noir/pages/BackupsPage').catch(() => ({ default: NoirPlaceholder }))
);

// Lumina pages (stitch/lumina/pages/) — light themed
const LuminaChat = lazy(() =>
  import('../lumina/pages/ChatPage').catch(() => ({ default: LuminaPlaceholder }))
);
const LuminaStudy = lazy(() =>
  import('../lumina/pages/StudyPage').catch(() => ({ default: LuminaPlaceholder }))
);
const LuminaSnapshot = lazy(() =>
  import('../lumina/pages/SnapshotPage').catch(() => ({ default: LuminaPlaceholder }))
);
const LuminaProfile = lazy(() =>
  import('../lumina/pages/ProfilePage').catch(() => ({ default: LuminaPlaceholder }))
);

type DesktopRoute =
  | 'chat' | 'study' | 'snapshot' | 'profile'
  | 'dashboard' | 'agents' | 'channels' | 'backups' | 'settings'
  | 'skills';

// Noir dark routes — content area bg: #131313
const DARK_ROUTES: DesktopRoute[] = [
  'dashboard',
  'agents',
  'channels',
  'backups',
  'settings',
  'skills',
];

// Lumina light routes — anything not in DARK_ROUTES gets #f7f9fb background

interface LuminaLayoutProps {
  initialRoute?: DesktopRoute;
}

// ErrorBoundary catches runtime errors in lazy-loaded pages
class PageErrorBoundary extends Component<
  { children: React.ReactNode; dark?: boolean },
  { hasError: boolean; error?: string }
> {
  constructor(props: { children: React.ReactNode; dark?: boolean }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      const dark = this.props.dark;
      return (
        <div
          style={{
            height: '100%',
            background: dark ? '#131313' : '#f7f9fb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: dark ? '#e5e2e1' : '#1a1c1c', marginBottom: 8 }}>
              页面加载失败
            </p>
            <p style={{ fontSize: 12, color: dark ? '#919191' : '#7b7487', marginBottom: 16 }}>
              {this.state.error ?? '未知错误'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '6px 16px',
                background: dark ? '#2a2a2a' : '#e8e0f0',
                color: dark ? '#e5e2e1' : '#630ed4',
                border: `1px solid ${dark ? '#3a3a3a' : '#d4c0e8'}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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

// Noir dark placeholder
const NoirPlaceholder = () => (
  <div style={{ height: '100%', background: '#131313', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <p style={{ color: '#919191', fontSize: 14 }}>加载中...</p>
  </div>
);

// Lumina light placeholder
const LuminaPlaceholder = () => (
  <div style={{ height: '100%', background: '#f7f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <p style={{ color: '#7b7487', fontSize: 14 }}>加载中...</p>
  </div>
);

export function LuminaLayout({ initialRoute = 'chat' }: LuminaLayoutProps) {
  const [activeRoute, setActiveRoute] = useState<DesktopRoute>(initialRoute);

  const isDark = DARK_ROUTES.includes(activeRoute);

  const handleNavigate = useCallback((id: string) => {
    setActiveRoute(id as DesktopRoute);
  }, []);

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: isDark ? '#131313' : '#f7f9fb',
    transition: 'background 0.2s ease',
  };

  const renderContent = () => {
    const fallback = <RouteLoading dark={isDark} />;

    switch (activeRoute) {
      // ── Lumina light pages ─────────────────────────────────────────────
      case 'chat':
        return (
          <PageErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <LuminaChat />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'study':
        return (
          <PageErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <LuminaStudy />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'snapshot':
        return (
          <PageErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <LuminaSnapshot />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'profile':
        return (
          <PageErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <LuminaProfile />
            </Suspense>
          </PageErrorBoundary>
        );

      // ── Noir dark pages ─────────────────────────────────────────────────
      case 'dashboard':
        return (
          <PageErrorBoundary dark>
            <Suspense fallback={fallback}>
              <NoirDashboard />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'agents':
        return (
          <PageErrorBoundary dark>
            <Suspense fallback={fallback}>
              <NoirAgents />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'channels':
        return (
          <PageErrorBoundary dark>
            <Suspense fallback={fallback}>
              <NoirChannels />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'backups':
        return (
          <PageErrorBoundary dark>
            <Suspense fallback={fallback}>
              <NoirBackups />
            </Suspense>
          </PageErrorBoundary>
        );
      case 'settings':
        return (
          <PageErrorBoundary dark>
            <Suspense fallback={fallback}>
              <NoirSettings />
            </Suspense>
          </PageErrorBoundary>
        );

      case 'skills':
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
              <p style={{ fontSize: 16, fontWeight: 600, color: '#e5e2e1', marginBottom: 8, fontFamily: 'system-ui' }}>
                Skill 管理
              </p>
              <p style={{ fontSize: 12, color: '#919191', fontFamily: 'system-ui' }}>
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
                  fontFamily: 'system-ui',
                }}
              >
                打开桌面设置
              </button>
            </div>
          </div>
        );

      default:
        return (
          <Suspense fallback={<RouteLoading />}>
            <LuminaChat />
          </Suspense>
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
        {/* Left sidebar — always Lumina light */}
        <LuminaSidebar
          activeRoute={activeRoute as SidebarRoute}
          onNavigate={handleNavigate}
        />

        {/* Content area */}
        <div style={contentStyle}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

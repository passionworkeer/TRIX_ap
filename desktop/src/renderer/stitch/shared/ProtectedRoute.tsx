import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LuminaButton } from '../lumina/components/buttons';

// Design tokens (Monolith Noir)
const C = {
  bg: '#0d0d0d',
  surface: '#131313',
  primary: '#630ed4',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#919191',
  outline: '#3a3a3a',
  error: '#ff6b6b',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  dark?: boolean;
}

export function ProtectedRoute({ children, dark = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dark ? C.surface : '#f7f9fb',
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
          <p style={{ fontSize: 13, color: dark ? C.onSurfaceVariant : '#7b7487' }}>
            验证中...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: dark ? C.surface : '#f7f9fb',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 360,
            textAlign: 'center',
            padding: '40px 32px',
            borderRadius: 16,
            background: dark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${dark ? C.outline : '#e6e8ea'}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `${C.primary}14`,
              border: `1px solid ${C.primary}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                fill={C.primary}
              />
            </svg>
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: dark ? C.onSurface : '#191c1e',
              margin: '0 0 8px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            请先登录
          </h2>
          <p
            style={{
              fontSize: 13,
              color: dark ? C.onSurfaceVariant : '#7b7280',
              lineHeight: 1.6,
              margin: '0 0 24px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            登录后可同步学习数据、成就徽章等到云端。
          </p>
          <LuminaButton
            variant="primary"
            size="md"
            label="前往账户设置"
            onClick={() => {
              // Navigate to settings — this will be handled by LuminaLayout's handleNavigate
              // The parent component should handle this via a callback or state
              window.electronAPI?.showMainWindow?.();
            }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

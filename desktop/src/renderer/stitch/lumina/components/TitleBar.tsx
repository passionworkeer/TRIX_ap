import React, { useState, useEffect } from 'react';
import { useTitleBarDrag } from '../../shared/WindowChrome';

interface LuminaTitleBarProps {
  children?: React.ReactNode;
}

export const LuminaTitleBar = ({ children }: LuminaTitleBarProps) => {
  const drag = useTitleBarDrag();
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.windowIsMaximized) return;
    api.windowIsMaximized().then(setIsMax);
    const onResize = () => { api.windowIsMaximized().then(setIsMax); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      className="app-drag-region"
      onMouseDown={drag.onMouseDown}
      onDoubleClick={() => window.electronAPI?.windowMaximize()}
      style={{
        height: 40,
        background: '#ffffff',
        borderBottom: '1px solid #e6e8ea',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 0,
        flexShrink: 0,
        userSelect: 'none',
        WebkitAppRegion: 'drag',
        zIndex: 100,
        position: 'relative',
      } as React.CSSProperties & { WebkitAppRegion?: 'drag' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 600, color: '#191c1e',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'none',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect width="18" height="18" rx="4" fill="#630ed4" />
          <path d="M9 3L14 13H4L9 3Z" fill="white" fillOpacity="0.9" />
          <circle cx="9" cy="10" r="1.5" fill="#630ed4" />
        </svg>
        <span>TRIX Companion</span>
      </div>

      {children && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {children}
        </div>
      )}

      <div
        className="app-no-drag"
        style={{
          display: 'flex', alignItems: 'stretch',
          marginLeft: 'auto', height: '100%',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties & { WebkitAppRegion?: 'no-drag' }}
      >
        <WinBtn title="最小化" onClick={() => window.electronAPI?.windowMinimize()}>
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </WinBtn>
        <WinBtn title={isMax ? '还原' : '最大化'} onClick={() => window.electronAPI?.windowMaximize()}>
          {isMax ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <rect x="0" y="2" width="8" height="8" fill="white" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x=".5" y=".5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          )}
        </WinBtn>
        <WinBtn title="关闭" danger onClick={() => window.electronAPI?.hideMainWindow()}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </WinBtn>
      </div>
    </div>
  );
};

function WinBtn({ title, danger, onClick, children }: {
  title: string; danger?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 46, height: '100%', border: 'none', background: 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4a4455', padding: 0, transition: 'background 0.12s ease, color 0.12s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = danger ? '#e81123' : '#e9e9eb';
        if (danger) el.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = 'transparent';
        el.style.color = '#4a4455';
      }}
    >
      {children}
    </button>
  );
}

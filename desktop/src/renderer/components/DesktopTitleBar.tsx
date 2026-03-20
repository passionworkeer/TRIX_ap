import React, { useCallback } from 'react';

interface TitleBarProps {
  children?: React.ReactNode;
  /** When true, renders only the bar itself (no wrapper, used inside DesktopLayout) */
  standAlone?: boolean;
}

type ElectronStyle = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

export function DesktopTitleBar({ children, standAlone = false }: TitleBarProps) {
  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeToTray();
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.minimizeToTray();
  }, []);

  const titleBarStyle: ElectronStyle = {
    height: '36px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    WebkitAppRegion: 'drag',
    userSelect: 'none',
    flexShrink: 0,
  };

  const windowControlsStyle: ElectronStyle = {
    display: 'flex',
    WebkitAppRegion: 'no-drag',
  };

  const titleBar = (
    <div style={titleBarStyle}>
      {/* App Icon + Title */}
      <div
        style={{
          flex: 1,
          paddingLeft: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px' }}>🤖</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.5px',
          }}
        >
          TRIX Companion
        </span>
      </div>

      {/* Window Controls */}
      <div style={windowControlsStyle}>
        <button
          onClick={handleMinimize}
          aria-label="最小化到托盘"
          style={{
            width: '46px',
            height: '36px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          ─
        </button>

        <button
          onClick={handleClose}
          aria-label="关闭到托盘"
          style={{
            width: '46px',
            height: '36px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e81123';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );

  // Stand-alone mode: just the bar, no wrapper
  if (standAlone) {
    return titleBar;
  }

  // Legacy mode: wraps children (used when rendering web App in title bar)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {titleBar}
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

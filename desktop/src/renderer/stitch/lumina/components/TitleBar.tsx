import React from 'react';

interface LuminaTitleBarProps {
  children?: React.ReactNode;
}

export const LuminaTitleBar = ({ children }: LuminaTitleBarProps) => {
  const handleMinimize = () => window.electronAPI?.minimizeToTray();
  const handleClose = () => window.electronAPI?.hideMainWindow();

  return (
    <div
      style={{
        height: 36,
        background: '#ffffff',
        borderBottom: '1px solid #e6e8ea',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 8,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Left: App branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: '#191c1e',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect width="18" height="18" rx="4" fill="#630ed4" />
          <path
            d="M9 3L14 13H4L9 3Z"
            fill="white"
            fillOpacity="0.9"
          />
          <circle cx="9" cy="10" r="1.5" fill="#630ed4" />
        </svg>
        <span>TRIX Companion</span>
      </div>

      {/* Center: optional children */}
      {children && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      )}

      {/* Right: window controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          marginLeft: 'auto',
        }}
      >
        <button
          onClick={handleMinimize}
          title="最小化到托盘"
          style={{
            width: 32,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4a4455',
            transition: 'background 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#e6e8ea';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <button
          onClick={handleClose}
          title="关闭"
          style={{
            width: 32,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4a4455',
            transition: 'background 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#e81123';
            (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#4a4455';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

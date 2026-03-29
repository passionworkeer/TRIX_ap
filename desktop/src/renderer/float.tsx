import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './float.css';
import type { BotState } from '../types/electron.d';
import { GlassPet } from './stitch/shared/GlassPet';

// electronAPI is injected by preload script at runtime.

type MenuItem = { label: string; action: () => void; danger?: boolean };

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: Math.min(y, window.innerHeight - items.length * 36 - 16),
          left: Math.min(x, window.innerWidth - 160),
          background: 'rgba(28,27,27,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '6px',
          minWidth: '160px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          zIndex: 10000,
        }}
      >
        {items.map((item, i) => {
          if (item.label === '─') {
            return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />;
          }
          return (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
              style={{
                padding: '9px 14px',
                borderRadius: '7px',
                fontSize: '13px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: item.danger ? '#f87171' : '#e5e7eb',
                cursor: 'pointer',
                transition: 'background 0.1s',
                letterSpacing: '0.3px',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = item.danger
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(255,255,255,0.09)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatApp() {
  const [botState, setBotState] = useState<BotState>('IDLE');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isTapping, setIsTapping] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ startX: number; startY: number; winX: number; winY: number; dragging: boolean } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Bot state subscription ────────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onBotStateChange) return;
    const unsubscribe = api.onBotStateChange((state) => {
      setBotState(state);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setIsFlashing(true);
      flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), 600);
    });
    return () => {
      unsubscribe();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // ── TRIX message listener — flash on incoming message ───────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onTrixMessage) return;
    const unsubscribe = api.onTrixMessage(() => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setIsFlashing(true);
      flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), 1500);
    });
    return () => {
      unsubscribe();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // ── Channel message listener — flash on real channel messages ───────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onChannelMessage) return;
    const unsubscribe = api.onChannelMessage(() => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setIsFlashing(true);
      flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), 1200);
    });
    return () => {
      unsubscribe();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Click: visual feedback + double-click to open chat ────────────────
  const handlePetClick = useCallback(() => {
    // Double-click detection
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Double-click: open main window chat
      window.electronAPI?.showMainWindow();
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      // Single click: flash + squish
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setIsFlashing(true);
      flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), 600);
      setIsTapping(true);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => setIsTapping(false), 400);
    }, 250);
  }, []);

  // ── Drag to move ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    const api = window.electronAPI;
    if (!api?.floatGetPosition || !api?.floatMove) return;
    api.floatGetPosition().then(([winX, winY]: [number, number]) => {
      dragState.current = { startX: e.screenX, startY: e.screenY, winX, winY, dragging: false };
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current) return;
    const dx = e.screenX - dragState.current.startX;
    const dy = e.screenY - dragState.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragState.current.dragging = true;
    }
    if (dragState.current.dragging) {
      window.electronAPI?.floatMove(dragState.current.winX + dx, dragState.current.winY + dy);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const handleOpenMain = useCallback(() => {
    window.electronAPI?.showMainWindow();
  }, []);

  const handleOpenChat = useCallback(() => {
    window.electronAPI?.showMainWindow();
  }, []);

  const menuItems: MenuItem[] = [
    { label: '💬  打开对话', action: handleOpenChat },
    { label: '🏠  打开主窗口', action: handleOpenMain },
    { label: '📱  扫码配对', action: handleOpenMain },
    { label: '─', action: () => {} },
    { label: '🚪  最小化到托盘', action: () => window.electronAPI?.minimizeToTray(), danger: true },
  ];

  return (
    <div
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: '14px',
        overflow: 'hidden',
        // Golden glow ring on flash (message arrived or state changed)
        boxShadow: isFlashing
          ? '0 0 0 3px rgba(255,183,77,0.65), 0 0 24px rgba(255,183,77,0.35)'
          : 'none',
        transition: 'box-shadow 0.25s ease',
        animation: isTapping ? 'pet-tap 0.4s ease' : 'none',
      }}
    >
      {/* Centered pet — fills the window */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <GlassPet botState={botState} size={200} onClick={handlePetClick} />
      </div>

      {/* Right-click context menu */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<FloatApp />);

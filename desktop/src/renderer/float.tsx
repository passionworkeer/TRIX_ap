import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import type { BotState } from '@/contexts/ClawbotChannelContext';
import { FloatHeroBackground } from './components/FloatHeroBackground';

// Declare electronAPI
declare global {
  interface Window {
    electronAPI?: {
      onBotStateChange: (callback: (state: BotState) => void) => () => void;
      showMainWindow: () => Promise<boolean>;
      platform: string;
      isDesktop: boolean;
    };
  }
}

function FloatApp() {
  const [botState, setBotState] = useState<BotState>('IDLE');

  useEffect(() => {
    // Listen for bot state changes from main process
    const api = window.electronAPI;
    if (!api?.onBotStateChange) {
      // Fallback: simulate idle state
      return;
    }

    const unsubscribe = api.onBotStateChange((state) => {
      setBotState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleClick = useCallback(() => {
    window.electronAPI?.showMainWindow();
  }, []);

  return (
    <div
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <FloatHeroBackground botState={botState} />

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          borderRadius: '8px',
          padding: '2px 8px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'none',
        }}
      >
        {botState === 'IDLE' ? '🤖 待机' : botState === 'THINKING' ? '💭 思考中' : '🗣 说话中'}
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <FloatApp />
  </React.StrictMode>
);

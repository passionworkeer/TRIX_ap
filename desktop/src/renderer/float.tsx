import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import type { BotState } from '../types/electron.d';
import { FloatHeroBackground } from './components/FloatHeroBackground';

// electronAPI is injected by preload script at runtime.


// Bot state labels
const BOT_STATE_LABELS: Record<BotState, string> = {
  IDLE: '🤖 待机',
  THINKING: '💭 思考中',
  SPEAKING: '🗣 说话中',
};

// Pairing status labels
const PAIRING_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ 等待配对',
  paired: '✅ 已配对',
  expired: '❌ 已过期',
};

function FloatApp() {
  const [botState, setBotState] = useState<BotState>('IDLE');

  // Pairing state
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isCreatingQr, setIsCreatingQr] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onBotStateChange) return;

    const unsubscribe = api.onBotStateChange((state) => {
      setBotState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((code: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      const api = window.electronAPI;
      if (!api?.pollPairingStatus) return;

      const result = await api.pollPairingStatus(code);
      if (!result.success) {
        setPairingError(result.error ?? '轮询失败');
        stopPolling();
        return;
      }

      setPairingStatus(result.status ?? null);

      if (result.status === 'paired') {
        // Paired! Stop polling and show success for a moment
        stopPolling();
        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowQrPanel(false);
          setQrDataUrl(null);
          setPairingCode(null);
          setPairingStatus(null);
        }, 3000);
      } else if (result.status === 'expired') {
        setPairingError('配对码已过期');
        stopPolling();
      }
    }, 2000);
  }, [stopPolling]);

  const handleShowQr = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.createPairingQr) return;

    setIsCreatingQr(true);
    setPairingError(null);
    setQrDataUrl(null);
    setPairingCode(null);
    setPairingStatus(null);

    const result = await api.createPairingQr('Desktop Float Window');

    if (!result.success || !result.qrDataUrl) {
      setPairingError(result.error ?? '创建配对码失败');
      setIsCreatingQr(false);
      return;
    }

    setQrDataUrl(result.qrDataUrl);
    setPairingCode(result.code ?? null);
    setPairingStatus(result.status ?? null);
    setIsCreatingQr(false);

    if (result.status === 'paired') return;

    // Start polling
    if (result.code) {
      startPolling(result.code);
    }
  }, [startPolling]);

  const handleHideQr = useCallback(() => {
    stopPolling();
    setShowQrPanel(false);
    setQrDataUrl(null);
    setPairingCode(null);
    setPairingStatus(null);
    setPairingError(null);
  }, [stopPolling]);

  const handlePanelClick = useCallback(() => {
    if (!showQrPanel) {
      window.electronAPI?.showMainWindow();
    }
  }, [showQrPanel]);

  const handleQrClick = useCallback((e: React.MouseEvent) => {
    // Don't propagate to panel click handler
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={handlePanelClick}
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

      {/* QR Toggle Button */}
      <div
        style={{
          position: 'absolute',
          bottom: showQrPanel ? undefined : '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {/* Status indicator */}
        <div
          style={{
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
          {BOT_STATE_LABELS[botState]}
        </div>

        {/* QR toggle button */}
        {!showQrPanel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowQrPanel(true);
              handleShowQr();
            }}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '10px',
              color: 'white',
              fontFamily: 'system-ui, sans-serif',
              cursor: 'pointer',
              fontWeight: 600,
              pointerEvents: 'auto',
            }}
          >
            📱 显示配对 QR
          </button>
        )}
      </div>

      {/* QR Panel */}
      {showQrPanel && (
        <div
          className="qr-panel"
          onClick={handleQrClick}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {/* Close button */}
          <button
            onClick={handleHideQr}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '18px',
            }}
          >
            ✕
          </button>

          {/* Panel title */}
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            用手机扫码配对
          </div>

          {/* QR Code */}
          {isCreatingQr && (
            <div
              style={{
                width: '120px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '10px',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              生成中...
            </div>
          )}

          {qrDataUrl && !isCreatingQr && (
            <img
              src={qrDataUrl}
              alt="Pairing QR Code"
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          )}

          {/* Pairing code */}
          {pairingCode && (
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'monospace',
                fontWeight: 600,
                letterSpacing: '1px',
              }}
            >
              {pairingCode}
            </div>
          )}

          {/* Status */}
          {pairingStatus && (
            <div
              style={{
                fontSize: '10px',
                color:
                  pairingStatus === 'paired'
                    ? '#4ade80'
                    : pairingStatus === 'expired'
                    ? '#f87171'
                    : 'rgba(255,255,255,0.6)',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {PAIRING_STATUS_LABELS[pairingStatus] ?? pairingStatus}
            </div>
          )}

          {/* Error */}
          {pairingError && (
            <div
              style={{
                fontSize: '9px',
                color: '#f87171',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                maxWidth: '160px',
              }}
            >
              {pairingError}
            </div>
          )}

          {/* Refresh button */}
          {!isCreatingQr && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShowQr();
              }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '9px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'system-ui, sans-serif',
                cursor: 'pointer',
              }}
            >
              刷新 QR
            </button>
          )}
        </div>
      )}
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

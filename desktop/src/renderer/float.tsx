import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import type { BotState } from '../types/electron.d';
import { FloatHeroBackground } from './components/FloatHeroBackground';

// electronAPI is injected by preload script at runtime.


// Bot state labels
const BOT_STATE_LABELS: Record<BotState, string> = {
  IDLE: '待机',
  THINKING: '思考中',
  SPEAKING: '说话中',
};

// Pairing status labels
const PAIRING_STATUS_LABELS: Record<string, string> = {
  pending: '等待配对',
  paired: '已配对',
  expired: '已过期',
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
        stopPolling();
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
    if (!api?.createQrCode) return;

    setIsCreatingQr(true);
    setPairingError(null);
    setQrDataUrl(null);
    setPairingCode(null);
    setPairingStatus(null);

    const result = await api.createQrCode('Desktop Float Window');

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
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={handlePanelClick}
      style={{
        width: '100%',
        height: '100%',
        background: '#131313',
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <FloatHeroBackground botState={botState} />

      {/* Dark overlay so video reads well under noir UI */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(19,19,19,0.55)',
          borderRadius: '12px',
          pointerEvents: 'none',
        }}
      />

      {/* Status indicator pill */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '20px',
          padding: '3px 12px',
          fontSize: '11px',
          color: '#f2f4f6',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 500,
          pointerEvents: 'none',
          letterSpacing: '0.3px',
          whiteSpace: 'nowrap',
        }}
      >
        {BOT_STATE_LABELS[botState]}
      </div>

      {/* QR toggle button */}
      {!showQrPanel && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowQrPanel(true);
              handleShowQr();
            }}
            style={{
              background: 'rgba(255,255,255,0.90)',
              border: 'none',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '11px',
              color: '#131313',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.2px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.90)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            配对
          </button>
        </div>
      )}

      {/* QR Panel — glassmorphism noir panel */}
      {showQrPanel && (
        <div
          onClick={handleQrClick}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(32,31,31,0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px 12px 0 0',
            padding: '12px 12px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '2px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: 'rgba(242,244,246,0.50)',
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              扫码配对
            </span>

            {/* Close button — no-drag */}
            <button
              onClick={handleHideQr}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '6px',
                width: '22px',
                height: '22px',
                color: 'rgba(242,244,246,0.60)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                padding: 0,
                transition: 'all 0.15s ease',
                pointerEvents: 'auto',
                WebkitAppRegion: 'no-drag',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.20)';
                (e.currentTarget as HTMLButtonElement).style.color = '#ffb4ab';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,68,68,0.30)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,244,246,0.60)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)';
              }}
            >
              ✕
            </button>
          </div>

          {/* QR Code or loading */}
          {isCreatingQr ? (
            <div
              style={{
                width: '128px',
                height: '128px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(242,244,246,0.40)',
                fontSize: '10px',
                fontFamily: 'system-ui, sans-serif',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
              }}
            >
              生成中...
            </div>
          ) : qrDataUrl ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.96)',
                borderRadius: '10px',
                padding: '8px',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={qrDataUrl}
                alt="Pairing QR Code"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '6px',
                  display: 'block',
                }}
              />
            </div>
          ) : null}

          {/* Pairing code */}
          {pairingCode && (
            <div
              style={{
                fontSize: '13px',
                color: '#f2f4f6',
                fontFamily: '"SF Mono", "Cascadia Code", monospace',
                fontWeight: 600,
                letterSpacing: '2px',
                opacity: 0.85,
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
                    ? '#ffb4ab'
                    : 'rgba(242,244,246,0.55)',
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 500,
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
                color: '#ffb4ab',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                maxWidth: '160px',
                lineHeight: 1.4,
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
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '9px',
                color: 'rgba(242,244,246,0.50)',
                fontFamily: 'system-ui, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                letterSpacing: '0.3px',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,244,246,0.80)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,244,246,0.50)';
              }}
            >
              刷新
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

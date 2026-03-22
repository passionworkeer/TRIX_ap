import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './desktop.css';
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

// Quick reply phrases
const QUICK_REPLIES = ['好的', '稍等', '谢谢', '在吗', '了解', '收到'];

// Emoji reactions (text-based for zero deps)
const EMOJI_REACTIONS = [
  { emoji: '👍', label: '点赞' },
  { emoji: '❤️', label: '喜欢' },
  { emoji: '😂', label: '好笑' },
];

const MAX_CHARS = 200;

function FloatApp() {
  const [botState, setBotState] = useState<BotState>('IDLE');

  // Pairing state
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isCreatingQr, setIsCreatingQr] = useState(false);

  // TRIX chat state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; content: string; direction: 'incoming' | 'outgoing'; timestamp: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showChatBar, setShowChatBar] = useState(false);

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active emoji animation
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);
  const activeEmojiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Bot state subscription ─────────────────────────────────────────────────

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

  // ── TRIX message listener ──────────────────────────────────────────────────

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onTrixMessage) return;

    const unsubscribe = api.onTrixMessage((msg) => {
      setUnreadCount((c) => c + 1);
      // Trigger title bar flash
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setIsFlashing(true);
      flashTimeoutRef.current = setTimeout(() => setIsFlashing(false), 2000);
      // Append incoming message to local list
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          content: msg.content,
          direction: 'incoming',
          timestamp: msg.timestamp,
        },
      ]);
    });

    return () => {
      unsubscribe();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // ── Load first conversation on mount ───────────────────────────────────────

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.listConversations) return;

    api.listConversations().then((result) => {
      if (result.success && result.data && result.data.length > 0) {
        setActiveConversationId(result.data[0].id);
        // Load messages for this conversation
        api.fetchMessages(result.data[0].id).then((msgResult) => {
          if (msgResult.success && msgResult.data) {
            setMessages(msgResult.data);
          }
        });
      }
    });
  }, []);

  // ── Cleanup polling on unmount ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (activeEmojiTimeoutRef.current) {
        clearTimeout(activeEmojiTimeoutRef.current);
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

  // ── QR Panel handlers ──────────────────────────────────────────────────────

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

  // ── Quick reply handler ───────────────────────────────────────────────────

  const handleQuickReply = useCallback(async (text: string) => {
    if (!activeConversationId) {
      // No conversation yet — skip silently
      return;
    }
    const api = window.electronAPI;
    if (!api?.sendMessage) return;

    setIsSending(true);
    setSendError(null);

    const result = await api.sendMessage(activeConversationId, text);
    if (!result.success) {
      setSendError(result.error ?? '发送失败');
    } else if (result.data) {
      setMessages((prev) => [...prev, result.data!]);
    }
    setIsSending(false);
  }, [activeConversationId]);

  // ── Message input handler ─────────────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;
    setInputText('');
    await handleQuickReply(text);
  }, [inputText, isSending, handleQuickReply]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ── Emoji reaction handler ────────────────────────────────────────────────

  const handleReaction = useCallback((emoji: string) => {
    if (activeEmojiTimeoutRef.current) clearTimeout(activeEmojiTimeoutRef.current);
    setActiveEmoji(emoji);
    activeEmojiTimeoutRef.current = setTimeout(() => setActiveEmoji(null), 400);

    // Send reaction — best-effort, no error shown in float window
    const api = window.electronAPI;
    if (!api?.sendReaction || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.direction !== 'incoming') return;
    api.sendReaction(lastMsg.id, emoji).catch(() => { /* silent */ });
  }, [messages]);

  // ── Mark unread read ──────────────────────────────────────────────────────

  const handleMarkRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = charCount > 0 && !isOverLimit && !isSending;

  return (
    <div
      onClick={() => {
        handlePanelClick();
        if (showChatBar) handleMarkRead();
      }}
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

      {/* Status indicator pill — with unread badge + flash */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${isFlashing ? 'rgba(255,204,77,0.6)' : 'rgba(255,255,255,0.10)'}`,
          borderRadius: '20px',
          padding: '3px 12px',
          fontSize: '11px',
          color: '#f2f4f6',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 500,
          pointerEvents: 'auto',
          letterSpacing: '0.3px',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.3s ease',
          animation: isFlashing ? 'noirFlash 0.5s ease-in-out 4' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'default',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!showQrPanel) {
            setShowChatBar((v) => !v);
            handleMarkRead();
          }
        }}
      >
        <span>{BOT_STATE_LABELS[botState]}</span>
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ff4444',
              color: '#fff',
              borderRadius: '10px',
              padding: '0 5px',
              fontSize: '10px',
              fontWeight: 700,
              minWidth: '16px',
              textAlign: 'center',
              lineHeight: '16px',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {/* Chat bar (collapsible) — shown when showChatBar is true */}
      {showChatBar && !showQrPanel && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(32,31,31,0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px 12px 0 0',
            padding: '8px 10px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            pointerEvents: 'auto',
          }}
        >
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isSending}
              placeholder="发送消息..."
              maxLength={MAX_CHARS + 10}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${isOverLimit ? '#ffb4ab' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#f2f4f6',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
                transition: 'border-color 0.15s ease',
                minWidth: 0,
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.25)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = isOverLimit
                  ? '#ffb4ab'
                  : 'rgba(255,255,255,0.12)';
              }}
            />
            {/* Send button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSendMessage();
              }}
              disabled={!canSend}
              style={{
                background: canSend ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)',
                border: 'none',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'not-allowed',
                opacity: canSend ? 1 : 0.5,
                transition: 'all 0.15s ease',
                flexShrink: 0,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (canSend) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = canSend
                  ? 'rgba(255,255,255,0.90)'
                  : 'rgba(255,255,255,0.10)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
            >
              {isSending ? (
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '1.5px solid rgba(19,19,19,0.3)',
                    borderTopColor: '#131313',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>

          {/* Char count + error */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '10px',
                color: isOverLimit ? '#ffb4ab' : 'rgba(242,244,246,0.40)',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {charCount}/{MAX_CHARS}
            </span>
            {sendError && (
              <span style={{ fontSize: '10px', color: '#ffb4ab', fontFamily: 'system-ui, sans-serif' }}>
                {sendError}
              </span>
            )}
          </div>

          {/* Quick replies */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {QUICK_REPLIES.map((phrase) => (
              <button
                key={phrase}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickReply(phrase);
                }}
                disabled={isSending}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: 'rgba(242,244,246,0.70)',
                  fontFamily: 'system-ui, sans-serif',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  opacity: isSending ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={(e) => {
                  if (!isSending) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#f2f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,244,246,0.70)';
                }}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Emoji reactions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(242,244,246,0.35)', fontFamily: 'system-ui, sans-serif' }}>
              反应:
            </span>
            {EMOJI_REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(emoji);
                }}
                title={label}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  transform: activeEmoji === emoji ? 'scale(1.4)' : 'scale(1)',
                  lineHeight: 1.2,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  if (activeEmoji === emoji) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.4)';
                  } else {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR toggle button — hidden when chat bar or QR panel is open */}
      {!showQrPanel && !showChatBar && (
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
            padding: '10px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
            pointerEvents: 'auto',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '1px',
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

            {/* Close button */}
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

          {/* Quick replies inside QR panel */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
            {QUICK_REPLIES.map((phrase) => (
              <button
                key={phrase}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickReply(phrase);
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: 'rgba(242,244,246,0.70)',
                  fontFamily: 'system-ui, sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#f2f4f6';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,244,246,0.70)';
                }}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Emoji reactions inside QR panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(242,244,246,0.35)', fontFamily: 'system-ui, sans-serif' }}>
              反应:
            </span>
            {EMOJI_REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(emoji);
                }}
                title={label}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  transform: activeEmoji === emoji ? 'scale(1.4)' : 'scale(1)',
                  lineHeight: 1.2,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  if (activeEmoji === emoji) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.4)';
                  } else {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

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

      {/* Global keyframes for animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes noirFlash {
          0%, 100% { border-color: rgba(255,255,255,0.10); }
          50% { border-color: rgba(255,204,77,0.7); box-shadow: 0 0 8px rgba(255,204,77,0.4); }
        }
      `}</style>
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

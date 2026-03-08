/**
 * VoiceRecorder Component
 * ============================================
 * WeChat-style voice recording modal with press-to-record functionality
 * Features:
 * - Bottom sheet modal design
 * - Press and hold to record
 * - Slide up to cancel
 * - Recording duration display
 * - Simple waveform animation
 * - Dark/light theme support
 * - Touch gesture support
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Lock } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { logger } from '../utils/logger';

/**
 * Format seconds to mm:ss display
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface VoiceRecorderProps {
  /** Whether the recorder modal is visible */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when recording completes with audio blob and duration */
  onComplete: (blob: Blob, duration: number) => void;
}

/**
 * VoiceRecorder - WeChat-style voice recording modal
 *
 * @example
 * ```tsx
 * const [isRecorderOpen, setRecorderOpen] = useState(false);
 *
 * <VoiceRecorder
 *   isOpen={isRecorderOpen}
 *   onClose={() => setRecorderOpen(false)}
 *   onComplete={(blob, duration) => {
 *     // Handle the recorded audio
 *   }}
 * />
 * ```
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  // Recording state
  const [isSlideCancel, setIsSlideCancel] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Refs
  const buttonRef = useRef<HTMLDivElement>(null);
  const cancelThreshold = 80; // pixels to trigger cancel

  // Voice recorder hook
  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  } = useVoiceRecorder({
    onStart: () => {
      logger.media.debug('[VoiceRecorder] Recording started');
    },
    onStop: (blob, recordedDuration) => {
      logger.media.debug('[VoiceRecorder] Recording stopped', {
        duration: recordedDuration,
      });
      onComplete(blob, recordedDuration);
    },
    onError: (errMsg) => {
      logger.media.error('[VoiceRecorder] Recording error:', errMsg);
    },
  });

  // Handle touch/mouse events for recording
  const handleStartRecording = useCallback(async () => {
    if (!isRecording) {
      await startRecording();
    }
  }, [isRecording, startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (isRecording) {
      if (isSlideCancel) {
        // Cancel the recording
        cancelRecording();
        setIsSlideCancel(false);
      } else {
        // Stop and return the recording
        await stopRecording();
      }
    }
  }, [isRecording, isSlideCancel, stopRecording, cancelRecording]);

  // Touch event handlers for slide-to-cancel
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isRecording) return;
    const touch = e.touches[0];
    if (touch) {
      setTouchStartY(touch.clientY);
    }
  }, [isRecording]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isRecording || touchStartY === null) return;

    const touch = e.touches[0];
    if (!touch) return;

    const currentY = touch.clientY;
    const deltaY = touchStartY - currentY; // Positive = sliding up

    if (deltaY > cancelThreshold) {
      setIsSlideCancel(true);
    } else {
      setIsSlideCancel(false);
    }
  }, [isRecording, touchStartY]);

  const handleTouchEnd = useCallback(() => {
    setTouchStartY(null);
  }, []);

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = useCallback(() => {
    handleStartRecording();
  }, [handleStartRecording]);

  const handleMouseUp = useCallback(() => {
    handleStopRecording();
  }, [handleStopRecording]);

  const handleMouseLeave = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    }
  }, [isRecording, handleStopRecording]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        cancelRecording();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRecording) {
          cancelRecording();
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRecording, cancelRecording, onClose]);

  // Render nothing if not open
  if (!isOpen) return null;

  // Error state
  const errorContent = error ? (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      </div>
      <button
        onClick={onClose}
        className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium"
      >
        关闭
      </button>
    </div>
  ) : null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[1001] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (isRecording) {
                cancelRecording();
              }
              onClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Recording Panel */}
          <motion.div
            className="relative w-full max-w-md mx-4 mb-6 rounded-3xl overflow-hidden"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="bg-slate-900 dark:bg-slate-900 border border-slate-700/50">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h3 className="text-white font-medium">语音录制</h3>
                <button
                  onClick={() => {
                    if (isRecording) {
                      cancelRecording();
                    }
                    onClose();
                  }}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="关闭录音面板"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {errorContent ? (
                  errorContent
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    {/* Waveform Animation (when recording) */}
                    <AnimatePresence mode="wait">
                      {isRecording && !isSlideCancel ? (
                        <motion.div
                          key="recording"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-1 h-12"
                        >
                          <WaveBar delay={0} />
                          <WaveBar delay={1} />
                          <WaveBar delay={2} />
                          <WaveBar delay={3} />
                          <WaveBar delay={4} />
                          <WaveBar delay={5} />
                          <WaveBar delay={6} />
                          <WaveBar delay={7} />
                        </motion.div>
                      ) : isSlideCancel ? (
                        <motion.div
                          key="cancel"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-2 text-red-400"
                        >
                          <Lock size={20} />
                          <span className="text-red-400 font-medium">
                            取消发送
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-slate-400"
                        >
                          <Mic size={48} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">点击下方按钮开始录音</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Duration Display */}
                    <div className="text-3xl font-mono text-white tabular-nums">
                      {formatDuration(duration)}
                    </div>

                    {/* Recording Button */}
                    <div
                      ref={buttonRef}
                      className={`
                        relative flex items-center justify-center
                        w-24 h-24 rounded-full
                        transition-all duration-200
                        ${isRecording
                          ? isSlideCancel
                            ? 'bg-red-500/20 border-2 border-red-500'
                            : 'bg-violet-500/20 border-2 border-violet-500 scale-110'
                          : 'bg-slate-800 border-2 border-slate-600 hover:border-violet-500'
                        }
                      `}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                    >
                      {/* Recording indicator */}
                      {isRecording && !isSlideCancel && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-red-500/30"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.2, 0.5],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}

                      {/* Mic Icon */}
                      <Mic
                        size={36}
                        className={`
                          relative z-10 transition-colors duration-200
                          ${isRecording
                            ? isSlideCancel
                              ? 'text-red-500'
                              : 'text-red-500 animate-pulse'
                            : 'text-slate-400'
                          }
                        `}
                      />
                    </div>

                    {/* Instructions */}
                    <div className="text-center h-6">
                      {isRecording ? (
                        isSlideCancel ? (
                          <p className="text-red-400 text-sm font-medium">
                            松开手指取消发送
                          </p>
                        ) : (
                          <p className="text-slate-400 text-sm">
                            松开手指完成录音
                          </p>
                        )
                      ) : (
                        <p className="text-slate-500 text-sm">
                          按住说话，上滑取消
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/**
 * Individual wave bar for the waveform animation
 */
const WaveBar: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <motion.div
      className="w-1 bg-violet-500 rounded-full"
      animate={{
        height: [8, 24, 16, 32, 12, 28, 8],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        delay: delay * 0.1,
        ease: 'easeInOut',
      }}
    />
  );
};

export default VoiceRecorder;

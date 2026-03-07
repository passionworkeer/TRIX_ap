/**
 * VoiceMessage Component
 * ============================================
 * Audio message player with play/pause, duration, progress bar, and transcript support
 * Features:
 * - Play/pause toggle
 * - Duration display (formatted as mm:ss)
 * - Progress bar showing playback position
 * - Optional transcript display
 * - Dark/light theme support
 * - Hover effects on play button
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, FileText } from 'lucide-react';
import { logger } from '../utils/logger';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Format seconds to mm:ss display
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface VoiceMessageProps {
  /** Audio file URL */
  url: string;
  /** Audio duration in seconds */
  duration: number;
  /** Optional transcript text */
  transcript?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the progress bar */
  showProgress?: boolean;
  /** Whether to auto-play when loaded */
  autoPlay?: boolean;
  /** Styling variant based on who sent the message */
  variant?: 'sender' | 'receiver';
  /** Callback when playback starts */
  onPlay?: () => void;
  /** Callback when playback pauses */
  onPause?: () => void;
  /** Callback when playback ends */
  onEnded?: () => void;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  url,
  duration,
  transcript,
  className = '',
  showProgress = true,
  autoPlay = false,
  variant = 'receiver',
  onPlay,
  onPause,
  onEnded,
}) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      setIsLoading(false);
      logger.media.debug('[VoiceMessage] Audio loaded:', {
        duration: audio.duration,
        url: url.substring(0, 50) + '...'
      });
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
      logger.media.debug('[VoiceMessage] Playback ended');
    });

    audio.addEventListener('error', async (e) => {
      // 尝试通过 fetch 加载音频以绕过 CORS 问题
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          audio.src = blobUrl;
          audio.load();
          setIsLoading(true);
          logger.media.debug('[VoiceMessage] Loaded via fetch + blob URL');
          return;
        }
      } catch (fetchError) {
        logger.media.error('[VoiceMessage] Fetch fallback failed:', fetchError);
      }

      const errorMsg = '音频加载失败';
      setError(errorMsg);
      setIsLoading(false);
      logger.media.error('[VoiceMessage] Audio load error:', e);
    });

    audio.addEventListener('canplay', () => {
      setIsLoading(false);
    });

    // Handle autoplay
    if (autoPlay) {
      audio.play().catch((err) => {
        logger.media.warn('[VoiceMessage] Autoplay blocked:', err);
      });
    }

    // Cleanup
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [url, autoPlay, onEnded]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || error) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
      logger.media.debug('[VoiceMessage] Paused');
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        onPlay?.();
        logger.media.debug('[VoiceMessage] Playing');
      }).catch((err) => {
        logger.media.error('[VoiceMessage] Play error:', err);
      });
    }
  }, [isPlaying, error, onPlay, onPause]);

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !showProgress || error) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    logger.media.debug('[VoiceMessage] Seek to:', newTime);
  }, [duration, showProgress, error]);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Determine variant-specific classes
  const isSender = variant === 'sender';
  
  const playBtnClass = isSender
    ? (isLoading ? 'bg-blue-400/20 cursor-wait' : 'bg-white hover:bg-blue-50 active:scale-95 cursor-pointer')
    : (isLoading ? 'bg-slate-100 dark:bg-slate-800 cursor-wait' : 'bg-violet-100 dark:bg-violet-900/40 hover:bg-violet-200 dark:hover:bg-violet-800/40 active:scale-95 cursor-pointer');

  const iconClass = isSender
    ? 'text-blue-500'
    : 'text-violet-600 dark:text-violet-400';

  const spinnerClass = isSender
    ? 'border-blue-200 border-t-blue-500'
    : 'border-violet-300 dark:border-violet-600 border-t-violet-600 dark:border-t-violet-400';
    
  const trackClass = isSender ? 'bg-blue-400/30' : 'bg-slate-200 dark:bg-slate-700';
  const progressFillClass = isSender ? 'bg-white' : 'bg-violet-500 dark:bg-violet-400';
  const thumbClass = isSender ? 'bg-white' : 'bg-white dark:bg-slate-200';
  const timeTextClass = isSender ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400';
  const durationTextClass = isSender ? 'text-white' : 'text-slate-600 dark:text-slate-300';
  
  const transcriptBtnClass = isSender 
    ? 'text-blue-100 hover:text-white' 
    : 'text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400';
  const transcriptBgClass = isSender ? 'bg-blue-600/30' : 'bg-slate-50 dark:bg-slate-800/50';
  const transcriptTextClass = isSender ? 'text-white' : 'text-slate-700 dark:text-slate-300';

  // Error state
  if (error) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${className}`}>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-red-500 dark:text-red-400" />
        </div>
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Main player row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className={`
            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            transition-all duration-200
            ${isLoading
              ? 'bg-slate-100 dark:bg-slate-800 cursor-wait'
              : 'bg-violet-100 dark:bg-violet-900/40 hover:bg-violet-200 dark:hover:bg-violet-800/40 active:scale-95 cursor-pointer'
            }
          `}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isLoading ? (
            <div className={`w-5 h-5 border-2 rounded-full animate-spin ${spinnerClass}`} />
          ) : isPlaying ? (
            <Pause className={`w-5 h-5 ${iconClass}`} />
          ) : (
            <Play className={`w-5 h-5 ml-0.5 ${iconClass}`} />
          )}
        </button>

        {/* Duration and progress */}
        <div className="flex-1 min-w-0">
          {showProgress ? (
            /* Progress bar mode */
            <div className="flex flex-col gap-1.5">
              {/* Progress bar */}
              <div
                onClick={handleProgressClick}
                className={`relative h-2 rounded-full cursor-pointer group ${trackClass}`}
                role="slider"
                aria-label="播放进度"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
              >
                {/* Progress fill */}
                <div
                  className={`absolute left-0 top-0 h-full rounded-full transition-all duration-100 ${progressFillClass}`}
                  style={{ width: `${progress}%` }}
                />
                {/* Thumb indicator */}
                <div
                  className={`
                    absolute top-1/2 -translate-y-1/2 w-3 h-3
                    ${thumbClass} rounded-full shadow-sm
                    transition-opacity duration-150
                    ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>
              {/* Time display */}
              <div className={`flex justify-between text-xs ${timeTextClass}`}>
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          ) : (
            /* Simple duration mode */
            <span className={`text-sm font-medium ${durationTextClass}`}>
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Transcript section */}
      {transcript && (
        <div className="mt-2">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${transcriptBtnClass}`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showTranscript ? '隐藏转文字' : '显示转文字'}</span>
          </button>

          {showTranscript && (
            <div className={`mt-2 p-3 rounded-lg ${transcriptBgClass}`}>
              <p className={`text-sm leading-relaxed ${transcriptTextClass}`}>
                {transcript ? escapeHtml(transcript) : '无转文字内容'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceMessage;

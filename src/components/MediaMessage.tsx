/**
 * 🖼�?MediaMessage Component
 * ============================================
 * Renders images or videos in chat message bubbles
 * Features:
 * - Lazy loading for images
 * - Video controls with preload
 * - Error handling with fallback UI
 * - Loading skeleton states
 */

import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Video, X } from 'lucide-react';
import { logger } from '../utils/logger';

interface MediaMessageProps {
  uri: string;
  type: 'image' | 'video';
  alt?: string;
  className?: string;
  maxSize?: 'sm' | 'md' | 'lg' | 'full';
  thumbnail?: string;  // Optional thumbnail URI
}

function useVideoBlobFallback(uri: string, onFailure: () => void, logLabel: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBlobUrl(null);
  }, [uri]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleVideoError = async () => {
    if (blobUrl || abortControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) {
        throw new Error('Fetch failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }

      setBlobUrl(url);
      logger.media.debug(`[${logLabel}] Video loaded via fetch + blob URL`);
    } catch (fetchError) {
      if (controller.signal.aborted) {
        return;
      }

      logger.media.error(`[${logLabel}] Video fetch fallback failed:`, fetchError);
      onFailure();
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return { blobUrl, handleVideoError };
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  uri,
  type,
  alt = 'Media',
  className = '',
  maxSize = 'lg',
  thumbnail
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { blobUrl, handleVideoError } = useVideoBlobFallback(
    uri,
    () => {
      setIsLoading(false);
      setError(true);
    },
    'MediaMessage',
  );

  // Performance monitoring
  const loadStart = React.useRef<number>(0);

  // Debug log
  logger.media.debug('🖼�?[MediaMessage] Rendering:', {
    type,
    uri,
    thumbnail,
    uriLength: uri?.length,
    uriPreview: uri?.substring(0, 100)
  });

  // Size classes
  const sizeClasses = {
    sm: 'max-w-[120px]',
    md: 'max-w-[200px]',
    lg: 'max-w-[280px]',
    full: 'max-w-full'
  };

  const sizeClass = sizeClasses[maxSize];

  useEffect(() => {
    setIsLoading(true);
    setError(false);
  }, [uri, type]);

  // Error state
  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 ${className} ${sizeClass}`}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
          <X size={14} />
          <span>加载失败</span>
        </div>
      </div>
    );
  }

  // Image rendering
  if (type === 'image') {
    return (
      <div className={`relative ${className} ${sizeClass}`}>
        {/* Loading skeleton */}
        {isLoading && (
          <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse flex items-center justify-center">
            <ImageIcon className="text-slate-400 dark:text-slate-600" size={32} />
          </div>
        )}

        {/* Image with performance monitoring */}
        <img
          src={uri}
          alt={alt}
          className={`w-full h-auto rounded-lg shadow-sm transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => {
            const loadTime = performance.now() - loadStart.current;
            logger.media.debug(`�?[MediaMessage] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
            setIsLoading(false);
          }}
          onError={() => {
            logger.media.error('�?[MediaMessage] Image load failed:', uri);
            setIsLoading(false);
            setError(true);
          }}
          loading="lazy"
          decoding="async"
          fetchPriority="auto"
          onLoadStart={() => {
            loadStart.current = performance.now();
          }}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    );
  }

  // Video rendering
  if (type === 'video') {
    return (
      <div className={`relative ${className} ${sizeClass}`}>
        {/* Loading skeleton */}
        {isLoading && (
          <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse flex items-center justify-center">
            <Video className="text-slate-400 dark:text-slate-600" size={32} />
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          src={blobUrl || uri}
          controls
          poster={thumbnail}
          className={`w-full h-auto rounded-lg shadow-sm transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoadedData={() => setIsLoading(false)}
          onError={handleVideoError}
          preload="metadata"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    );
  }

  return null;
};

/**
 * 📎 MediaMessageInline Component
 * ============================================
 * Compact version for inline media display in message bubbles
 * (smaller, no border, optimized for chat)
 */
interface MediaMessageInlineProps {
  uri: string;
  type: 'image' | 'video';
  onClick?: () => void;
  onClose?: () => void; // 添加关闭回调
}

export const MediaMessageInline: React.FC<MediaMessageInlineProps> = ({
  uri,
  type,
  onClick,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadStart = React.useRef<number>(0);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const { blobUrl, handleVideoError } = useVideoBlobFallback(
    uri,
    () => {
      logger.debug('MediaMessage', 'Failed to load media');
      setIsLoading(false);
      setError(true);
    },
    'MediaMessageInline',
  );

  useEffect(() => {
    setIsLoading(true);
    setError(false);
  }, [uri, type]);

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 w-full max-w-[80px]">
        <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-[10px]">
          <X size={12} />
          <span>失败</span>
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="relative w-[80px] h-[80px] flex-shrink-0">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        )}
        {/* 图片容器 */}
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-sm">
          <img
            src={uri}
            alt="Image"
            className={`w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={() => {
              const loadTime = performance.now() - loadStart.current;
              logger.media.debug(`�?[MediaMessageInline] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
              setIsLoading(false);
            }}
            onError={() => {
              logger.media.error('�?[MediaMessageInline] Image load failed:', uri);
              setIsLoading(false);
              setError(true);
            }}
            loading="lazy"
            decoding="async"
            onLoadStart={() => {
              loadStart.current = performance.now();
            }}
            onClick={onClick}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
        {/* 右上角关闭按�?*/}
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ios-pressable absolute -top-1.5 -right-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white p-2.5 text-black shadow-md hover:bg-gray-100"
            aria-label="删除媒体"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="relative w-[80px] h-[80px] flex-shrink-0">
        {isLoading && (
          <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        )}
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-sm">
          <video
            ref={inlineVideoRef}
            src={blobUrl || uri}
            className={`w-full h-full object-cover cursor-pointer ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoadedData={() => setIsLoading(false)}
            onError={handleVideoError}
            preload="metadata"
            onClick={onClick}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ios-pressable absolute -top-1.5 -right-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white p-2.5 text-black shadow-md hover:bg-gray-100"
            aria-label="删除视频"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default MediaMessage;

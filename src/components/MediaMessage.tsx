/**
 * 🖼️ MediaMessage Component
 * ============================================
 * Renders images or videos in chat message bubbles
 * Features:
 * - Lazy loading for images
 * - Video controls with preload
 * - Error handling with fallback UI
 * - Loading skeleton states
 */

import React, { useState, useRef } from 'react';
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

  // Performance monitoring
  const loadStart = React.useRef<number>(0);

  // Debug log
  logger.media.debug('🖼️ [MediaMessage] Rendering:', {
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
            logger.media.debug(`✅ [MediaMessage] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
            setIsLoading(false);
          }}
          onError={() => {
            logger.media.error('❌ [MediaMessage] Image load failed:', uri);
            setIsLoading(false);
            setError(true);
          }}
          loading="eager"
          decoding="async"
          fetchpriority="high"
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    // 尝试加载视频，失败则尝试 fetch + blob
    const handleVideoError = async () => {
      if (blobUrl) return; // 已经尝试过了

      try {
        const response = await fetch(uri);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          logger.media.debug('[MediaMessage] Video loaded via fetch + blob URL');
        } else {
          throw new Error('Fetch failed');
        }
      } catch (fetchError) {
        logger.media.error('[MediaMessage] Video fetch fallback failed:', fetchError);
        setIsLoading(false);
        setError(true);
      }
    };

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
              logger.media.debug(`✅ [MediaMessageInline] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
              setIsLoading(false);
            }}
            onError={() => {
              logger.media.error('❌ [MediaMessageInline] Image load failed:', uri);
              setIsLoading(false);
              setError(true);
            }}
            loading="eager"
            decoding="async"
            onLoadStart={() => {
              loadStart.current = performance.now();
            }}
            onClick={onClick}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
        {/* 右上角关闭按钮 */}
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
    const inlineVideoRef = useRef<HTMLVideoElement>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    // 尝试加载视频，失败则尝试 fetch + blob
    const handleVideoError = async () => {
      if (blobUrl) return;

      try {
        const response = await fetch(uri);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        } else {
          throw new Error('Fetch failed');
        }
      } catch {
        setIsLoading(false);
        setError(true);
      }
    };

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

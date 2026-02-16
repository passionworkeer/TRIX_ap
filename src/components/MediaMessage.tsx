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

import React, { useState } from 'react';
import { Image as ImageIcon, Video, X } from 'lucide-react';

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
  console.log('🖼️ [MediaMessage] Rendering:', {
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
            console.log(`✅ [MediaMessage] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
            setIsLoading(false);
          }}
          onError={() => {
            console.error('❌ [MediaMessage] Image load failed:', uri);
            setIsLoading(false);
            setError(true);
          }}
          loading="lazy"
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
          src={uri}
          controls
          className={`w-full h-auto rounded-lg shadow-sm transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoadedData={() => setIsLoading(false)}
          onError={() => {
            console.error('❌ [MediaMessage] Video load failed:', uri);
            setIsLoading(false);
            setError(true);
          }}
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
        {/* 黑色外框 */}
        <div className="absolute inset-0 rounded-lg border-2 border-black overflow-hidden shadow-sm">
          <img
            src={uri}
            alt="Image"
            className={`w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={() => {
              const loadTime = performance.now() - loadStart.current;
              console.log(`✅ [MediaMessageInline] Image loaded in ${loadTime.toFixed(0)}ms:`, uri.substring(0, 50) + '...');
              setIsLoading(false);
            }}
            onError={() => {
              console.error('❌ [MediaMessageInline] Image load failed:', uri);
              setIsLoading(false);
              setError(true);
            }}
            loading="lazy"
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
            className="absolute -top-1.5 -right-1.5 w-11 h-11 p-2.5 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors z-10"
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
        <div className="absolute inset-0 rounded-lg border-2 border-black overflow-hidden shadow-sm">
          <video
            src={uri}
            className={`w-full h-full object-cover cursor-pointer ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError(true);
            }}
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
            className="absolute -top-1.5 -right-1.5 w-11 h-11 p-2.5 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors z-10"
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

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
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  uri,
  type,
  alt = 'Media',
  className = '',
  maxSize = 'lg'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Debug log
  console.log('🖼️ [MediaMessage] Rendering:', {
    type,
    uri,
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

        {/* Image */}
        <img
          src={uri}
          alt={alt}
          className={`w-full h-auto rounded-lg shadow-sm transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            console.error('❌ [MediaMessage] Image load failed:', uri);
            setIsLoading(false);
            setError(true);
          }}
          loading="lazy"
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
}

export const MediaMessageInline: React.FC<MediaMessageInlineProps> = ({
  uri,
  type,
  onClick
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 w-full max-w-[200px]">
        <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-[10px]">
          <X size={12} />
          <span>加载失败</span>
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="relative w-full max-w-[200px]">
        {isLoading && (
          <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        )}
        <img
          src={uri}
          alt="Image"
          className={`w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError(true);
          }}
          loading="lazy"
          onClick={onClick}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="relative w-full max-w-[200px]">
        {isLoading && (
          <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        )}
        <video
          src={uri}
          className={`w-full h-auto rounded-lg cursor-pointer ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoadedData={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError(true);
          }}
          preload="metadata"
          controls
          onClick={onClick}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    );
  }

  return null;
};

export default MediaMessage;

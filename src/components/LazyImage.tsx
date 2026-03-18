/**
 * LazyImage Component
 * ===================
 * 高性能图片懒加载组件
 * Features:
 * - IntersectionObserver 懒加载
 * - placeholder 加载状态
 * - 错误处理 fallback
 * - 支持多种图片格式 (webp, avif, jpg, png, gif)
 * - 渐变过渡动画
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { logger } from '../utils/logger';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  fallbackSrc?: string;
  width?: number | string;
  height?: number | string;
  sizes?: string;
  priority?: boolean; // true = 立即加载，false = 懒加载
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onLoad?: () => void;
  onError?: (error: Error) => void;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * 默认的错误 fallback 图片
 * 可以被 fallbackSrc 覆盖
 */
const DEFAULT_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext fill="%2394a3b8" x="50" y="50" text-anchor="middle" dy=".3em" font-family="system-ui" font-size="14"%3EImage%3C/text%3E%3C/svg%3E';

type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  fallbackSrc,
  width,
  height,
  sizes,
  priority = false,
  objectFit = 'cover',
  onLoad,
  onError,
  rootMargin = '50px',
  threshold = 0.1,
}) => {
  const [status, setStatus] = useState<ImageStatus>('idle');
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasBeenInView, setHasBeenInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 清理 observer
  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // 预加载图片
  const preloadImage = useCallback((imageSrc: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = imageSrc;

      if (width && typeof width === 'number') {
        img.width = width;
      }
      if (height && typeof height === 'number') {
        img.height = height;
      }
      if (sizes) {
        img.sizes = sizes;
      }

      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${imageSrc}`));
    });
  }, [width, height, sizes]);

  // 加载图片
  const loadImage = useCallback(async () => {
    if (!src) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      await preloadImage(src);
      setCurrentSrc(src);
      setStatus('loaded');
      onLoad?.();
    } catch (error) {
      logger.error('LazyImage', 'Load error:', error);
      setStatus('error');
      setCurrentSrc(fallbackSrc || DEFAULT_FALLBACK);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [src, fallbackSrc, preloadImage, onLoad, onError]);

  // 设置 IntersectionObserver
  useEffect(() => {
    // 检查是否在浏览器环境中
    if (typeof window === 'undefined') {
      return;
    }

    if (priority) {
      // 高优先级图片立即加载
      setHasBeenInView(true);
      loadImage();
      return;
    }

    // 检查是否支持 IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      // 不支持则直接加载
      setHasBeenInView(true);
      loadImage();
      return;
    }

    // 检查元素是否已经在视口中
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const inView = rect.top < window.innerHeight + parseInt(rootMargin, 10) &&
                     rect.bottom > -parseInt(rootMargin, 10);
      if (inView) {
        setHasBeenInView(true);
        loadImage();
        return;
      }
    }

    // 创建 observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenInView) {
            setHasBeenInView(true);
            cleanup();
            loadImage();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    if (containerRef.current) {
      observerRef.current.observe(containerRef.current);
    }

    return cleanup;
  }, [priority, rootMargin, threshold, hasBeenInView, loadImage, cleanup]);

  // 加载状态 - 显示 placeholder
  if (status === 'idle' || status === 'loading') {
    return (
      <div
        ref={containerRef}
        className={`relative bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center ${placeholderClassName} ${className}`}
        style={{
          width: width || '100%',
          height: height || '100%',
          minHeight: height ? undefined : '100px',
        }}
      >
        <Loader2 className="w-6 h-6 text-slate-300 dark:text-slate-600 animate-spin" />
      </div>
    );
  }

  // 错误状态 - 显示 fallback
  if (status === 'error') {
    return (
      <div
        className={`relative bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${className}`}
        style={{
          width: width || '100%',
          height: height || '100%',
          minHeight: height ? undefined : '100px',
        }}
      >
        <img
          src={fallbackSrc || DEFAULT_FALLBACK}
          alt={alt}
          className="w-full h-full"
          style={{ objectFit }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <ImageOff className="w-8 h-8 text-white/80" />
        </div>
      </div>
    );
  }

  // 加载完成
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={`w-full h-full transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ objectFit }}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
};

// 添加 displayName 以便调试
LazyImage.displayName = 'LazyImage';

export default memo(LazyImage);

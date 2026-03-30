import { useEffect } from 'react';

type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

/**
 * useResourcePreloader - key resource preloader hook
 *
 * Preloads critical resources during browser idle time
 */
export function useResourcePreloader() {
  useEffect(() => {
    if (!shouldPreloadNonCriticalResources()) {
      return;
    }

    const windowWithIdleCallbacks = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let timeoutId: number | null = null;
    let idleCallbackId: number | null = null;

    const runPreload = () => {
      preloadCriticalResources();
    };

    // 使用 requestIdleCallback 在浏览器空闲时预加载
    if (typeof windowWithIdleCallbacks.requestIdleCallback === 'function') {
      idleCallbackId = windowWithIdleCallbacks.requestIdleCallback(runPreload, { timeout: 3000 });
    } else {
      // 降级处理：延迟 2 秒后预加载
      timeoutId = window.setTimeout(runPreload, 2000);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (idleCallbackId !== null && typeof windowWithIdleCallbacks.cancelIdleCallback === 'function') {
        windowWithIdleCallbacks.cancelIdleCallback(idleCallbackId);
      }
    };
  }, []);

  return null;
}

function preloadCriticalResources() {
  // 预加载关键图片
  const criticalImages = [
    '/icon-192.png',
    '/icon-512.png',
  ];

  criticalImages.forEach((src) => {
    if (document.head.querySelector(`link[rel="preload"][href="${src}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
}

function shouldPreloadNonCriticalResources() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithConnection = navigator as NavigatorWithConnection;
  const connection =
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection;

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g';
}

/**
 * 预加载指定资源
 */
export function preloadResource(href: string, as: 'image' | 'script' | 'style' | 'fetch' = 'fetch') {
  if (typeof window === 'undefined') return;

  if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = href;
  document.head.appendChild(link);
}

/**
 * 懒加载图片（Intersection Observer）
 */
export function lazyLoadImages(selector: string = 'img[data-src]') {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    // 降级：直接加载所有图片
    document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px',
  });

  document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
    observer.observe(img);
  });
}

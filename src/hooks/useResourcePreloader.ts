import { useEffect } from 'react';

/**
 * ResourcePreloader - 关键资源预加载组件
 *
 * 在页面空闲时预加载关键资源，提升首屏体验
 */
export function ResourcePreloader() {
  useEffect(() => {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        preloadCriticalResources();
      }, { timeout: 3000 });
    } else {
      // 降级处理：延迟 2 秒后预加载
      setTimeout(preloadCriticalResources, 2000);
    }
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
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
}

/**
 * 预加载指定资源
 */
export function preloadResource(href: string, as: 'image' | 'script' | 'style' | 'fetch' = 'fetch') {
  if (typeof window === 'undefined') return;

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

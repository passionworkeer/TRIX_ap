/**
 * Web Vitals Hook - 首屏性能监控
 * ==============================
 * 使用 Web Vitals API 监控关键性能指标
 *
 * 监控指标:
 * - LCP (Largest Contentful Paint) - 最大内容绘制
 * - FID (First Input Delay) - 首次输入延迟
 * - CLS (Cumulative Layout Shift) - 累积布局偏移
 * - FCP (First Contentful Paint) - 首次内容绘制
 * - TTFB (Time to First Byte) - 首字节时间
 */

import { useEffect, useCallback, useRef } from 'react';
import { perfMonitor } from '../utils/performance';

interface WebVitalsConfig {
  /** 是否报告到控制台 */
  debug?: boolean;
  /** 是否发送到服务器 (可选) */
  reportToServer?: boolean;
  /** 服务器端点 */
  endpoint?: string;
}

interface WebVitalsMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
}

/**
 * 格式化性能指标值
 */
const formatMetric = (name: string, value: number): string => {
  if (name === 'CLS') {
    return `${value.toFixed(3)}`;
  }
  return `${value.toFixed(2)}ms`;
};

/**
 * 发送数据到服务器
 */
const sendToServer = async (endpoint: string, data: Record<string, unknown>) => {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        url: window.location.href,
        timestamp: Date.now(),
      }),
      // 不阻塞页面卸载
      keepalive: true,
    });
  } catch (error) {
    // 静默失败，不影响用户体验
    console.warn('[WebVitals] Failed to send to server:', error);
  }
};

/**
 * 计算 Web Vitals 分数
 */
const getScore = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const thresholds: Record<string, [number, number]> = {
    // LCP: < 2.5s good, < 4s needs-improvement, >= 4s poor
    LCP: [2500, 4000],
    // FID: < 100ms good, < 300ms needs-improvement, >= 300ms poor
    FID: [100, 300],
    // CLS: < 0.1 good, < 0.25 needs-improvement, >= 0.25 poor
    CLS: [0.1, 0.25],
    // FCP: < 1.8s good, < 3s needs-improvement, >= 3s poor
    FCP: [1800, 3000],
    // TTFB: < 800ms good, < 1800ms needs-improvement, >= 1800ms poor
    TTFB: [800, 1800],
  };

  const [good, needsImprovement] = thresholds[name] || [0, 0];
  if (value <= good) return 'good';
  if (value <= needsImprovement) return 'needs-improvement';
  return 'poor';
};

/**
 * 格式化分数为颜色
 */
const getScoreColor = (score: 'good' | 'needs-improvement' | 'poor'): string => {
  switch (score) {
    case 'good': return '#22c55e';
    case 'needs-improvement': return '#eab308';
    case 'poor': return '#ef4444';
  }
};

/**
 * 记录性能指标
 */
const recordMetric = (
  name: string,
  value: number,
  metricsRef: React.MutableRefObject<WebVitalsMetrics>,
  debug: boolean
) => {
  // 更新 ref
  switch (name) {
    case 'LCP':
      metricsRef.current.lcp = value;
      break;
    case 'FID':
      metricsRef.current.fid = value;
      break;
    case 'CLS':
      metricsRef.current.cls = value;
      break;
    case 'FCP':
      metricsRef.current.fcp = value;
      break;
    case 'TTFB':
      metricsRef.current.ttfb = value;
      break;
  }

  // 记录到 perfMonitor
  perfMonitor.startMeasure(`webvitals:${name}`, undefined, 'custom');
  perfMonitor.endMeasure(`webvitals:${name}`);

  // 调试输出
  if (debug) {
    const score = getScore(name, value);
    console.log(
      `%c[WebVitals] ${name}: ${formatMetric(name, value)} (${score})`,
      `color: ${getScoreColor(score)}; font-weight: bold;`
    );
  }
};

/**
 * Web Vitals Hook
 * 在组件挂载时自动开始监控
 */
export function useWebVitals(config: WebVitalsConfig = {}) {
  const { debug = false, reportToServer = false, endpoint } = config;
  const metricsRef = useRef<WebVitalsMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
  });

  // 初始化 Web Vitals 监控
  useEffect(() => {
    // 检查是否在浏览器环境中
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // 记录页面开始时间
    const pageStartTime = performance.timing?.navigationStart ||
      performance.getEntriesByType('navigation')[0]?.fetchStart ||
      0;

    // 1. 监控 FCP (First Contentful Paint)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          const fcp = fcpEntry.startTime;
          recordMetric('FCP', fcp, metricsRef, debug);
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // FCP 监控失败，静默处理
    }

    // 2. 监控 LCP (Largest Contentful Paint)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
        if (lastEntry) {
          const lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
          recordMetric('LCP', lcp, metricsRef, debug);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP 监控失败，静默处理
    }

    // 3. 监控 CLS (Cumulative Layout Shift)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        recordMetric('CLS', clsValue, metricsRef, debug);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS 监控失败，静默处理
    }

    // 4. 监控 FID (First Input Delay) - 需要用户交互
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const firstEntry = list.getEntries()[0] as PerformanceEntry & { processingStart?: number; startTime?: number };
        if (firstEntry) {
          const fid = (firstEntry.processingStart || 0) - (firstEntry.startTime || 0);
          recordMetric('FID', fid, metricsRef, debug);
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // FID 监控失败，静默处理
    }

    // 5. 监控 TTFB (Time to First Byte)
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart;
        recordMetric('TTFB', ttfb, metricsRef, debug);
      }
    } catch (e) {
      // TTFB 监控失败，静默处理
    }

    // 清理函数
    return () => {
      // 所有 observer 会在页面卸载时自动断开
    };
  }, [debug]);

  // 获取当前指标
  const getMetrics = useCallback((): WebVitalsMetrics => {
    return { ...metricsRef.current };
  }, []);

  // 打印性能报告
  const report = useCallback(() => {
    const metrics = metricsRef.current;

    console.group('[WebVitals] Performance Report');
    console.log('URL:', window.location.href);
    console.log('Date:', new Date().toISOString());
    console.table(metrics);
    console.groupEnd();

    // 发送报告到服务器
    if (reportToServer && endpoint) {
      sendToServer(endpoint, {
        ...metrics,
        userAgent: navigator.userAgent,
      });
    }

    return metrics;
  }, [endpoint, reportToServer]);

  return {
    getMetrics,
    report,
    metrics: metricsRef.current,
  };
}

/**
 * 首屏加载时间 Hook
 * 记录关键时间点
 */
export function usePageLoadTiming() {
  const timingRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // 记录各阶段时间
    const paintEntries = performance.getEntriesByType('paint');

    paintEntries.forEach((entry) => {
      timingRef.current[entry.name] = entry.startTime;
    });

    // 记录关键时间点
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigationEntry) {
      timingRef.current.navigationStart = navigationEntry.navigationStart;
      timingRef.current.unloadEventStart = navigationEntry.unloadEventStart;
      timingRef.current.redirectStart = navigationEntry.redirectStart;
      timingRef.current.redirectEnd = navigationEntry.redirectEnd;
      timingRef.current.fetchStart = navigationEntry.fetchStart;
      timingRef.current.domainLookupStart = navigationEntry.domainLookupStart;
      timingRef.current.domainLookupEnd = navigationEntry.domainLookupEnd;
      timingRef.current.connectStart = navigationEntry.connectStart;
      timingRef.current.connectEnd = navigationEntry.connectEnd;
      timingRef.current.secureConnectionStart = navigationEntry.secureConnectionStart;
      timingRef.current.requestStart = navigationEntry.requestStart;
      timingRef.current.responseStart = navigationEntry.responseStart;
      timingRef.current.responseEnd = navigationEntry.responseEnd;
      timingRef.current.domLoading = navigationEntry.domLoading;
      timingRef.current.domInteractive = navigationEntry.domInteractive;
      timingRef.current.domContentLoadedEventStart = navigationEntry.domContentLoadedEventStart;
      timingRef.current.domContentLoadedEventEnd = navigationEntry.domContentLoadedEventEnd;
      timingRef.current.domComplete = navigationEntry.domComplete;
      timingRef.current.loadEventStart = navigationEntry.loadEventStart;
      timingRef.current.loadEventEnd = navigationEntry.loadEventEnd;
    }

    // 记录 DOMContentLoaded 时间
    const domContentLoaded = performance.timing?.domContentLoadedEventEnd -
      performance.timing?.navigationStart;
    if (domContentLoaded) {
      timingRef.current.domContentLoaded = domContentLoaded;
    }

    // 记录 onload 时间
    const loadEventEnd = performance.timing?.loadEventEnd -
      performance.timing?.navigationStart;
    if (loadEventEnd) {
      timingRef.current.loadEvent = loadEventEnd;
    }

    // 记录首次绘制
    const firstPaint = (performance as any).getEntriesByType('paint')
      ?.find((e: PerformanceEntry) => e.name === 'first-paint')?.startTime;
    if (firstPaint) {
      timingRef.current.firstPaint = firstPaint;
    }

    // 调试输出
    if (import.meta.env.DEV) {
      console.group('[PageLoadTiming]');
      console.table(timingRef.current);
      console.groupEnd();
    }

    // 记录到 perfMonitor
    Object.entries(timingRef.current).forEach(([key, value]) => {
      if (typeof value === 'number' && value > 0) {
        perfMonitor.startMeasure(`timing:${key}`, undefined, 'custom');
        perfMonitor.endMeasure(`timing:${key}`);
      }
    });
  }, []);

  return timingRef.current;
}

export default useWebVitals;

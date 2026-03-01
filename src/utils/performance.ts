/**
 * Performance utilities for optimization
 */

import React from 'react';

// ============================================
// Performance Monitoring Types
// ============================================

/**
 * Performance metric entry
 */
export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  category: 'render' | 'api' | 'interaction' | 'custom';
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

// ============================================
// Performance Monitor Class
// ============================================

/**
 * Maximum number of metrics to store per name
 */
const MAX_METRICS_PER_NAME = 100;

/**
 * Performance monitoring utility class
 * Only active in development mode to avoid production overhead
 */
class PerformanceMonitorImpl {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeMeasures: Map<string, PerformanceMetric> = new Map();
  private readonly isDev: boolean;

  constructor() {
    this.isDev = import.meta.env.DEV;
  }

  /**
   * Store metric with size limiting
   */
  private storeMetric(name: string, metric: PerformanceMetric): void {
    const existingMetrics = this.metrics.get(name) || [];

    // Add new metric
    existingMetrics.push(metric);

    // Trim to max size (FIFO - keep most recent)
    if (existingMetrics.length > MAX_METRICS_PER_NAME) {
      existingMetrics.splice(0, existingMetrics.length - MAX_METRICS_PER_NAME);
    }

    this.metrics.set(name, existingMetrics);
  }

  /**
   * Start measuring a performance metric
   */
  startMeasure(name: string, metadata?: Record<string, unknown>, category: PerformanceMetric['category'] = 'custom'): void {
    if (!this.isDev) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
      category,
    };

    this.activeMeasures.set(name, metric);
  }

  /**
   * End measuring and record the metric
   * @returns Duration in milliseconds or null if not started
   */
  endMeasure(name: string): number | null {
    if (!this.isDev) return null;

    const metric = this.activeMeasures.get(name);
    if (!metric) {
      console.warn(`[Performance] No active measurement found for ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration,
    };

    // Store with size limiting
    this.storeMetric(name, completedMetric);

    // Clean up active measure
    this.activeMeasures.delete(name);

    // Log to console
    console.log(
      `[Performance] ${name}: ${duration.toFixed(2)}ms`,
      metric.metadata || ''
    );

    return duration;
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    this.startMeasure(name, metadata);
    try {
      return fn();
    } finally {
      this.endMeasure(name);
    }
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.startMeasure(name, metadata);
    try {
      return await fn();
    } finally {
      this.endMeasure(name);
    }
  }

  /**
   * Create a render timing profiler callback for React.Profiler
   */
  createRenderProfilerCallback(componentName: string) {
    const metricName = `render:${componentName}`;
    return (id: string, phase: 'mount' | 'update', actualDuration: number, baseDuration: number, startTime: number, commitTime: number) => {
      if (!this.isDev) return;

      const metric: PerformanceMetric = {
        name: metricName,
        startTime,
        endTime: startTime + actualDuration,
        duration: actualDuration,
        metadata: {
          id,
          phase,
          baseDuration,
          commitTime,
        },
        category: 'render',
      };

      // Store with size limiting
      this.storeMetric(metricName, metric);

      // Only log slow renders (>16ms = 60fps frame time)
      if (actualDuration > 16) {
        console.warn(
          `[Performance] Slow render: ${componentName} took ${actualDuration.toFixed(2)}ms`,
          { id, phase, baseDuration }
        );
      }
    };
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(name: string): PerformanceStats | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration || 0);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: metrics.length,
      totalDuration,
      avgDuration: totalDuration / metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  }

  /**
   * Get all statistics
   */
  getAllStats(): Map<string, PerformanceStats> {
    const stats = new Map<string, PerformanceStats>();

    for (const [name] of this.metrics) {
      const stat = this.getStats(name);
      if (stat) {
        stats.set(name, stat);
      }
    }

    return stats;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.activeMeasures.clear();
  }

  /**
   * Clear metrics for a specific name
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Get all metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Measure component render - returns start/end functions
   */
  measureComponentRender(componentName: string): { start: () => void; end: () => number | null } {
    return {
      start: () => this.startMeasure(`render:${componentName}`, undefined, 'render'),
      end: () => this.endMeasure(`render:${componentName}`) || 0,
    };
  }

  /**
   * Measure API call - returns start/end functions
   */
  measureAPICall(apiName: string): { start: () => void; end: () => number | null } {
    return {
      start: () => this.startMeasure(`api:${apiName}`, undefined, 'api'),
      end: () => this.endMeasure(`api:${apiName}`) || 0,
    };
  }

  /**
   * Measure user interaction - returns start/end functions
   */
  measureInteraction(interactionName: string): { start: () => void; end: () => number | null } {
    return {
      start: () => this.startMeasure(`interaction:${interactionName}`, undefined, 'interaction'),
      end: () => this.endMeasure(`interaction:${interactionName}`) || 0,
    };
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitorImpl();

// ============================================
// React Hooks for Performance Tracking
// ============================================

/**
 * Hook to track component render performance
 * Uses React.Profiler to measure actual render time
 * @deprecated This hook currently does not work as expected - use withReactProfiler instead
 */
export function usePerformanceTracking(componentName: string): void {
  // This hook cannot accurately measure render time from inside the component
  // because by the time the effect runs, the render has already completed.
  // Use React.Profiler on parent component instead.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Performance] usePerformanceTracking('${componentName}') is deprecated. ` +
      'Use React.Profiler or perfMonitor.createRenderProfilerCallback() instead.'
    );
  }
}

/**
 * Hook to track component with React.Profiler
 * Returns a callback for React.Profiler onRender prop
 */
export function useRenderProfiler(
  componentName: string,
  _props?: Record<string, unknown>
): (id: string, phase: 'mount' | 'update', actualDuration: number, baseDuration: number) => void {
  const handleRender = React.useCallback(
    (
      _id: string,
      phase: 'mount' | 'update',
      actualDuration: number,
      baseDuration: number
    ) => {
      if (!import.meta.env.DEV) return;

      // Log slow renders
      if (actualDuration > 16) {
        console.warn(
          `[Performance] Slow render: ${componentName}`,
          { phase, actualDuration, baseDuration }
        );
      }
    },
    [componentName]
  );

  return handleRender;
}

// ============================================
// Existing Utilities (SimpleCache, debounce, etc.)
// ============================================

/**
 * Simple in-memory cache with TTL and size limit
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTTL: number = 60000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;

    // Periodic cleanup of expired entries (every 5 minutes)
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries and enforce size limit
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }

    // Enforce size limit (remove oldest entries if needed)
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries());
      const toRemove = this.cache.size - this.maxSize;
      for (let i = 0; i < toRemove; i++) {
        const key = entries[i]?.[0];
        if (key) this.cache.delete(key);
      }
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Cleanup before setting if we're at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.cleanup();
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

/**
 * Request cache for API calls
 */
export const requestCache = new SimpleCache<unknown>(30000);

/**
 * Create a cached version of an async function
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = requestCache.get(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    requestCache.set(key, result, ttl);
    return result;
  }) as T;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Request deduplication - prevents duplicate concurrent requests
 *
 * Note: Pending requests are automatically cleaned up when they complete.
 * However, if a request never settles (e.g., network hang), it will
 * remain in the map. For long-running applications, consider periodic cleanup.
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Default timeout for pending requests (30 seconds)
 */
const DEDUPE_REQUEST_TIMEOUT_MS = 30000;

/**
 * Clean up stale pending requests
 */
function cleanupPendingRequests(): void {
  // Cleanup stale pending requests
  // Note: This is a simplified cleanup - in production you might want
  // to track creation time for each entry
  if (pendingRequests.size > 100) {
    // If we have too many pending requests, clear all
    // This is a safety mechanism
    pendingRequests.clear();
  }
}

// Periodic cleanup every 5 minutes
setInterval(cleanupPendingRequests, 5 * 60 * 1000);

export function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  timeoutMs: number = DEDUPE_REQUEST_TIMEOUT_MS
): Promise<T> {
  // Check if request is already pending
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Start new request with timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      pendingRequests.delete(key);
      reject(new Error(`Request timeout: ${key}`));
    }, timeoutMs);
  });

  const promise = Promise.race([
    requestFn().finally(() => {
      pendingRequests.delete(key);
    }),
    timeoutPromise,
  ]);

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Lazy load image with intersection observer
 *
 * @returns Cleanup function that should be called when element is removed
 */
export function lazyLoadImage(
  element: HTMLImageElement,
  src: string,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        element.src = src;
        observer.unobserve(element);
        observer.disconnect();
      }
    });
  }, options);

  observer.observe(element);

  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Batch processor for grouping operations
 *
 * @example
 * const processor = new BatchProcessor<string, number>(
 *   async (items) => items.map(s => s.length),
 *   100,
 *   10
 * );
 * const result = await processor.add("hello");
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Use WeakMap to store callbacks without polluting the item type
  private resolvers = new Map<T, (value: R) => void>();
  private rejectors = new Map<T, (error: Error) => void>();

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private delay: number = 100,
    private maxBatchSize: number = 50
  ) {}

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);
      this.resolvers.set(item, resolve);
      this.rejectors.set(item, reject);

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.delay);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const items = this.queue.splice(0, this.queue.length);
    if (items.length === 0) return;

    try {
      const results = await this.processor(items);
      items.forEach((item, index) => {
        const resolve = this.resolvers.get(item);
        if (resolve) {
          resolve(results[index]);
        }
        this.resolvers.delete(item);
        this.rejectors.delete(item);
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      items.forEach((item) => {
        const reject = this.rejectors.get(item);
        if (reject) {
          reject(err);
        }
        this.resolvers.delete(item);
        this.rejectors.delete(item);
      });
    }
  }
}

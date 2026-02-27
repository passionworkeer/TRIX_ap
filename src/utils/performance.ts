/**
 * Performance utilities for optimization
 */

/**
 * Simple in-memory cache with TTL
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) { // Default 1 minute
    this.defaultTTL = defaultTTL;
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
}

/**
 * Request cache for API calls
 */
export const requestCache = new SimpleCache<any>(30000); // 30 seconds

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
 */
const pendingRequests = new Map<string, Promise<any>>();

export function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check if request is already pending
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }

  // Start new request
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Lazy load image with intersection observer
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
      }
    });
  }, options);

  observer.observe(element);

  return () => observer.unobserve(element);
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
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private delay: number = 100,
    private maxBatchSize: number = 50
  ) {}

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      // @ts-ignore - storing callbacks with items
      (item as any).__resolve = resolve;
      // @ts-ignore
      (item as any).__reject = reject;

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
        // @ts-ignore
        item.__resolve(results[index]);
      });
    } catch (error) {
      items.forEach((item) => {
        // @ts-ignore
        item.__reject(error);
      });
    }
  }
}

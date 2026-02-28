/**
 * Unit tests for performance utilities
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  SimpleCache,
  debounce,
  throttle,
  dedupeRequest,
  withCache,
  requestCache,
  perfMonitor,
} from './performance';

describe('performance utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear global cache before each test
    requestCache.clear();
    // Clear performance monitor metrics
    perfMonitor.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // Performance Monitor Tests
  // ============================================

  describe('perfMonitor', () => {
    it('should start and end measure', () => {
      perfMonitor.startMeasure('test-metric');
      const duration = perfMonitor.endMeasure('test-metric');

      expect(duration).not.toBeNull();
      expect(duration).toBeGreaterThan(0);
    });

    it('should return null for non-existent measure', () => {
      const duration = perfMonitor.endMeasure('nonexistent');
      expect(duration).toBeNull();
    });

    it('should measure synchronous function', () => {
      const result = perfMonitor.measure('sync-test', () => 42);
      expect(result).toBe(42);

      const stats = perfMonitor.getStats('sync-test');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
    });

    it('should measure async function', async () => {
      const result = await perfMonitor.measureAsync('async-test', async () => {
        return 'async-result';
      });

      expect(result).toBe('async-result');

      const stats = perfMonitor.getStats('async-test');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
    });

    it('should get stats for multiple measurements', () => {
      perfMonitor.measure('multi-test', () => 1);
      perfMonitor.measure('multi-test', () => 2);
      perfMonitor.measure('multi-test', () => 3);

      const stats = perfMonitor.getStats('multi-test');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.avgDuration).toBeGreaterThan(0);
    });

    it('should clear metrics', () => {
      perfMonitor.measure('clear-test', () => 1);
      perfMonitor.clear();

      const stats = perfMonitor.getStats('clear-test');
      expect(stats).toBeNull();
    });

    it('should use component render helper', () => {
      const measure = perfMonitor.measureComponentRender('TestComponent');
      measure.start();
      measure.end();

      const stats = perfMonitor.getStats('render:TestComponent');
      expect(stats).not.toBeNull();
    });

    it('should use API call helper', () => {
      const measure = perfMonitor.measureAPICall('getTodos');
      measure.start();
      measure.end();

      const stats = perfMonitor.getStats('api:getTodos');
      expect(stats).not.toBeNull();
    });

    it('should use interaction helper', () => {
      const measure = perfMonitor.measureInteraction('buttonClick');
      measure.start();
      measure.end();

      const stats = perfMonitor.getStats('interaction:buttonClick');
      expect(stats).not.toBeNull();
    });
  });

  // ============================================
  // SimpleCache Tests
  // ============================================

  describe('SimpleCache', () => {
    it('should store and retrieve values', () => {
      const cache = new SimpleCache<string>();
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new SimpleCache<string>();

      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should respect TTL and expire entries', () => {
      const cache = new SimpleCache<string>(1000); // 1 second

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      expect(cache.get('key1')).toBeNull();
    });

    it('should allow custom TTL per entry', () => {
      const cache = new SimpleCache<string>(1000); // Default 1s

      cache.set('key1', 'value1', 500); // Custom 0.5s

      vi.advanceTimersByTime(600);

      expect(cache.get('key1')).toBeNull();
    });

    it('should delete entries', () => {
      const cache = new SimpleCache<string>();
      cache.set('key1', 'value1');

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all entries', () => {
      const cache = new SimpleCache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size()).toBe(0);
    });

    it('should check if key exists', () => {
      const cache = new SimpleCache<string>();
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should report size correctly', () => {
      const cache = new SimpleCache<string>();

      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.size()).toBe(2);
    });
  });

  // ============================================
  // debounce Tests
  // ============================================

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);

      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  // ============================================
  // throttle Tests
  // ============================================

  describe('throttle', () => {
    it('should execute immediately on first call', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should ignore subsequent calls within limit', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow calls after limit period', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      vi.advanceTimersByTime(100);
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // dedupeRequest Tests
  // ============================================

  describe('dedupeRequest', () => {
    it('should return same promise for duplicate keys', async () => {
      const requestFn = vi.fn().mockResolvedValue('result');

      const promise1 = dedupeRequest('key1', requestFn);
      const promise2 = dedupeRequest('key1', requestFn);

      expect(promise1).toBe(promise2);
      expect(requestFn).toHaveBeenCalledTimes(1);

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toBe('result');
      expect(result2).toBe('result');
    });

    it('should allow new requests after completion', async () => {
      const requestFn = vi.fn().mockResolvedValue('result');

      await dedupeRequest('key1', requestFn);
      await dedupeRequest('key1', requestFn);

      expect(requestFn).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // withCache Tests
  // ============================================

  describe('withCache', () => {
    it('should cache function results', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const testCache = new SimpleCache<string>(1000);
      const cachedFn = withCache(fn, (arg: string) => arg, 1000);

      const result1 = await cachedFn('arg1');
      const result2 = await cachedFn('arg1');

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should use different cache for different arguments', async () => {
      const fn = vi.fn().mockImplementation((arg: string) => Promise.resolve(arg));
      const testCache = new SimpleCache<string>(1000);
      const cachedFn = withCache(fn, (arg: string) => arg, 1000);

      const result1 = await cachedFn('arg1');
      const result2 = await cachedFn('arg2');

      expect(result1).toBe('arg1');
      expect(result2).toBe('arg2');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

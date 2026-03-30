/**
 * Unit tests for useResourcePreloader Hook (and related utilities)
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useResourcePreloader, preloadResource, lazyLoadImages } from './useResourcePreloader';

// Mock requestIdleCallback
const mockRequestIdleCallback = vi.fn(() => 1);

const mockCancelIdleCallback = vi.fn();

// Helper to create mock elements without recursion
function createMockElement(tag: string) {
  const el = {
    tagName: tag.toUpperCase(),
    rel: '',
    as: '',
    href: '',
    src: '',
    appendChild: vi.fn(),
    removeAttribute: vi.fn(),
    dataset: { src: '' },
  };
  return el as unknown as HTMLElement;
}

describe('useResourcePreloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock requestIdleCallback
    Object.defineProperty(window, 'requestIdleCallback', {
      value: mockRequestIdleCallback,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      value: mockCancelIdleCallback,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'connection', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hook behavior', () => {
    it('should call requestIdleCallback on mount when available', async () => {
      mockRequestIdleCallback.mockClear();

      const { result } = renderHook(() => useResourcePreloader());

      expect(result.current).toBeNull();
      expect(mockRequestIdleCallback).toHaveBeenCalled();
    });

    it('should cancel idle callback on unmount', () => {
      const { unmount } = renderHook(() => useResourcePreloader());

      unmount();

      expect(mockCancelIdleCallback).toHaveBeenCalled();
    });

    it('should use setTimeout fallback when requestIdleCallback is not available', async () => {
      // Store original and delete property so 'in' check fails
      const original = (window as any).requestIdleCallback;
      // @ts-ignore - deleting for test
      delete (window as any).requestIdleCallback;

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const { result } = renderHook(() => useResourcePreloader());

      // Check that setTimeout was called instead
      expect(result.current).toBeNull();
      expect(setTimeoutSpy).toHaveBeenCalled();

      // Restore
      (window as any).requestIdleCallback = original;
      setTimeoutSpy.mockRestore();
    });

    it('should skip scheduling on save-data connections', () => {
      Object.defineProperty(window.navigator, 'connection', {
        value: { saveData: true, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });

      renderHook(() => useResourcePreloader());

      expect(mockRequestIdleCallback).not.toHaveBeenCalled();
    });
  });

  describe('preloadResource', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        return createMockElement(tag);
      });
      vi.spyOn(document.head, 'appendChild').mockImplementation(() => null as unknown as Node);
    });

    it('should do nothing in server-side rendering', () => {
      // Save original window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(() => preloadResource('test.jpg')).not.toThrow();

      // Restore
      global.window = originalWindow;
    });

    it('should create preload link for image', () => {
      preloadResource('/test-image.png', 'image');

      expect(document.createElement).toHaveBeenCalledWith('link');
    });

    it('should create preload link for script', () => {
      preloadResource('/test-script.js', 'script');

      expect(document.createElement).toHaveBeenCalledWith('link');
    });

    it('should create preload link for style', () => {
      preloadResource('/test-style.css', 'style');

      expect(document.createElement).toHaveBeenCalledWith('link');
    });

    it('should create preload link for fetch', () => {
      preloadResource('/api/data', 'fetch');

      expect(document.createElement).toHaveBeenCalledWith('link');
    });

    it('should set correct attributes on link', () => {
      const mockLink = createMockElement('link');

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'link') {
          return mockLink;
        }
        return createMockElement(tag);
      });

      preloadResource('/test-resource.png', 'image');

      expect(mockLink.rel).toBe('preload');
      expect(mockLink.as).toBe('image');
      expect(mockLink.href).toBe('/test-resource.png');
    });

    it('should append link to head', () => {
      const mockLink = createMockElement('link');

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'link') {
          return mockLink;
        }
        return createMockElement(tag);
      });

      preloadResource('/test-resource.png', 'image');

      expect(document.head.appendChild).toHaveBeenCalledWith(mockLink);
    });

    it('should not append duplicate preload links', () => {
      vi.spyOn(document.head, 'querySelector').mockReturnValue({} as Element);

      preloadResource('/test-resource.png', 'image');

      expect(document.createElement).not.toHaveBeenCalled();
      expect(document.head.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('lazyLoadImages', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should do nothing in server-side rendering', () => {
      // Save original window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(() => lazyLoadImages()).not.toThrow();

      // Restore
      global.window = originalWindow;
    });

    it('should fallback to direct loading when IntersectionObserver is not available', () => {
      // Store original and remove property entirely so 'in' check fails
      const original = window.IntersectionObserver;
      // @ts-ignore - deleting for test purposes
      delete window.IntersectionObserver;

      const mockImg1 = createMockElement('img');
      mockImg1.dataset.src = '/image1.png';

      const mockImg2 = createMockElement('img');
      mockImg2.dataset.src = '/image2.png';

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg1,
        mockImg2,
      ] as unknown as NodeList<HTMLImageElement>);

      lazyLoadImages();

      expect(mockImg1.src).toBe('/image1.png');
      expect(mockImg2.src).toBe('/image2.png');

      // Restore
      window.IntersectionObserver = original;
    });

    it('should use IntersectionObserver when available', () => {
      const mockImg = createMockElement('img');
      mockImg.dataset.src = '/test-image.png';

      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg,
      ] as unknown as NodeList<HTMLImageElement>);

      vi.spyOn(window, 'IntersectionObserver').mockImplementation(
        (callback: IntersectionObserverCallback) => {
          return mockObserver as unknown as IntersectionObserver;
        }
      );

      lazyLoadImages();

      expect(mockObserver.observe).toHaveBeenCalledWith(mockImg);
    });

    it('should load image when intersecting', () => {
      const mockImg = createMockElement('img');
      mockImg.dataset.src = '/test-image.png';

      let observerCallback: IntersectionObserverCallback | null = null;

      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg,
      ] as unknown as NodeList<HTMLImageElement>);

      vi.spyOn(window, 'IntersectionObserver').mockImplementation(
        (callback: IntersectionObserverCallback) => {
          observerCallback = callback;
          return mockObserver as unknown as IntersectionObserver;
        }
      );

      lazyLoadImages('img[data-src]');

      // Simulate intersection
      if (observerCallback) {
        observerCallback(
          [
            {
              isIntersecting: true,
              target: mockImg,
            } as unknown as IntersectionObserverEntry,
          ],
          mockObserver as unknown as IntersectionObserver
        );
      }

      expect(mockImg.src).toBe('/test-image.png');
      expect(mockImg.removeAttribute).toHaveBeenCalledWith('data-src');
      expect(mockObserver.unobserve).toHaveBeenCalledWith(mockImg);
    });

    it('should use default selector when none provided', () => {
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as NodeList<HTMLImageElement>);

      vi.spyOn(window, 'IntersectionObserver').mockImplementation(
        () => mockObserver as unknown as IntersectionObserver
      );

      lazyLoadImages();

      expect(document.querySelectorAll).toHaveBeenCalledWith('img[data-src]');
    });

    it('should use custom selector when provided', () => {
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as NodeList<HTMLImageElement>);

      vi.spyOn(window, 'IntersectionObserver').mockImplementation(
        () => mockObserver as unknown as IntersectionObserver
      );

      lazyLoadImages('div[data-lazy]');

      expect(document.querySelectorAll).toHaveBeenCalledWith('div[data-lazy]');
    });
  });
});

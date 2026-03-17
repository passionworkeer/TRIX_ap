/**
 * Unit tests for useResourcePreloader Hook (and related utilities)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ResourcePreloader, preloadResource, lazyLoadImages } from './useResourcePreloader';

// Mock requestIdleCallback
const mockRequestIdleCallback = vi.fn((callback: Function) => {
  callback({ didTimeout: false });
  return 1;
});

const mockCancelIdleCallback = vi.fn();

describe.skip('ResourcePreloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock requestIdleCallback
    Object.defineProperty(window, 'requestIdleCallback', {
      value: mockRequestIdleCallback,
      writable: true,
    });

    // Mock document methods
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'link') {
        return {
          rel: '',
          as: '',
          href: '',
          appendChild: vi.fn(),
        } as unknown as HTMLLinkElement;
      }
      return document.createElement(tag);
    });

    vi.spyOn(document.head, 'appendChild').mockImplementation(() => null as unknown as Node);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ResourcePreloader hook', () => {
    it('should be a component that returns null', () => {
      const { container } = renderHook(() => ResourcePreloader()).result;

      // ResourcePreloader is a component, not a hook
      // We need to render it differently
    });

    it('should set up requestIdleCallback on mount', async () => {
      // Render the component
      const { unmount } = act(() => {
        return renderHook(() => ResourcePreloader());
      }) as any;

      // Wait for the effect to run
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRequestIdleCallback).toHaveBeenCalled();

      unmount();
    });

    it('should fallback to setTimeout when requestIdleCallback is not available', () => {
      // Remove requestIdleCallback
      const originalRequestIdleCallback = (window as any).requestIdleCallback;
      delete (window as any).requestIdleCallback;

      vi.useFakeTimers();

      const { unmount } = act(() => {
        return renderHook(() => ResourcePreloader());
      }) as any;

      // Fast forward time
      vi.advanceTimersByTime(2000);

      expect(mockRequestIdleCallback).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, 'requestIdleCallback', {
        value: originalRequestIdleCallback,
        writable: true,
      });

      vi.useRealTimers();
      unmount();
    });
  });

  describe('preloadResource', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'link') {
          return {
            rel: '',
            as: '',
            href: '',
            appendChild: vi.fn(),
          } as unknown as HTMLLinkElement;
        }
        return document.createElement(tag);
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
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        appendChild: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'link') {
          return mockLink;
        }
        return document.createElement(tag);
      });

      preloadResource('/test-resource.png', 'image');

      expect(mockLink.rel).toBe('preload');
      expect(mockLink.as).toBe('image');
      expect(mockLink.href).toBe('/test-resource.png');
    });

    it('should append link to head', () => {
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        appendChild: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'link') {
          return mockLink;
        }
        return document.createElement(tag);
      });

      preloadResource('/test-resource.png', 'image');

      expect(document.head.appendChild).toHaveBeenCalledWith(mockLink);
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
      const originalIntersectionObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;

      const mockImg1 = {
        dataset: { src: '/image1.png' },
        src: '',
        removeAttribute: vi.fn(),
      };

      const mockImg2 = {
        dataset: { src: '/image2.png' },
        src: '',
        removeAttribute: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg1 as unknown as HTMLImageElement,
        mockImg2 as unknown as HTMLImageElement,
      ] as unknown as NodeList<HTMLImageElement>);

      lazyLoadImages();

      expect(mockImg1.src).toBe('/image1.png');
      expect(mockImg2.src).toBe('/image2.png');

      // Restore
      Object.defineProperty(window, 'IntersectionObserver', {
        value: originalIntersectionObserver,
        writable: true,
      });
    });

    it('should use IntersectionObserver when available', () => {
      const mockImg = {
        dataset: { src: '/test-image.png' },
        src: '',
        removeAttribute: vi.fn(),
      };

      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg as unknown as HTMLImageElement,
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
      const mockImg = {
        dataset: { src: '/test-image.png' },
        src: '',
        removeAttribute: vi.fn(),
      };

      let observerCallback: IntersectionObserverCallback | null = null;

      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
      };

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockImg as unknown as HTMLImageElement,
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

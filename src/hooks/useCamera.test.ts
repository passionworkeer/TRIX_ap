/**
 * Unit tests for useCamera Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCamera } from './useCamera';

// Save original navigator
const originalNavigator = { ...navigator };

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn((blob) => `blob:${Date.now()}`);
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true,
  configurable: true,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
  writable: true,
  configurable: true,
});

// Helper to set up mock navigator with getUserMedia
function setupMockNavigator() {
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  };
  const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
    configurable: true,
  });

  return { mockGetUserMedia, mockStream };
}

// Helper to set up unsupported navigator
function setupUnsupportedNavigator() {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// Helper to set up a mock video element
function createMockVideoElement() {
  return {
    srcObject: null as any,
    play: vi.fn().mockResolvedValue(undefined),
    videoWidth: 1920,
    videoHeight: 1080,
  };
}

describe('useCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokeObjectURL.mockClear();
    // Restore navigator to original state
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalNavigator.mediaDevices,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Ensure navigator is restored after each test
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalNavigator.mediaDevices,
      writable: true,
      configurable: true,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      setupUnsupportedNavigator();

      const { result } = renderHook(() => useCamera());

      // Check initial values before effect runs
      expect(result.current.status).toBe('idle');
      expect(result.current.capturedPhoto).toBeNull();
      expect(result.current.isReady).toBe(false);
    });

    it('should detect camera support on mount', async () => {
      const { mockGetUserMedia } = setupMockNavigator();

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });
    });

    it('should handle unsupported browser', async () => {
      setupUnsupportedNavigator();

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false);
        expect(result.current.error).toBe('当前浏览器不支持相机功能');
      });
    });
  });

  describe('startCamera', () => {
    it('should start camera successfully', async () => {
      const { mockGetUserMedia } = setupMockNavigator();
      const mockVideoElement = createMockVideoElement();

      const { result } = renderHook(() => useCamera());

      // Wait for hook to initialize and effect to run
      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      // Set up the video element
      act(() => {
        const videoRef = result.current.videoRef;
        // Create a new mock object and assign to ref
        Object.defineProperty(videoRef, 'current', {
          value: mockVideoElement,
          writable: true,
          configurable: true,
        });
      });

      // Start camera
      await act(async () => {
        await result.current.startCamera();
      });

      // Wait for status to change to ready
      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(mockGetUserMedia).toHaveBeenCalled();
      expect(mockVideoElement.srcObject).not.toBeNull();
    });

    it('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(error),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('相机权限被拒绝');
    });

    it('should handle not found error', async () => {
      const error = new Error('Not found');
      error.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(error),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('未找到相机设备');
    });

    it('should handle not readable error', async () => {
      const error = new Error('Not readable');
      error.name = 'NotReadableError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(error),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('相机被其他应用占用');
    });

    it('should handle generic error', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(new Error('Unknown error')),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('相机错误');
    });
  });

  describe('stopCamera', () => {
    it('should stop camera and release stream', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
      };
      const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mockGetUserMedia,
        },
        writable: true,
        configurable: true,
      });

      const mockVideoElement = createMockVideoElement();

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      act(() => {
        Object.defineProperty(result.current.videoRef, 'current', {
          value: mockVideoElement,
          writable: true,
          configurable: true,
        });
      });

      await act(async () => {
        await result.current.startCamera();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      act(() => {
        result.current.stopCamera();
      });

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(result.current.status).toBe('idle');
    });
  });

  describe('capture', () => {
    it('should return null when camera not ready', async () => {
      setupUnsupportedNavigator();

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false);
      });

      // Camera not started, status is idle
      const photoData = result.current.capture();

      expect(photoData).toBeNull();
      // The error is set to '相机未就绪' when capture is called but camera isn't ready
      await waitFor(() => {
        expect(result.current.error).toBe('相机未就绪');
      });
    });

    it('should capture photo when camera is ready', async () => {
      setupMockNavigator();

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          // Call callback asynchronously to simulate real behavior
          setTimeout(() => {
            callback(new Blob(['test'], { type: 'image/jpeg' }));
          }, 0);
        }),
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,test'),
      };

      const mockVideoElement = createMockVideoElement();

      const originalCreateElement = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement.call(document, tag);
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      act(() => {
        Object.defineProperty(result.current.videoRef, 'current', {
          value: mockVideoElement,
          writable: true,
          configurable: true,
        });
      });

      await act(async () => {
        await result.current.startCamera();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      act(() => {
        result.current.capture();
      });

      await waitFor(() => {
        expect(result.current.capturedPhoto).not.toBeNull();
      }, { timeout: 2000 });

      expect(result.current.status).toBe('ready');
      expect(mockCanvas.toBlob).toHaveBeenCalled();
    });
  });

  describe('clearPhoto', () => {
    it('should clear captured photo', async () => {
      setupMockNavigator();

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          setTimeout(() => {
            callback(new Blob(['test'], { type: 'image/jpeg' }));
          }, 0);
        }),
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,test'),
      };

      const mockVideoElement = createMockVideoElement();

      const originalCreateElement = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement.call(document, tag);
      });

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      act(() => {
        Object.defineProperty(result.current.videoRef, 'current', {
          value: mockVideoElement,
          writable: true,
          configurable: true,
        });
      });

      await act(async () => {
        await result.current.startCamera();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      act(() => {
        result.current.capture();
      });

      await waitFor(() => {
        expect(result.current.capturedPhoto).not.toBeNull();
      }, { timeout: 2000 });

      act(() => {
        result.current.clearPhoto();
      });

      expect(result.current.capturedPhoto).toBeNull();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('switchCamera', () => {
    it('should call startCamera when switching', async () => {
      const { mockGetUserMedia } = setupMockNavigator();
      const mockVideoElement = createMockVideoElement();

      const { result } = renderHook(() => useCamera());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      act(() => {
        Object.defineProperty(result.current.videoRef, 'current', {
          value: mockVideoElement,
          writable: true,
          configurable: true,
        });
      });

      await act(async () => {
        await result.current.switchCamera();
      });

      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });
});

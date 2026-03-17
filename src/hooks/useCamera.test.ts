/**
 * Unit tests for useCamera Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCamera } from './useCamera';

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn(),
};

Object.defineProperty(navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
});

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn((blob) => `blob:${Date.now()}`);
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
  writable: true,
});

describe.skip('useCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaDevices.getUserMedia.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useCamera());

      expect(result.current.status).toBe('idle');
      expect(result.current.isSupported).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.capturedPhoto).toBeNull();
      expect(result.current.isReady).toBe(false);
    });

    it('should detect camera support on mount', async () => {
      mockMediaDevices.getUserMedia.mockResolvedValue({
        getTracks: () => [],
      });

      const { result } = renderHook(() => useCamera());

      // Wait for effect to run
      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });
    });

    it('should handle unsupported browser', () => {
      // Temporarily remove mediaDevices
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useCamera());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.error).toBe('当前浏览器不支持相机功能');

      // Restore
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
      });
    });
  });

  describe('startCamera', () => {
    it('should start camera successfully', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockVideoElement = {
        srcObject: null,
        play: vi.fn().mockResolvedValue(undefined),
        videoWidth: 1920,
        videoHeight: 1080,
      };

      // Create a video element and attach to ref
      const { result } = renderHook(() => useCamera());

      // Set up the video element
      act(() => {
        if (result.current.videoRef.current) {
          Object.assign(result.current.videoRef.current, mockVideoElement);
        }
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
      expect(result.current.status).toBe('ready');
    });

    it('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockMediaDevices.getUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('相机权限被拒绝');
    });

    it('should handle not found error', async () => {
      const error = new Error('Not found');
      error.name = 'NotFoundError';
      mockMediaDevices.getUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('未找到相机设备');
    });

    it('should handle not readable error', async () => {
      const error = new Error('Not readable');
      error.name = 'NotReadableError';
      mockMediaDevices.getUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('相机被其他应用占用');
    });

    it('should handle generic error', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Unknown error'));

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('相机错误');
    });
  });

  describe('stopCamera', () => {
    it('should stop camera and release stream', async () => {
      const mockTrack = {
        stop: vi.fn(),
      };
      const mockStream = {
        getTracks: () => [mockTrack],
      };
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const { result } = renderHook(() => useCamera());

      // Start camera first
      await act(async () => {
        await result.current.startCamera();
      });

      // Now stop
      act(() => {
        result.current.stopCamera();
      });

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(result.current.status).toBe('idle');
    });
  });

  describe('capture', () => {
    it('should return null when camera not ready', () => {
      const { result } = renderHook(() => useCamera());

      const photoData = result.current.capture();

      expect(photoData).toBeNull();
      expect(result.current.error).toBe('相机未就绪');
    });

    it('should capture photo when camera is ready', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toBlob: vi.fn((callback) => {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        }),
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,test'),
      };

      const mockVideoElement = {
        srcObject: null,
        play: vi.fn().mockResolvedValue(undefined),
        videoWidth: 1920,
        videoHeight: 1080,
      };

      // Mock document.createElement to return our canvas
      const originalCreateElement = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement.call(document, tag);
      });

      const { result } = renderHook(() => useCamera());

      // Set up the video element
      act(() => {
        if (result.current.videoRef.current) {
          Object.assign(result.current.videoRef.current, mockVideoElement);
        }
      });

      // Start camera
      await act(async () => {
        await result.current.startCamera();
      });

      // Capture photo
      await act(async () => {
        result.current.capture();
      });

      // Wait for the async toBlob callback
      await waitFor(() => {
        expect(result.current.capturedPhoto).not.toBeNull();
      }, { timeout: 1000 });

      expect(result.current.status).toBe('ready');
      expect(mockCanvas.toBlob).toHaveBeenCalled();
    });
  });

  describe('clearPhoto', () => {
    it('should clear captured photo', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
        })),
        toBlob: vi.fn((callback) => {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        }),
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,test'),
      };

      const mockVideoElement = {
        srcObject: null,
        play: vi.fn().mockResolvedValue(undefined),
        videoWidth: 1920,
        videoHeight: 1080,
      };

      const originalCreateElement = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement.call(document, tag);
      });

      const { result } = renderHook(() => useCamera());

      act(() => {
        if (result.current.videoRef.current) {
          Object.assign(result.current.videoRef.current, mockVideoElement);
        }
      });

      await act(async () => {
        await result.current.startCamera();
      });

      await act(async () => {
        result.current.capture();
      });

      await waitFor(() => {
        expect(result.current.capturedPhoto).not.toBeNull();
      }, { timeout: 1000 });

      act(() => {
        result.current.clearPhoto();
      });

      expect(result.current.capturedPhoto).toBeNull();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('switchCamera', () => {
    it('should call startCamera when switching', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

      const mockVideoElement = {
        srcObject: null,
        play: vi.fn().mockResolvedValue(undefined),
        videoWidth: 1920,
        videoHeight: 1080,
      };

      const { result } = renderHook(() => useCamera());

      act(() => {
        if (result.current.videoRef.current) {
          Object.assign(result.current.videoRef.current, mockVideoElement);
        }
      });

      await act(async () => {
        await result.current.switchCamera();
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });
  });
});

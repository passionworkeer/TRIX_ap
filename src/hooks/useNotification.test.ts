/**
 * Unit tests for useNotification Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockError, mockSuccess, mockToast, mockLoading, mockDismiss } = vi.hoisted(() => ({
  mockError: vi.fn(),
  mockSuccess: vi.fn(),
  mockToast: vi.fn(),
  mockLoading: vi.fn(),
  mockDismiss: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(mockToast, {
    error: mockError,
    success: mockSuccess,
    loading: mockLoading,
    dismiss: mockDismiss,
  }),
  toast: Object.assign(mockToast, {
    error: mockError,
    success: mockSuccess,
    loading: mockLoading,
    dismiss: mockDismiss,
  }),
}));

import { useNotification } from './useNotification';

describe('useNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('showError', () => {
    it('should call toast.error with correct options', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showError('Error message');
      });

      expect(mockError).toHaveBeenCalledWith('Error message', expect.objectContaining({
        duration: 4000,
        style: expect.objectContaining({
          background: '#fef2f2',
          color: '#991b1b',
        }),
      }));
    });

    it('should allow custom options to override defaults', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showError('Error message', { duration: 5000 });
      });

      expect(mockError).toHaveBeenCalledWith('Error message', expect.objectContaining({
        duration: 5000,
      }));
    });
  });

  describe('showSuccess', () => {
    it('should call toast.success with correct options', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showSuccess('Success message');
      });

      expect(mockSuccess).toHaveBeenCalledWith('Success message', expect.objectContaining({
        duration: 3000,
        style: expect.objectContaining({
          background: '#f0fdf4',
          color: '#166534',
        }),
      }));
    });

    it('should allow custom options to override defaults', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showSuccess('Success message', { duration: 4000 });
      });

      expect(mockSuccess).toHaveBeenCalledWith('Success message', expect.objectContaining({
        duration: 4000,
      }));
    });
  });

  describe('showWarning', () => {
    it('should call toast with warning options', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showWarning('Warning message');
      });

      expect(mockToast).toHaveBeenCalledWith('Warning message', expect.objectContaining({
        duration: 3500,
        icon: '⚠️',
        style: expect.objectContaining({
          background: '#fffbeb',
          color: '#92400e',
        }),
      }));
    });

    it('should allow custom options to override defaults', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showWarning('Warning message', { duration: 5000 });
      });

      expect(mockToast).toHaveBeenCalledWith('Warning message', expect.objectContaining({
        duration: 5000,
      }));
    });
  });

  describe('showInfo', () => {
    it('should call toast with info options', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showInfo('Info message');
      });

      expect(mockToast).toHaveBeenCalledWith('Info message', expect.objectContaining({
        duration: 3000,
        icon: 'ℹ️',
        style: expect.objectContaining({
          background: '#eff6ff',
          color: '#1e40af',
        }),
      }));
    });
  });

  describe('showLoading', () => {
    it('should call toast.loading with correct options', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.showLoading('Loading message');
      });

      expect(mockLoading).toHaveBeenCalledWith('Loading message', expect.objectContaining({
        style: expect.objectContaining({
          background: '#f8fafc',
          color: '#475569',
        }),
      }));
    });

    it('should return toast ID', () => {
      mockLoading.mockReturnValue('toast-id-123');
      const { result } = renderHook(() => useNotification());

      const toastId = result.current.showLoading('Loading message');

      expect(toastId).toBe('toast-id-123');
    });
  });

  describe('dismiss', () => {
    it('should dismiss specific toast by ID', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.dismiss('toast-id-123');
      });

      expect(mockDismiss).toHaveBeenCalledWith('toast-id-123');
    });

    it('should dismiss all toasts when no ID provided', () => {
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.dismiss();
      });

      expect(mockDismiss).toHaveBeenCalledWith();
    });
  });

  describe('toast', () => {
    it('should expose toast object', () => {
      const { result } = renderHook(() => useNotification());

      expect(result.current.toast).toBeDefined();
      expect(result.current.toast.error).toBe(mockError);
      expect(result.current.toast.success).toBe(mockSuccess);
    });
  });
});

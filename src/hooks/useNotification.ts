import { useCallback } from 'react';
import toast, { ToastOptions } from 'react-hot-toast';

/**
 * 统一通知系统 Hook
 * 基于 react-hot-toast 封装，提供常用的通知方法
 */
export function useNotification() {
  const showError = useCallback((message: string, options?: ToastOptions) => {
    toast.error(message, {
      duration: 4000,
      style: {
        background: '#fef2f2',
        color: '#991b1b',
        border: '1px solid #fecaca',
      },
      ...options,
    });
  }, []);

  const showSuccess = useCallback((message: string, options?: ToastOptions) => {
    toast.success(message, {
      duration: 3000,
      style: {
        background: '#f0fdf4',
        color: '#166534',
        border: '1px solid #bbf7d0',
      },
      ...options,
    });
  }, []);

  const showWarning = useCallback((message: string, options?: ToastOptions) => {
    toast(message, {
      duration: 3500,
      icon: '⚠️',
      style: {
        background: '#fffbeb',
        color: '#92400e',
        border: '1px solid #fde68a',
      },
      ...options,
    });
  }, []);

  const showInfo = useCallback((message: string, options?: ToastOptions) => {
    toast(message, {
      duration: 3000,
      icon: 'ℹ️',
      style: {
        background: '#eff6ff',
        color: '#1e40af',
        border: '1px solid #bfdbfe',
      },
      ...options,
    });
  }, []);

  const showLoading = useCallback((message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      style: {
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #e2e8f0',
      },
      ...options,
    });
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }, []);

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showLoading,
    dismiss,
    toast,
  };
}

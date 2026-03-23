/**
 * 错误处理 Hooks
 *
 * 提供 React 组件中使用的错误处理 hooks
 */

import { useCallback } from 'react';
import { useNotification } from '../hooks/useNotification';
import { logger } from '../utils/logger';
import {
  parseError,
  AppError,
  createSuccessResponse,
  createErrorResponse,
  ApiResponse,
} from './errors';

const isDev = import.meta.env.DEV;

/**
 * useErrorHandler 返回类型
 */
export interface UseErrorHandlerReturn {
  /** 处理错误 */
  handleError: (error: unknown, customMessage?: string) => void;
  /** 显示错误消息 */
  showError: (message: string) => void;
  /** 只记录错误日志 */
  logError: (error: unknown) => void;
  /** 异步错误包装器 */
  withErrorHandling: <T>(
    asyncFn: () => Promise<T>,
    customMessage?: string
  ) => Promise<T | null>;
  /** 安全的异步处理，返回 [error, data] */
  safeAsync: <T>(asyncFn: () => Promise<T>) => Promise<[AppError | null, T | null]>;
}

/**
 * 错误处理 Hook
 *
 * 使用方式：
 * ```tsx
 * const { handleError, withErrorHandling } = useErrorHandler();
 *
 * // 方式 1: 处理错误
 * try {
 *   await doSomething();
 * } catch (error) {
 *   handleError(error, '操作失败');
 * }
 *
 * // 方式 2: 使用包装器
 * const result = await withErrorHandling(fetchData(), '获取数据失败');
 * ```
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const notification = useNotification();

  /**
   * 处理错误并显示用户友好的消息
   */
  const handleError = useCallback(
    (error: unknown, customMessage?: string): void => {
      const appError = parseError(error);

      // 使用自定义消息覆盖默认消息
      if (customMessage) {
        appError.message = customMessage;
      }

      // 记录错误日志
      if (isDev) {
        logger.error('UI', 'Error handled:', {
          code: appError.code,
          message: appError.message,
          details: appError.details,
        });
      }

      // 显示错误消息给用户
      notification.showError(appError.message);
    },
    [notification]
  );

  /**
   * 只显示错误消息，不记录日志
   */
  const showError = useCallback(
    (message: string): void => {
      notification.showError(message);
    },
    [notification]
  );

  /**
   * 只记录错误日志，不显示给用户
   */
  const logError = useCallback((error: unknown): void => {
    const appError = parseError(error);
    logger.error('UI', 'Error logged:', {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    });
  }, []);

  /**
   * 异步错误包装器
   * 自动捕获并处理 async 函数中的错误
   */
  const withErrorHandling = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      customMessage?: string
    ): Promise<T | null> => {
      try {
        return await asyncFn();
      } catch (error) {
        handleError(error, customMessage);
        return null;
      }
    },
    [handleError]
  );

  /**
   * 安全的异步处理
   * 返回 [error, data] 元组
   */
  const safeAsync = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<[AppError | null, T | null]> => {
      try {
        const data = await asyncFn();
        return [null, data];
      } catch (error) {
        const appError = parseError(error);
        handleError(appError);
        return [appError, null];
      }
    },
    [handleError]
  );

  return {
    handleError,
    showError,
    logError,
    withErrorHandling,
    safeAsync,
  };
}

/**
 * useApi 返回类型
 */
export interface UseApiReturn<T> {
  /** 是否正在加载 */
  loading: boolean;
  /** 错误对象 */
  error: AppError | null;
  /** 数据 */
  data: T | null;
  /** 执行 API 调用 */
  execute: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * API 调用 Hook
 *
 * 使用方式：
 * ```tsx
 * const { loading, error, data, execute } = useApi(fetchUserProfile);
 *
 * useEffect(() => {
 *   execute();
 * }, []);
 * ```
 */
export function useApi<T>(
  apiFn: () => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: AppError) => void;
    immediate?: boolean;
  }
): UseApiReturn<T> {
  const { handleError } = useErrorHandler();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFn();
      setData(result);

      if (options?.onSuccess) {
        options.onSuccess(result);
      }
    } catch (err) {
      const appError = parseError(err);
      setError(appError);

      if (options?.onError) {
        options.onError(appError);
      } else {
        handleError(appError);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFn, handleError, options]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  useEffect(() => {
    if (options?.immediate) {
      execute();
    }
  }, [options?.immediate, execute]);

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}

/**
 * useApiAction 返回类型
 */
export interface UseApiActionReturn<T> {
  /** 是否正在加载 */
  loading: boolean;
  /** 错误对象 */
  error: AppError | null;
  /** 执行 API 调用 */
  execute: () => Promise<T | null>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * API 操作 Hook（用于表单提交等）
 *
 * 使用方式：
 * ```tsx
 * const { loading, error, execute } = useApiAction(updateProfile);
 *
 * const handleSubmit = async (data) => {
 *   const result = await execute(data);
 *   if (result) {
 *     // 成功
 *   }
 * };
 * ```
 */
export function useApiAction<TArgs extends unknown[], TResponse>(
  apiFn: (...args: TArgs) => Promise<TResponse>,
  options?: {
    onSuccess?: (data: TResponse) => void;
    onError?: (error: AppError) => void;
  }
): UseApiActionReturn<TResponse> {
  const { safeAsync } = useErrorHandler();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResponse | null> => {
      setLoading(true);
      setError(null);

      const [err, data] = await safeAsync(() => apiFn(...args));

      if (err) {
        setError(err);

        if (options?.onError) {
          options.onError(err);
        }

        return null;
      }

      if (data && options?.onSuccess) {
        options.onSuccess(data);
      }

      setLoading(false);
      return data;
    },
    [apiFn, safeAsync, options]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    execute,
    reset,
  };
}

// 需要导入 React hooks
import { useState, useEffect } from 'react';

/**
 * 转换 Service 结果为 API 响应的 Hook
 *
 * 用于将 Service 层的原始结果转换为统一的 API 响应格式
 */
export function useServiceResponse<T>(
  serviceFn: () => Promise<T>
): {
  loading: boolean;
  response: ApiResponse<T>;
  execute: () => Promise<void>;
} {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse<T>>({
    success: false,
  });

  const execute = useCallback(async () => {
    setLoading(true);

    try {
      const data = await serviceFn();
      setResponse(createSuccessResponse(data));
    } catch (error) {
      const appError = parseError(error);
      setResponse(createErrorResponse(appError.code, appError.message, appError.details));
    } finally {
      setLoading(false);
    }
  }, [serviceFn]);

  return {
    loading,
    response,
    execute,
  };
}

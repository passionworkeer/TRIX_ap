/**
 * 全局错误拦截器
 *
 * 功能：
 * - 全局 Promise 未捕获错误处理
 * - 全局 JavaScript 错误处理
 * - 网络请求错误统一处理
 * - 错误日志记录
 */

import toast from 'react-hot-toast';
import { parseError, AppError, ErrorCode } from './errors';
import { isDev } from '../utils/env';

/**
 * 控制台日志包装器
 */
const consoleLog = {
  error: (...args: unknown[]) => console.error(`[ERROR]`, ...args),
};

/**
 * 全局错误处理器配置
 */
export interface GlobalErrorHandlerConfig {
  /** 是否显示用户通知 */
  showNotification?: boolean;
  /** 是否记录到日志 */
  logError?: boolean;
  /** 自定义错误处理回调 */
  onError?: (error: AppError) => void;
}

/**
 * 默认配置
 */
const defaultConfig: GlobalErrorHandlerConfig = {
  showNotification: true,
  logError: true,
  onError: undefined,
};

let currentConfig = { ...defaultConfig };

/**
 * 初始化全局错误处理器
 */
export function initGlobalErrorHandler(config?: GlobalErrorHandlerConfig): void {
  currentConfig = { ...defaultConfig, ...config };

  // 1. 处理未捕获的 Promise  rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // 2. 处理全局 JavaScript 错误
  window.addEventListener('error', handleGlobalError);

  // 3. 处理 Vue/React 路由错误（如果使用）
  // window.addEventListener('error', handleRouteError);
}

/**
 * 移除全局错误处理器
 */
export function removeGlobalErrorHandler(): void {
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('error', handleGlobalError);
}

/**
 * 处理未捕获的 Promise 错误
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason;

  // 解析错误
  const appError = parseError(error);

  // 阻止默认行为（浏览器控制台错误）
  event.preventDefault();

  // 记录错误
  if (currentConfig.logError) {
    logAppError(appError, 'Unhandled Promise Rejection');
  }

  // 调用自定义回调
  if (currentConfig.onError) {
    currentConfig.onError(appError);
  }

  // 显示用户通知
  if (currentConfig.showNotification) {
    showErrorNotification(appError);
  }
}

/**
 * 处理全局 JavaScript 错误
 */
function handleGlobalError(event: ErrorEvent): void {
  // 忽略资源加载错误（如图片、脚本加载失败）
  if (event.message && (
    event.message.includes('Loading error') ||
    event.message.includes('Failed to load') ||
    event.target instanceof HTMLImageElement ||
    event.target instanceof HTMLScriptElement ||
    event.target instanceof HTMLLinkElement
  )) {
    return;
  }

  // 解析错误
  const appError = parseError(event.error || event.message);

  // 记录错误
  if (currentConfig.logError) {
    logAppError(appError, 'Global JavaScript Error');
  }

  // 调用自定义回调
  if (currentConfig.onError) {
    currentConfig.onError(appError);
  }

  // 显示用户通知
  if (currentConfig.showNotification) {
    showErrorNotification(appError);
  }
}

/**
 * 显示错误通知
 */
function showErrorNotification(error: AppError): void {
  if (typeof window === 'undefined') return;

  try {
    toast.error(error.message, {
      duration: 4000,
      style: {
        background: '#fef2f2',
        color: '#991b1b',
        border: '1px solid #fecaca',
      },
    });
  } catch {
    // 如果 toast 运行时不可用，不显示任何通知（silent fail）
  }
}

/**
 * 记录应用错误
 */
function logAppError(error: AppError, context: string): void {
  if (isDev()) {
    consoleLog.error(`[${context}]`, {
      code: error.code,
      message: error.message,
      details: error.details,
      originalError: error.originalError,
    });
  } else {
    // 生产环境：发送到监控服务
    consoleLog.error(`[${context}] ${error.code}: ${error.message}`, {
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  }
}

/**
 * 创建安全 async 包装器
  // 动态导入 toast 组件
  if (typeof window === 'undefined') return;

  import('react-hot-toast').then(({ toast }) => {
    toast.error(error.message, {
      duration: 4000,
      style: {
        background: '#fef2f2',
        color: '#991b1b',
        border: '1px solid #fecaca',
      },
    });
  }).catch(() => {
    // 如果导入失败，不显示任何通知（silent fail）
  });
}

/**
 * 创建安全 async 包装器
 * 自动捕获并处理错误
 */
export function safeAsync<T>(
  asyncFn: () => Promise<T>,
  onError?: (error: AppError) => void
): Promise<[AppError | null, T | null]> {
  return asyncFn()
    .then<[null, T]>((data) => [null, data])
    .catch<[AppError, null]>((error) => {
      const appError = parseError(error);

      if (currentConfig.logError) {
        logAppError(appError, 'safeAsync');
      }

      if (onError) {
        onError(appError);
      } else if (currentConfig.onError) {
        currentConfig.onError(appError);
      }

      return [appError, null];
    });
}

/**
 * 创建安全的 Promise 链
 * 在链的末尾捕获错误
 */
export function safePromise<T>(
  promise: Promise<T>,
  onError?: (error: AppError) => void
): Promise<[AppError | null, T | null]> {
  return promise
    .then<[null, T]>((data) => [null, data])
    .catch<[AppError, null]>((error) => {
      const appError = parseError(error);

      if (currentConfig.logError) {
        logAppError(appError, 'safePromise');
      }

      if (onError) {
        onError(appError);
      }

      return [appError, null];
    });
}

/**
 * 重试装饰器
 *
 * @param fn 要重试的函数
 * @param maxRetries 最大重试次数
 * @param delay 重试延迟（毫秒）
 * @param shouldRetry 判断是否应该重试的函数
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  maxRetries = 3,
  delay = 1000,
  shouldRetry?: (error: AppError) => boolean
): T {
  return ((...args: unknown[]) => {
    let lastError: AppError | null = null;

    const execute = async (): Promise<unknown> => {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = parseError(error);

        // 判断是否应该重试
        const shouldRetryResult = shouldRetry
          ? shouldRetry(lastError)
          : shouldRetryDefault(lastError);

        if (!shouldRetryResult) {
          throw lastError;
        }

        // 获取当前重试次数
        const retries = (execute as unknown as { retries: number }).retries || 0;

        if (retries < maxRetries) {
          (execute as unknown as { retries: number }).retries = retries + 1;
          // 指数退避
          const backoffDelay = delay * Math.pow(2, retries);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          return execute();
        }

        throw lastError;
      }
    };

    return execute();
  }) as T;
}

/**
 * 默认重试判断
 * 只对临时性错误进行重试
 */
function shouldRetryDefault(error: AppError): boolean {
  const retryableCodes = [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT_ERROR,
    ErrorCode.SERVER_ERROR,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.RATE_LIMIT_EXCEEDED,
  ];

  return retryableCodes.includes(error.code);
}

/**
 * 创建错误上报函数
 * 用于将错误上报到服务器
 */
export function createErrorReporter() {
  return (error: AppError, context?: Record<string, unknown>) => {
    const errorData = {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context,
    };

    // 发送到服务器（可以替换为实际的 API 端点）
    if (!isDev()) {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      }).catch(() => {
        // 忽略上报失败
      });
    }

    // 本地日志
    consoleLog.error('Error reported:', errorData);
  };
}

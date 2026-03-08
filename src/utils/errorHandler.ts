/**
 * 集中式错误处理工具
 *
 * 功能：
 * - 统一错误处理逻辑
 * - 用户友好的错误消息
 * - 错误日志记录（可接入监控服务如 Sentry）
 * - 错误分类和处理
 *
 * @deprecated 请使用 src/lib/errors.ts 中的新错误处理系统
 * 此文件保留用于向后兼容，新代码请使用 lib/errors.ts
 */

import { useNotification } from '../hooks/useNotification';
import { logger } from './logger';
import {
  ErrorCode,
  AppError as NewAppError,
  parseError as newParseError,
} from '../lib/errors';

// 重新导出新系统的类型和函数，保持向后兼容
export { ErrorCode, getErrorMessage } from '../lib/errors';

/**
 * @deprecated 使用 lib/errors.ts 中的 NewAppError
 */
export type AppError = NewAppError;

/**
 * @deprecated 使用 lib/errors.ts 中的 ErrorCode
 */
export enum ErrorType {
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 认证错误
  AUTH_ERROR = 'AUTH_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // 文件上传错误
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // 权限错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FORBIDDEN = 'FORBIDDEN',

  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 解析错误并返回 AppError（使用新系统）
 */
function parseError(error: unknown): NewAppError {
  return newParseError(error);
}

/**
 * 错误日志记录函数
 * 可接入监控服务（如 Sentry、LogRocket 等）
 */
function logError(error: NewAppError): void {
  // 开发环境：在控制台输出详细错误信息
  if (import.meta.env.DEV) {
    logger.ui.error('🔴 Error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      originalError: error.originalError,
      stack: error.stack,
    });
  }

  // 生产环境：可接入监控服务
  if (import.meta.env.PROD) {
    // 简单的生产环境日志
    logger.ui.error('Error:', {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 错误处理器 Hook
 *
 * 使用方式：
 * ```tsx
 * const { handleError } = useErrorHandler();
 *
 * try {
 *   await someOperation();
 * } catch (error) {
 *   handleError(error);
 * }
 * ```
 */
export function useErrorHandler() {
  const notification = useNotification();

  /**
   * 处理错误并显示用户友好的消息
   */
  const handleError = (error: unknown, customMessage?: string): void => {
    const appError = parseError(error);

    // 使用自定义消息（如果提供）
    if (customMessage) {
      appError.message = customMessage;
    }

    // 记录错误
    logError(appError);

    // 显示错误消息给用户
    notification.showError(appError.message || '操作失败，请稍后重试');
  };

  /**
   * 只显示错误消息，不记录日志
   */
  const showError = (message: string): void => {
    notification.showError(message);
  };

  /**
   * 只记录错误日志，不显示给用户
   */
  const logOnly = (error: unknown): void => {
    const appError = parseError(error);
    logError(appError);
  };

  /**
   * 异步错误包装器
   * 自动捕获并处理 async 函数中的错误
   */
  const withErrorHandling = async <T>(
    asyncFn: () => Promise<T>,
    customMessage?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, customMessage);
      return null;
    }
  };

  return {
    handleError,
    showError,
    logOnly,
    withErrorHandling,
  };
}

/**
 * 非 Hook 版本的错误处理函数
 * 用于在非 React 组件中处理错误
 *
 * 使用方式：
 * ```ts
 * import { handleGlobalError } from '@/utils/errorHandler';
 *
 * try {
 *   await someOperation();
 * } catch (error) {
 *   handleGlobalError(error);
 * }
 * ```
 */
export function handleGlobalError(error: unknown, customMessage?: string): void {
  const appError = parseError(error);

  if (customMessage) {
    appError.message = customMessage;
  }

  logError(appError);

  // 全局错误处理：可以显示 toast、alert 等
  // 注意：需要确保已经初始化了 toast 容器
  if (typeof window !== 'undefined') {
    // 动态导入 toast
    import('react-hot-toast').then(({ toast }) => {
      toast.error(appError.message || '操作失败，请稍后重试', {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
        },
      });
    });
  }
}

/**
 * 创建特定类型的错误（已迁移到 lib/errors.ts）
 * @deprecated 使用 lib/errors.ts 中的 ErrorFactory
 */
export const LegacyErrorFactory = {
  networkError: (message?: string) =>
    new NewAppError(ErrorCode.NETWORK_ERROR, message),

  authError: (message?: string) =>
    new NewAppError(ErrorCode.AUTH_ERROR, message),

  databaseError: (message?: string) =>
    new NewAppError(ErrorCode.DATABASE_ERROR, message),

  notFoundError: (message?: string) =>
    new NewAppError(ErrorCode.NOT_FOUND, message),

  fileUploadError: (message?: string) =>
    new NewAppError(ErrorCode.FILE_UPLOAD_ERROR, message),

  validationError: (message?: string) =>
    new NewAppError(ErrorCode.VALIDATION_ERROR, message),

  permissionDeniedError: (message?: string) =>
    new NewAppError(ErrorCode.PERMISSION_DENIED, message),
};

/**
 * 类型守卫已从 ../lib/errors 导出
 * 参见上方第 27 行
 */

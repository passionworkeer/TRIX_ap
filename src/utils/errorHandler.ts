/**
 * 集中式错误处理工具
 *
 * 功能：
 * - 统一错误处理逻辑
 * - 用户友好的错误消息
 * - 错误日志记录（可接入监控服务如 Sentry）
 * - 错误分类和处理
 */

import { useNotification } from '../hooks/useNotification';

// 错误类型枚举
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

// 用户友好的错误消息映射（中文）
const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [ErrorType.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ErrorType.AUTH_ERROR]: '认证失败，请重新登录',
  [ErrorType.UNAUTHORIZED]: '未授权访问，请先登录',
  [ErrorType.SESSION_EXPIRED]: '会话已过期，请重新登录',
  [ErrorType.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
  [ErrorType.NOT_FOUND]: '请求的资源不存在',
  [ErrorType.DUPLICATE_ENTRY]: '该记录已存在',
  [ErrorType.CONSTRAINT_VIOLATION]: '操作违反了数据约束',
  [ErrorType.FILE_UPLOAD_ERROR]: '文件上传失败，请重试',
  [ErrorType.FILE_TOO_LARGE]: '文件大小超出限制',
  [ErrorType.INVALID_FILE_TYPE]: '不支持的文件类型',
  [ErrorType.VALIDATION_ERROR]: '输入数据验证失败',
  [ErrorType.INVALID_INPUT]: '输入数据格式不正确',
  [ErrorType.PERMISSION_DENIED]: '权限不足，无法执行此操作',
  [ErrorType.FORBIDDEN]: '禁止访问此资源',
  [ErrorType.UNKNOWN_ERROR]: '操作失败，请稍后重试',
};

// 自定义错误类
export class AppError extends Error {
  type: ErrorType;
  originalError?: unknown;
  userMessage?: string;
  context?: Record<string, any>;

  constructor(
    type: ErrorType,
    message?: string,
    originalError?: unknown,
    context?: Record<string, any>
  ) {
    super(message || ERROR_MESSAGES[type]);
    this.type = type;
    this.originalError = originalError;
    this.userMessage = message || ERROR_MESSAGES[type];
    this.context = context;
    this.name = 'AppError';
  }
}

/**
 * 解析错误并返回 AppError
 */
function parseError(error: unknown): AppError {
  // 已经是 AppError，直接返回
  if (error instanceof AppError) {
    return error;
  }

  // 处理标准 Error 对象
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 网络错误
    if (message.includes('network') || message.includes('fetch')) {
      return new AppError(ErrorType.NETWORK_ERROR, undefined, error);
    }
    if (message.includes('timeout')) {
      return new AppError(ErrorType.TIMEOUT_ERROR, undefined, error);
    }

    // 认证错误
    if (message.includes('unauthorized') || message.includes('401')) {
      return new AppError(ErrorType.UNAUTHORIZED, undefined, error);
    }
    if (message.includes('session') || message.includes('expired')) {
      return new AppError(ErrorType.SESSION_EXPIRED, undefined, error);
    }

    // 权限错误
    if (message.includes('permission') || message.includes('forbidden') || message.includes('403')) {
      return new AppError(ErrorType.PERMISSION_DENIED, undefined, error);
    }

    // 数据库错误
    if (message.includes('database') || message.includes('supabase')) {
      return new AppError(ErrorType.DATABASE_ERROR, undefined, error);
    }
    if (message.includes('not found') || message.includes('404')) {
      return new AppError(ErrorType.NOT_FOUND, undefined, error);
    }
    if (message.includes('duplicate') || message.includes('already exists')) {
      return new AppError(ErrorType.DUPLICATE_ENTRY, undefined, error);
    }

    // 文件上传错误
    if (message.includes('upload') || message.includes('file')) {
      return new AppError(ErrorType.FILE_UPLOAD_ERROR, undefined, error);
    }
    if (message.includes('too large') || message.includes('size')) {
      return new AppError(ErrorType.FILE_TOO_LARGE, undefined, error);
    }
    if (message.includes('invalid') && message.includes('type')) {
      return new AppError(ErrorType.INVALID_FILE_TYPE, undefined, error);
    }

    // 验证错误
    if (message.includes('validation') || message.includes('invalid')) {
      return new AppError(ErrorType.VALIDATION_ERROR, undefined, error);
    }

    // 默认未知错误
    return new AppError(ErrorType.UNKNOWN_ERROR, undefined, error);
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return new AppError(ErrorType.UNKNOWN_ERROR, error);
  }

  // 其他未知错误
  return new AppError(ErrorType.UNKNOWN_ERROR);
}

/**
 * 错误日志记录函数
 * 可接入监控服务（如 Sentry、LogRocket 等）
 */
function logError(error: AppError): void {
  // 开发环境：在控制台输出详细错误信息
  if (import.meta.env.DEV) {
    console.error('🔴 Error:', {
      type: error.type,
      message: error.userMessage,
      originalError: error.originalError,
      context: error.context,
      stack: error.stack,
    });
  }

  // 生产环境：可接入监控服务
  if (import.meta.env.PROD) {
    // 集成监控服务（如 Sentry、LogRocket 等）以跟踪生产环境错误
    // 需要配置监控服务的 SDK 和 API 密钥
    // 示例：
    // Sentry.captureException(error);
    // Sentry.captureException(error.originalError);

    // 简单的生产环境日志
    console.error('Error:', {
      type: error.type,
      message: error.userMessage,
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
      appError.userMessage = customMessage;
    }

    // 记录错误
    logError(appError);

    // 显示错误消息给用户
    notification.showError(appError.userMessage || '操作失败，请稍后重试');
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
    appError.userMessage = customMessage;
  }

  logError(appError);

  // 全局错误处理：可以显示 toast、alert 等
  // 注意：需要确保已经初始化了 toast 容器
  if (typeof window !== 'undefined') {
    // 动态导入 toast
    import('react-hot-toast').then(({ toast }) => {
      toast.error(appError.userMessage || '操作失败，请稍后重试', {
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
 * 创建特定类型的错误
 */
export const ErrorFactory = {
  networkError: (message?: string) =>
    new AppError(ErrorType.NETWORK_ERROR, message),

  authError: (message?: string) =>
    new AppError(ErrorType.AUTH_ERROR, message),

  databaseError: (message?: string) =>
    new AppError(ErrorType.DATABASE_ERROR, message),

  notFoundError: (message?: string) =>
    new AppError(ErrorType.NOT_FOUND, message),

  fileUploadError: (message?: string) =>
    new AppError(ErrorType.FILE_UPLOAD_ERROR, message),

  validationError: (message?: string) =>
    new AppError(ErrorType.VALIDATION_ERROR, message),

  permissionDeniedError: (message?: string) =>
    new AppError(ErrorType.PERMISSION_DENIED, message),
};

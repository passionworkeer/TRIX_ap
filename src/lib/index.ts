/**
 * 统一错误处理系统导出
 *
 * 使用方式：
 * ```ts
 * import { AppError, ErrorCode, parseError } from '@/lib/errors';
 * ```
 */

// 核心错误类
export {
  AppError,
  ErrorCode,
  ERROR_MESSAGES,
  createError,
  ErrorFactory,
  parseError,
  isAppError,
  hasErrorMessage,
  getErrorMessage,
  getErrorCode,
} from './errors';

// API 响应格式
export type {
  ApiResponse,
  ApiError,
  ApiResponseMeta,
} from './errors';
export {
  createSuccessResponse,
  createErrorResponse,
} from './errors';

// 错误边界
export {
  ErrorBoundary,
  withErrorBoundary,
  to,
  useAsyncErrorBoundary,
} from './error-boundary';

// 全局错误拦截器
export {
  initGlobalErrorHandler,
  removeGlobalErrorHandler,
  safeAsync,
  safePromise,
  withRetry,
  createErrorReporter,
} from './error-interceptor';

// 错误处理 Hooks
export {
  useErrorHandler,
  useApi,
  useApiAction,
  useServiceResponse,
} from './error-hooks';
export type {
  UseErrorHandlerReturn,
  UseApiReturn,
  UseApiActionReturn,
} from './error-hooks';

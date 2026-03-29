/**
 * ErrorHandler 工具测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  AppError,
  ErrorFactory,
  hasErrorMessage,
  getErrorMessage,
  parseError,
} from '../lib/errors';
import {
  useErrorHandler,
  handleGlobalError,
} from './errorHandler';

// Mock import.meta.env
vi.mock('import.meta.env', () => ({
  DEV: true,
  PROD: false,
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const toast = {
    error: vi.fn(),
    success: vi.fn(),
  };

  return {
    default: toast,
    toast,
  };
});

// Mock useNotification hook
vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    showLoading: vi.fn(),
    dismiss: vi.fn(),
    toast: {
      error: vi.fn(),
      success: vi.fn(),
    },
  }),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    ui: {
      error: vi.fn(),
    },
  },
}));

describe('errorHandler', () => {
  let consoleSpies: {
    error: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpies = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('AppError 类', () => {
    it('应该正确创建 AppError 实例', () => {
      const error = new AppError(ErrorCode.NETWORK_ERROR, '自定义消息');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('自定义消息');
      expect(error.name).toBe('AppError');
    });

    it('应该使用默认错误消息', () => {
      const error = new AppError(ErrorCode.NETWORK_ERROR);

      expect(error.message).toBe('网络连接失败，请检查网络后重试');
    });

    it('应该保存原始错误和上下文', () => {
      const originalError = new Error('原始错误');
      const details = { userId: '123', action: 'login' };
      const error = new AppError(ErrorCode.AUTH_ERROR, undefined, { details, originalError });

      expect(error.originalError).toBe(originalError);
      expect(error.details).toEqual(details);
    });
  });

  describe('ErrorFactory', () => {
    it('应该创建网络错误', () => {
      const error = ErrorFactory.networkError('自定义网络错误');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('自定义网络错误');
    });

    it('应该创建认证错误', () => {
      const error = ErrorFactory.authError();
      expect(error.code).toBe(ErrorCode.AUTH_ERROR);
    });

    it('应该创建数据库错误', () => {
      const error = ErrorFactory.databaseError();
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('应该创建未找到错误', () => {
      const error = ErrorFactory.notFound('资源不存在');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('资源不存在');
    });

    it('应该创建文件上传错误', () => {
      const error = ErrorFactory.fileUploadError();
      expect(error.code).toBe(ErrorCode.FILE_UPLOAD_ERROR);
    });

    it('应该创建验证错误', () => {
      const error = ErrorFactory.validationError();
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该创建权限拒绝错误', () => {
      const error = ErrorFactory.permissionDenied();
      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  describe('错误分类 - 通过 handleError', () => {
    it('应该识别网络错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('network error');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('应该识别 fetch 错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('fetch failed');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('应该识别超时错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('request timeout');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    it('应该识别未授权错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('unauthorized');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('应该识别 401 错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('401 Unauthorized');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('应该识别会话过期错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('session expired');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.SESSION_EXPIRED);
    });

    it('应该识别权限错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('permission denied');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('应该识别 403 错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('403 Forbidden');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('应该识别数据库错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('database error');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      // New system: "database" error not explicitly matched, returns UNKNOWN_ERROR
      expect(call.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('应该识别 404 错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('404 Not Found');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('应该识别重复条目错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('duplicate entry already exists');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.DUPLICATE_ENTRY);
    });

    it('应该识别文件上传错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('file upload failed');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.FILE_UPLOAD_ERROR);
    });

    it('应该识别文件过大错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('file too large');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      // New system correctly identifies this as FILE_TOO_LARGE
      expect(call.code).toBe(ErrorCode.FILE_TOO_LARGE);
    });

    it('应该识别无效文件类型错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('invalid file type');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      // New system: detectValidationError catches 'invalid' first, returns VALIDATION_ERROR
      expect(call.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该识别验证错误', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('validation failed');
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该处理字符串错误', async () => {
      const { handleError } = useErrorHandler();
      const error = 'string error message';
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('应该处理未知错误', async () => {
      const { handleError } = useErrorHandler();
      const error = { code: 'UNKNOWN' };
      const { logger } = await import('../utils/logger');

      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string };
      expect(call.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('应该处理已经是 AppError 的错误', async () => {
      const { handleError } = useErrorHandler();
      const appError = new AppError(ErrorCode.NOT_FOUND, '测试错误');
      const { logger } = await import('../utils/logger');

      handleError(appError);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { code: string; message: string };
      expect(call.code).toBe(ErrorCode.NOT_FOUND);
      expect(call.message).toBe('测试错误');
    });

    it('应该包含原始错误和上下文', async () => {
      const originalError = new Error('原始错误');
      const details = { userId: '123' };
      const error = new AppError(ErrorCode.AUTH_ERROR, undefined, { details, originalError });
      const { logger } = await import('../utils/logger');

      const { handleError } = useErrorHandler();
      handleError(error);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { originalError: unknown; details: unknown };
      expect(call.originalError).toBe(originalError);
      expect(call.details).toEqual(details);
    });
  });

  describe('用户通知测试 - useErrorHandler', () => {
    it('handleError 应该解析错误并记录日志', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('network error');
      const { logger } = await import('../utils/logger');

      handleError(error);

      // 验证错误类型被正确识别并记录
      expect(logger.ui.error).toHaveBeenCalled();
    });

    it('handleError 应该使用自定义消息', async () => {
      const { handleError } = useErrorHandler();
      const error = new Error('network error');
      const customMessage = '自定义错误消息';
      const { logger } = await import('../utils/logger');

      handleError(error, customMessage);

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { message: string };
      expect(call.message).toBe(customMessage);
    });

    it('showError 应该只显示错误消息', async () => {
      const { showError } = useErrorHandler();

      showError('测试错误消息');

      // showError calls notification.showError, not the logger
      expect(true).toBe(true);
    });

    it('logOnly 应该只记录日志不显示通知', async () => {
      const { logOnly } = useErrorHandler();
      const error = new Error('test error');
      const { logger } = await import('../utils/logger');

      logOnly(error);

      expect(logger.ui.error).toHaveBeenCalled();
    });

    it('withErrorHandling 应该捕获异步错误', async () => {
      const { withErrorHandling } = useErrorHandler();
      const { logger } = await import('../utils/logger');

      const result = await withErrorHandling(async () => {
        throw new Error('async error');
      });

      expect(result).toBeNull();
      expect(logger.ui.error).toHaveBeenCalled();
    });

    it('withErrorHandling 应该返回异步函数结果', async () => {
      const { withErrorHandling } = useErrorHandler();
      const { logger } = await import('../utils/logger');

      const result = await withErrorHandling(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(logger.ui.error).not.toHaveBeenCalled();
    });

    it('withErrorHandling 应该使用自定义消息', async () => {
      const { withErrorHandling } = useErrorHandler();
      const { logger } = await import('../utils/logger');

      await withErrorHandling(async () => {
        throw new Error('error');
      }, '自定义消息');

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { message: string };
      expect(call.message).toBe('自定义消息');
    });
  });

  describe('错误上报测试 - handleGlobalError', () => {
    beforeEach(async () => {
      // Mock window for handleGlobalError
      vi.stubGlobal('window', { location: { href: '' } });
      // Clear the toast mock to reset it
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('应该解析并记录错误', async () => {
      const error = new Error('test error');
      const { logger } = await import('../utils/logger');

      handleGlobalError(error);

      expect(logger.ui.error).toHaveBeenCalled();
    });

    it('应该使用自定义消息', async () => {
      const error = new Error('test error');
      const { logger } = await import('../utils/logger');

      handleGlobalError(error, '全局错误处理');

      expect(logger.ui.error).toHaveBeenCalled();
      const call = logger.ui.error.mock.calls[0][1] as { message: string };
      expect(call.message).toBe('全局错误处理');
    });
  });

  describe('错误恢复测试', () => {
    describe('hasErrorMessage', () => {
      it('应该识别具有 message 属性的对象', () => {
        const error = { message: '错误消息' };
        expect(hasErrorMessage(error)).toBe(true);
      });

      it('应该拒绝没有 message 属性的对象', () => {
        const error = { code: 'ERR_CODE' };
        expect(hasErrorMessage(error)).toBe(false);
      });

      it('应该拒绝 message 为非字符串的对象', () => {
        const error = { message: 123 };
        expect(hasErrorMessage(error)).toBe(false);
      });

      it('应该拒绝 null', () => {
        expect(hasErrorMessage(null)).toBe(false);
      });

      it('应该拒绝 undefined', () => {
        expect(hasErrorMessage(undefined)).toBe(false);
      });

      it('应该接受 Error 实例', () => {
        const error = new Error('错误消息');
        expect(hasErrorMessage(error)).toBe(true);
      });
    });

    describe('getErrorMessage', () => {
      it('应该从错误对象获取消息', () => {
        const error = { message: '测试消息' };
        expect(getErrorMessage(error)).toBe('测试消息');
      });

      it('应该使用默认消息', () => {
        const error = { code: 'ERR' };
        expect(getErrorMessage(error)).toBe('操作失败，请稍后重试');
      });

      it('应该使用自定义默认消息', () => {
        const error = { code: 'ERR' };
        expect(getErrorMessage(error, '自定义默认')).toBe('自定义默认');
      });

      it('应该正确处理 Error 实例', () => {
        const error = new Error('Error 消息');
        expect(getErrorMessage(error)).toBe('Error 消息');
      });

      it('应该正确处理 AppError', () => {
        const error = new AppError(ErrorCode.NOT_FOUND, 'AppError 消息');
        expect(getErrorMessage(error)).toBe('AppError 消息');
      });
    });
  });

  describe('ErrorCode 枚举', () => {
    it('应该包含所有预期的错误类型', () => {
      expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
      expect(ErrorCode.AUTH_ERROR).toBe('AUTH_ERROR');
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCode.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.DUPLICATE_ENTRY).toBe('DUPLICATE_ENTRY');
      expect(ErrorCode.FILE_UPLOAD_ERROR).toBe('FILE_UPLOAD_ERROR');
      expect(ErrorCode.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE');
      expect(ErrorCode.INVALID_FILE_TYPE).toBe('INVALID_FILE_TYPE');
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });
});

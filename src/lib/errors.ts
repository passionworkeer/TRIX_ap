/**
 * 统一错误处理系统
 *
 * 提供：
 * - 统一的错误类型枚举 (ErrorCode)
 * - 统一错误类 (AppError)
 * - 错误工厂函数
 * - API 响应格式
 * - 错误码映射 (Supabase, 网络, 验证)
 * - 用户友好的中文消息
 */

interface PostgrestError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
}

// ============================================
// 错误类型枚举
// ============================================

/**
 * 应用错误码枚举
 * 覆盖所有可能的错误类型
 */
export enum ErrorCode {
  // 网络错误 (1xxx)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  NO_INTERNET = 'NO_INTERNET',

  // 认证错误 (2xxx)
  AUTH_ERROR = 'AUTH_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_INVALID = 'TOKEN_INVALID',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // 权限错误 (3xxx)
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FORBIDDEN = 'FORBIDDEN',
  ROLE_NOT_ALLOWED = 'ROLE_NOT_ALLOWED',

  // 验证错误 (4xxx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // 资源错误 (5xxx)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // 业务逻辑错误 (6xxx)
  INSUFFICIENT_POINTS = 'INSUFFICIENT_POINTS',
  ITEM_ALREADY_OWNED = 'ITEM_ALREADY_OWNED',
  STUDY_ROOM_FULL = 'STUDY_ROOM_FULL',
  ALREADY_PAIRED = 'ALREADY_PAIRED',

  // 服务器错误 (7xxx)
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 文件错误 (8xxx)
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // 未知错误 (9xxx)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
}

// ============================================
// 用户友好的中文错误消息
// ============================================

/**
 * 错误码到中文消息的映射
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 网络错误
  [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络后重试',
  [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ErrorCode.CONNECTION_REFUSED]: '无法连接到服务器，请稍后重试',
  [ErrorCode.NO_INTERNET]: '网络不可用，请检查网络连接',

  // 认证错误
  [ErrorCode.AUTH_ERROR]: '认证失败，请重新登录',
  [ErrorCode.UNAUTHORIZED]: '未授权访问，请先登录',
  [ErrorCode.SESSION_EXPIRED]: '登录状态已过期，请重新登录',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.TOKEN_INVALID]: '登录令牌无效，请重新登录',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',

  // 权限错误
  [ErrorCode.PERMISSION_DENIED]: '权限不足，无法执行此操作',
  [ErrorCode.FORBIDDEN]: '禁止访问此资源',
  [ErrorCode.ROLE_NOT_ALLOWED]: '您的账号权限不足以执行此操作',

  // 验证错误
  [ErrorCode.VALIDATION_ERROR]: '输入数据验证失败',
  [ErrorCode.INVALID_INPUT]: '输入数据格式不正确',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '缺少必填字段',
  [ErrorCode.INVALID_FORMAT]: '数据格式不正确',

  // 资源错误
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.RESOURCE_CONFLICT]: '资源冲突，请稍后重试',
  [ErrorCode.DUPLICATE_ENTRY]: '该记录已存在',
  [ErrorCode.RESOURCE_LOCKED]: '资源已被锁定，请稍后重试',

  // 业务逻辑错误
  [ErrorCode.INSUFFICIENT_POINTS]: '积分不足，无法完成操作',
  [ErrorCode.ITEM_ALREADY_OWNED]: '您已拥有该物品',
  [ErrorCode.STUDY_ROOM_FULL]: '学习室已满，请选择其他学习室',
  [ErrorCode.ALREADY_PAIRED]: '设备已配对，请先解除配对',

  // 服务器错误
  [ErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败，请稍后重试',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后重试',

  // 文件错误
  [ErrorCode.FILE_UPLOAD_ERROR]: '文件上传失败，请重试',
  [ErrorCode.FILE_TOO_LARGE]: '文件大小超出限制',
  [ErrorCode.INVALID_FILE_TYPE]: '不支持的文件类型',
  [ErrorCode.FILE_NOT_FOUND]: '文件不存在',

  // 未知错误
  [ErrorCode.UNKNOWN_ERROR]: '操作失败，请稍后重试',
  [ErrorCode.CLIENT_ERROR]: '客户端错误，请刷新页面重试',
};

// ============================================
// 统一错误类
// ============================================

/**
 * 应用统一错误类
 * 用于所有应用层错误
 */
export class AppError extends Error {
  /** 错误码 */
  code: ErrorCode;
  /** 错误详情 */
  details?: unknown;
  /** 原始错误 */
  originalError?: unknown;
  /** HTTP 状态码（可选） */
  statusCode?: number;
  /** 是否应该向用户显示 */
  userVisible: boolean;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      details?: unknown;
      originalError?: unknown;
      statusCode?: number;
      userVisible?: boolean;
    }
  ) {
    const userMessage = message || ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
    super(userMessage);

    this.code = code;
    this.message = userMessage;
    this.details = options?.details;
    this.originalError = options?.originalError;
    this.statusCode = options?.statusCode;
    this.userVisible = options?.userVisible ?? true;
    this.name = 'AppError';

    // 保持正确的堆栈追踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 转换为 JSON 对象
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      userVisible: this.userVisible,
    };
  }
}

// ============================================
// 错误工厂函数
// ============================================

/**
 * 创建统一错误
 */
export function createError(
  code: ErrorCode,
  message?: string,
  options?: {
    details?: unknown;
    originalError?: unknown;
    statusCode?: number;
    userVisible?: boolean;
  }
): AppError {
  return new AppError(code, message, options);
}

/**
 * 错误工厂集合
 */
export const ErrorFactory = {
  // 网络错误
  networkError: (message?: string, details?: unknown) =>
    createError(ErrorCode.NETWORK_ERROR, message, { details }),

  timeoutError: (message?: string, details?: unknown) =>
    createError(ErrorCode.TIMEOUT_ERROR, message, { details }),

  connectionRefused: (message?: string, details?: unknown) =>
    createError(ErrorCode.CONNECTION_REFUSED, message, { details }),

  noInternet: (message?: string, details?: unknown) =>
    createError(ErrorCode.NO_INTERNET, message, { details }),

  // 认证错误
  authError: (message?: string, details?: unknown) =>
    createError(ErrorCode.AUTH_ERROR, message, { details, statusCode: 401 }),

  unauthorized: (message?: string, details?: unknown) =>
    createError(ErrorCode.UNAUTHORIZED, message, { details, statusCode: 401 }),

  sessionExpired: (message?: string, details?: unknown) =>
    createError(ErrorCode.SESSION_EXPIRED, message, { details, statusCode: 401 }),

  invalidCredentials: (message?: string, details?: unknown) =>
    createError(ErrorCode.INVALID_CREDENTIALS, message, { details, statusCode: 401 }),

  // 权限错误
  permissionDenied: (message?: string, details?: unknown) =>
    createError(ErrorCode.PERMISSION_DENIED, message, { details, statusCode: 403 }),

  forbidden: (message?: string, details?: unknown) =>
    createError(ErrorCode.FORBIDDEN, message, { details, statusCode: 403 }),

  // 验证错误
  validationError: (message?: string, details?: unknown) =>
    createError(ErrorCode.VALIDATION_ERROR, message, { details, statusCode: 400 }),

  invalidInput: (message?: string, details?: unknown) =>
    createError(ErrorCode.INVALID_INPUT, message, { details, statusCode: 400 }),

  // 资源错误
  notFound: (message?: string, details?: unknown) =>
    createError(ErrorCode.NOT_FOUND, message, { details, statusCode: 404 }),

  duplicateEntry: (message?: string, details?: unknown) =>
    createError(ErrorCode.DUPLICATE_ENTRY, message, { details, statusCode: 409 }),

  // 业务逻辑错误
  insufficientPoints: (message?: string, details?: unknown) =>
    createError(ErrorCode.INSUFFICIENT_POINTS, message, { details, statusCode: 400 }),

  itemAlreadyOwned: (message?: string, details?: unknown) =>
    createError(ErrorCode.ITEM_ALREADY_OWNED, message, { details, statusCode: 400 }),

  // 服务器错误
  serverError: (message?: string, details?: unknown) =>
    createError(ErrorCode.SERVER_ERROR, message, { details, statusCode: 500 }),

  databaseError: (message?: string, details?: unknown) =>
    createError(ErrorCode.DATABASE_ERROR, message, { details, statusCode: 500 }),

  // 文件错误
  fileUploadError: (message?: string, details?: unknown) =>
    createError(ErrorCode.FILE_UPLOAD_ERROR, message, { details }),

  fileTooLarge: (message?: string, details?: unknown) =>
    createError(ErrorCode.FILE_TOO_LARGE, message, { details }),

  invalidFileType: (message?: string, details?: unknown) =>
    createError(ErrorCode.INVALID_FILE_TYPE, message, { details }),

  // 未知错误
  unknownError: (message?: string, details?: unknown) =>
    createError(ErrorCode.UNKNOWN_ERROR, message, { details }),
};

// ============================================
// API 响应格式
// ============================================

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: ApiError;
  /** 元数据（如分页信息） */
  meta?: ApiResponseMeta;
}

/**
 * API 错误格式
 */
export interface ApiError {
  /** 错误码 */
  code: ErrorCode;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: unknown;
  /** 原始错误 */
  originalError?: unknown;
}

/**
 * API 响应元数据
 */
export interface ApiResponseMeta {
  /** 总记录数 */
  total?: number;
  /** 当前页码 */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 是否有下一页 */
  hasMore?: boolean;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T, meta?: ApiResponseMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  message?: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message: message || ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR],
      details,
    },
  };
}

// ============================================
// 错误码映射
// ============================================

/**
 * HTTP 状态码到错误码的映射
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.RESOURCE_CONFLICT,
  422: ErrorCode.VALIDATION_ERROR,
  429: ErrorCode.RATE_LIMIT_EXCEEDED,
  500: ErrorCode.SERVER_ERROR,
  502: ErrorCode.SERVER_ERROR,
  503: ErrorCode.EXTERNAL_SERVICE_ERROR,
};

/**
 * Supabase/PostgreSQL 错误码映射
 * 基于: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const SUPABASE_ERROR_CODE_MAP: Record<string, ErrorCode> = {
  // 认证相关
  '42501': ErrorCode.PERMISSION_DENIED, // insufficient_permission
  '28000': ErrorCode.AUTH_ERROR, // invalid_authorization_specification
  '28P01': ErrorCode.INVALID_CREDENTIALS, // invalid_authorization_specification

  // 唯一约束冲突
  '23505': ErrorCode.DUPLICATE_ENTRY, // unique_violation

  // 外键约束
  '23503': ErrorCode.RESOURCE_CONFLICT, // foreign_key_violation

  // 检查约束
  '23514': ErrorCode.VALIDATION_ERROR, // check_violation

  // 不为空约束
  '23502': ErrorCode.MISSING_REQUIRED_FIELD, // not_null_violation

  // 资源不存在
  'P0002': ErrorCode.NOT_FOUND, // no_data_found (PostgREST)

  // 资源冲突
  'P0001': ErrorCode.RESOURCE_CONFLICT, // raise_exception (PostgREST)

  // 认证错误
  'AUTH001': ErrorCode.AUTH_ERROR,
  'AUTH002': ErrorCode.SESSION_EXPIRED,
  'AUTH003': ErrorCode.INVALID_CREDENTIALS,

  // 其他数据库错误
  '53000': ErrorCode.DATABASE_ERROR, // insufficient_resources
  '53100': ErrorCode.DATABASE_ERROR, // disk_full
  '53200': ErrorCode.DATABASE_ERROR, // out_of_memory
  '54000': ErrorCode.SERVER_ERROR, // program_limit_exceeded
  '54023': ErrorCode.SERVER_ERROR, // procedure_parameter_mismatch
  '55000': ErrorCode.SERVER_ERROR, // prototype_violation
};

/**
 * 从 Supabase 错误中提取错误码
 */
function extractSupabaseErrorCode(error: PostgrestError): string {
  // PostgrestError 可能有 code, details, hint 等属性
  return error.code || '';
}

/**
 * 网络错误类型检测
 */
type NetworkErrorType = 'network' | 'timeout' | 'abort' | 'unknown';

/**
 * 检测网络错误类型
 */
function detectNetworkErrorType(error: unknown): NetworkErrorType {
  if (error instanceof TypeError) {
    // TypeError 通常是网络错误
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'network';
    }
    if (error.message.includes('timeout')) {
      return 'timeout';
    }
  }

  if (error instanceof DOMException) {
    // DOMException 用于 AbortError
    if (error.name === 'AbortError') {
      return 'abort';
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('abort')) {
      return 'abort';
    }
  }

  return 'unknown';
}

/**
 * 验证错误类型检测
 * 检测是否是验证相关错误
 */
function detectValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    );
  }
  return false;
}

// ============================================
// 错误解析器
// ============================================

/**
 * 解析任意错误为 AppError
 */
export function parseError(error: unknown): AppError {
  // 已经是 AppError，直接返回
  if (error instanceof AppError) {
    return error;
  }

  // 处理 Supabase PostgrestError
  if (isPostgrestError(error)) {
    return parseSupabaseError(error);
  }

  // 处理网络错误
  if (isNetworkError(error)) {
    return parseNetworkError(error);
  }

  // 处理标准 Error 对象
  if (error instanceof Error) {
    return parseStandardError(error);
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return createError(ErrorCode.UNKNOWN_ERROR, error);
  }

  // 其他未知错误
  return createError(ErrorCode.UNKNOWN_ERROR);
}

/**
 * 判断是否是 Supabase PostgrestError
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * 判断是否是网络错误
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return error.message.includes('network') || error.message.includes('fetch');
  }
  if (error instanceof DOMException) {
    return error.name === 'AbortError' || error.message.includes('network');
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    );
  }
  return false;
}

/**
 * 解析 Supabase 错误
 */
function parseSupabaseError(error: PostgrestError): AppError {
  const errorCode = extractSupabaseErrorCode(error);
  const mappedCode = SUPABASE_ERROR_CODE_MAP[errorCode] || ErrorCode.DATABASE_ERROR;

  // 尝试提取更具体的错误消息
  let message = error.message;

  // 处理特定错误场景
  if (errorCode === '23505') {
    message = ERROR_MESSAGES[ErrorCode.DUPLICATE_ENTRY];
  } else if (errorCode === '23503') {
    message = ERROR_MESSAGES[ErrorCode.RESOURCE_CONFLICT];
  } else if (errorCode === '23502') {
    message = ERROR_MESSAGES[ErrorCode.MISSING_REQUIRED_FIELD];
  }

  return createError(mappedCode, message, {
    details: {
      code: errorCode,
      details: error.details,
      hint: error.hint,
    },
    originalError: error,
    statusCode: error.code ? parseInt(error.code, 10) || 400 : 400,
  });
}

/**
 * 解析网络错误
 */
function parseNetworkError(error: unknown): AppError {
  const errorType = detectNetworkErrorType(error);

  switch (errorType) {
    case 'network':
      return createError(ErrorCode.NETWORK_ERROR, undefined, { originalError: error });
    case 'timeout':
      return createError(ErrorCode.TIMEOUT_ERROR, undefined, { originalError: error });
    case 'abort':
      return createError(ErrorCode.TIMEOUT_ERROR, '请求已取消', { originalError: error });
    default:
      return createError(ErrorCode.UNKNOWN_ERROR, undefined, { originalError: error });
  }
}

/**
 * 解析标准错误
 */
function parseStandardError(error: Error): AppError {
  const message = error.message.toLowerCase();

  // 认证相关
  if (message.includes('unauthorized') || message.includes('401')) {
    return createError(ErrorCode.UNAUTHORIZED, undefined, { originalError: error });
  }
  if (message.includes('session') || message.includes('expired') || message.includes('token')) {
    return createError(ErrorCode.SESSION_EXPIRED, undefined, { originalError: error });
  }
  if (message.includes('auth') || message.includes('login')) {
    return createError(ErrorCode.AUTH_ERROR, undefined, { originalError: error });
  }

  // 权限相关
  if (message.includes('permission') || message.includes('forbidden') || message.includes('403')) {
    return createError(ErrorCode.PERMISSION_DENIED, undefined, { originalError: error });
  }

  // 资源不存在
  if (message.includes('not found') || message.includes('404')) {
    return createError(ErrorCode.NOT_FOUND, undefined, { originalError: error });
  }

  // 重复资源
  if (message.includes('duplicate') || message.includes('already exists')) {
    return createError(ErrorCode.DUPLICATE_ENTRY, undefined, { originalError: error });
  }

  // 验证错误
  if (detectValidationError(error)) {
    return createError(ErrorCode.VALIDATION_ERROR, undefined, { originalError: error });
  }

  // 文件相关
  if (message.includes('upload') || message.includes('file')) {
    if (message.includes('too large') || message.includes('size')) {
      return createError(ErrorCode.FILE_TOO_LARGE, undefined, { originalError: error });
    }
    if (message.includes('invalid') && message.includes('type')) {
      return createError(ErrorCode.INVALID_FILE_TYPE, undefined, { originalError: error });
    }
    return createError(ErrorCode.FILE_UPLOAD_ERROR, undefined, { originalError: error });
  }

  // 默认未知错误
  return createError(ErrorCode.UNKNOWN_ERROR, error.message, { originalError: error });
}

// ============================================
// 错误断言和类型守卫
// ============================================

/**
 * 类型守卫：检查是否是 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 类型守卫：检查对象是否具有 message 属性
 */
export function hasErrorMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * 安全获取错误消息
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage = '操作失败，请稍后重试'
): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (hasErrorMessage(error)) {
    return error.message;
  }
  return defaultMessage;
}

/**
 * 安全获取错误码
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isAppError(error)) {
    return error.code;
  }
  return ErrorCode.UNKNOWN_ERROR;
}

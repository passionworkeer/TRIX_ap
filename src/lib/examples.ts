/**
 * 统一错误处理系统使用示例
 *
 * 本文件展示如何使用 @/lib/errors 中的错误处理功能
 */

import {
  // 核心错误类
  AppError,
  ErrorCode,
  createError,
  ErrorFactory,
  parseError,

  // API 响应格式
  ApiResponse,
  createSuccessResponse,
  createErrorResponse,

  // 错误边界
  ErrorBoundary,
  withErrorBoundary,

  // 全局错误拦截器
  initGlobalErrorHandler,
  safeAsync,
  withRetry,

  // 错误处理 Hooks
  useErrorHandler,
  useApi,
  useApiAction,
} from '@/lib';

// ============================================
// 1. 基础使用 - 创建错误
// ============================================

// 方式 1: 使用错误工厂
const networkError = ErrorFactory.networkError('网络连接失败');
const authError = ErrorFactory.authError('请重新登录');
const validationError = ErrorFactory.validationError('输入格式不正确');

// 方式 2: 使用 createError
const customError = createError(
  ErrorCode.INSUFFICIENT_POINTS,
  '积分不足，无法购买此商品',
  { details: { required: 100, current: 50 } }
);

// ============================================
// 2. 错误解析
// ============================================

// 解析来自 Supabase 的错误
async function fetchWithErrorHandling() {
  const response = await fetch('/api/data');

  if (!response.ok) {
    // 使用 parseError 自动识别错误类型
    const error = parseError(new Error(`HTTP ${response.status}`));
    console.log(error.code); // ErrorCode.UNKNOWN_ERROR
    console.log(error.message); // 用户友好的中文消息

    throw error;
  }

  return response.json();
}

// ============================================
// 3. API 响应格式
// ============================================

// 服务层返回统一格式
function fetchUserProfile(userId: string): ApiResponse<{ name: string; email: string }> {
  try {
    // 模拟业务逻辑
    const user = { name: '张三', email: 'zhangsan@example.com' };
    return createSuccessResponse(user);
  } catch (error) {
    const appError = parseError(error);
    return createErrorResponse(appError.code, appError.message);
  }
}

// 使用方
function handleProfile() {
  const response = fetchUserProfile('123');

  if (response.success) {
    console.log(response.data); // { name: '张三', email: 'zhangsan@example.com' }
  } else {
    console.log(response.error); // { code: ErrorCode, message: string }
  }
}

// ============================================
// 4. 在 React 组件中使用
// ============================================

// 示例组件
function UserProfile() {
  // 使用 useErrorHandler hook
  const { handleError, withErrorHandling } = useErrorHandler();

  // 方式 1: 手动处理错误
  const handleSubmit = async (data: unknown) => {
    try {
      await saveUserData(data);
    } catch (error) {
      handleError(error, '保存用户数据失败');
    }
  };

  // 方式 2: 使用包装器
  const handleSave = async () => {
    const result = await withErrorHandling(
      () => saveUserData({}),
      '保存失败，请重试'
    );

    if (result) {
      // 成功处理
    }
  };

  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
}

// 使用 useApi hook
function UserList() {
  const { loading, error, data, execute } = useApi(
    () => fetch('/api/users').then(r => r.json())
  );

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败: {error.message}</div>;

  return (
    <ul>
      {data?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 使用 useApiAction hook (用于表单提交)
function LoginForm() {
  const { loading, error, execute } = useApiAction(
    (credentials: { email: string; password: string }) =>
      login(credentials.email, credentials.password)
  );

  const handleLogin = async (email: string, password: string) => {
    const result = await execute({ email, password });
    if (result) {
      // 登录成功，跳转到首页
    }
  };

  return (
    <form onSubmit={() => handleLogin('test@example.com', 'password')}>
      {error && <div className="error">{error.message}</div>}
      <button type="submit" disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

// ============================================
// 5. 错误边界
// ============================================

// 方式 1: 直接使用 ErrorBoundary 组件
function App() {
  return (
    <ErrorBoundary
      onError={(error, info) => {
        // 上报错误到监控服务
        console.error(error, info);
      }}
    >
      <MainContent />
    </ErrorBoundary>
  );
}

// 方式 2: 使用 HOC 包装组件
const ProtectedRoute = withErrorBoundary(RouteComponent, {
  showDetails: true,
  onReset: () => {
    // 重置状态
  },
});

// ============================================
// 6. 全局错误拦截器
// ============================================

// 在应用入口初始化
function initApp() {
  initGlobalErrorHandler({
    showNotification: true,
    logError: true,
    onError: (error) => {
      // 上报错误到 Sentry
      // Sentry.captureException(error.originalError || error);
    },
  });
}

// ============================================
// 7. 安全异步操作
// ============================================

// 使用 safeAsync
async function safeFetch() {
  const [error, data] = await safeAsync(fetch('/api/data'));

  if (error) {
    console.error(error.code, error.message);
    return;
  }

  console.log(data);
}

// 使用 withRetry (带重试)
const fetchWithRetry = withRetry(
  () => fetch('/api/data').then(r => r.json()),
  3,  // 最多重试 3 次
  1000 // 初始延迟 1 秒
);

// ============================================
// 8. 业务错误码示例
// ============================================

// 定义业务特定的错误码
const BusinessErrorCode = {
  ...ErrorCode,
  ORDER_NOT_PAID: 'ORDER_NOT_PAID',
  PRODUCT_OUT_OF_STOCK: 'PRODUCT_OUT_OF_STOCK',
} as const;

// 业务错误工厂
const BusinessErrorFactory = {
  orderNotPaid: (message?: string) =>
    createError(BusinessErrorCode.ORDER_NOT_PAID, message || '订单未支付'),

  productOutOfStock: (message?: string) =>
    createError(BusinessErrorCode.PRODUCT_OUT_OF_STOCK, message || '商品已售罄'),
};

// ============================================
// 9. 错误消息覆盖
// ============================================

// 创建带有自定义消息的错误
const customMessageError = createError(
  ErrorCode.VALIDATION_ERROR,
  '用户名必须以字母开头' // 自定义消息，优先级高于默认消息
);

// ============================================
// 10. 错误链
// ============================================

function handleErrorChain() {
  try {
    // 业务逻辑
    throw new Error('原始错误');
  } catch (error) {
    // parseError 会保留 originalError 引用
    const appError = parseError(error);

    console.log(appError.message); // 用户友好的消息
    console.log(appError.originalError); // 原始 Error 对象
    console.log(appError.details); // 额外详情
  }
}

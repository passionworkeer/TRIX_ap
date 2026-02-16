import { Component, ErrorInfo, ReactNode } from 'react';
import { isDev } from '../utils/env';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - 捕获子组件错误并显示友好页面
 *
 * 必须使用 class 组件，因为只有 class 组件才能实现 componentDidCatch
 * 和 getDerivedStateFromError 生命周期方法
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  /**
   * 捕获错误并更新状态
   * 在渲染阶段调用，用于显示 fallback UI
   */
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  /**
   * 记录错误信息
   * 在提交阶段调用，用于记录错误日志
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误到控制台
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // 开发环境显示完整堆栈
    if (isDev()) {
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // 生产环境可以发送错误到监控服务
    if (!isDev()) {
      // TODO: 发送到 Sentry/DataDog 等监控服务
      // logErrorToService(error, errorInfo);
    }

    // 更新状态
    this.setState({
      errorInfo
    });
  }

  /**
   * 重新加载页面
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * 返回首页
   */
  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.hash = '/';
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
            {/* 错误图标 */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* 错误标题 */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              出错了
            </h1>

            {/* 错误描述 */}
            <p className="text-gray-600 mb-6 leading-relaxed">
              抱歉，应用遇到了意外错误。我们已经记录了这个问题，请尝试刷新页面或返回首页。
            </p>

            {/* 开发环境显示错误详情 */}
            {isDev() && error && (
              <div className="mb-6 text-left">
                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <summary className="text-sm font-semibold text-gray-700 mb-2">
                    错误详情（开发模式）
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-mono bg-red-50 text-red-700 p-2 rounded overflow-x-auto">
                      {error.toString()}
                    </div>
                    {errorInfo && (
                      <pre className="text-xs font-mono bg-gray-100 text-gray-700 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200 shadow-lg shadow-indigo-200"
              >
                重新加载
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors duration-200"
              >
                返回首页
              </button>
            </div>

            {/* 额外提示 */}
            <p className="mt-6 text-xs text-gray-400">
              如果问题持续存在，请联系技术支持
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

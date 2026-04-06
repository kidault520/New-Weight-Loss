import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  private autoRecoverTimeout: NodeJS.Timeout | null = null;

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [ErrorBoundary] Caught error:', error);
    console.error('❌ [ErrorBoundary] Error info:', errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // 🔥 修复 removeChild 循环：此类 DOM 错误后自动恢复会导致状态与 DOM 不一致，错误会反复触发。
    // 强制刷新页面以彻底重置 DOM，避免「一直是这个问题」。
    const isRemoveChildError = error?.message?.includes('removeChild') || error?.name === 'NotFoundError';
    if (isRemoveChildError) {
      console.warn('🔄 [ErrorBoundary] removeChild/NotFoundError 检测到，3秒后强制刷新页面');
      this.autoRecoverTimeout = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return;
    }

    // 其他错误：3秒后自动恢复
    if (this.autoRecoverTimeout) clearTimeout(this.autoRecoverTimeout);
    this.autoRecoverTimeout = setTimeout(() => {
      console.log('🔄 [ErrorBoundary] Auto-recovering from error...');
      this.setState({ hasError: false, error: null, errorInfo: null });
      this.autoRecoverTimeout = null;
    }, 3000);
  }

  componentWillUnmount() {
    // 🔥 修复：清理定时器
    if (this.autoRecoverTimeout) {
      clearTimeout(this.autoRecoverTimeout);
      this.autoRecoverTimeout = null;
    }
  }

  handleReset = () => {
    const isRemoveChildError = this.state.error?.message?.includes('removeChild') || this.state.error?.name === 'NotFoundError';
    if (isRemoveChildError) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      const isRemoveChildError = this.state.error?.message?.includes('removeChild') || this.state.error?.name === 'NotFoundError';
      return (
        <div className="h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-gray-800 mb-2">应用加载出错</h1>
              <p className="text-gray-600 mb-4">
                {isRemoveChildError ? '页面将自动刷新以恢复，请稍候…' : '应用遇到了一个错误，请刷新页面重试。'}
              </p>
              {this.state.error && (
                <div className="bg-gray-50 rounded p-3 mb-4 text-left">
                  <p className="text-sm text-gray-700 font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={this.handleReset}
                  className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  刷新页面
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}









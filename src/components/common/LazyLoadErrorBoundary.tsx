/**
 * LazyLoadErrorBoundary - 动态导入错误边界组件
 * 捕获动态导入失败的错误，提供重试机制
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class LazyLoadErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 [LazyLoadErrorBoundary] 动态导入失败:', error, errorInfo);
    
    // 如果是网络错误或动态导入错误，尝试自动重试
    if (
      error.message.includes('Failed to fetch') || 
      error.message.includes('dynamically imported') ||
      error.message.includes('Loading chunk')
    ) {
      this.handleAutoRetry();
    }
  }

  handleAutoRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      console.warn('🔴 [LazyLoadErrorBoundary] 已达到最大重试次数，停止自动重试');
      return;
    }

    // 清除之前的定时器
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // 延迟重试（指数退避）
    const delay = 1000 * Math.pow(2, retryCount);
    console.log(`🔄 [LazyLoadErrorBoundary] ${delay}ms 后自动重试 (${retryCount + 1}/${maxRetries})`);

    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1
      }));
    }, delay);
  };

  handleManualRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      retryCount: 0
    });
  };

  handleReload = () => {
    console.log('🔄 [LazyLoadErrorBoundary] 重新加载页面');
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-8 min-h-[200px]">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <p className="text-gray-700 text-lg mb-2 font-medium">组件加载失败</p>
            <p className="text-gray-500 text-sm mb-4">
              {this.state.error?.message || '动态导入模块时发生错误'}
            </p>
            {this.state.retryCount < 3 && (
              <p className="text-blue-500 text-xs mb-4">
                正在自动重试 ({this.state.retryCount + 1}/3)...
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleManualRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}









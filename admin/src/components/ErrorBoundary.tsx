import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-6 bg-red-50 rounded-lg border border-red-200">
          <h3 className="text-red-800 font-medium mb-2">页面加载出错</h3>
          <p className="text-sm text-red-600 mb-4">{this.state.error?.message || '未知错误'}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1.5 bg-red-100 text-red-800 rounded hover:bg-red-200 text-sm"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

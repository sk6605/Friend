'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 架构组件：React 错误边界墙 (Error Boundary)
 * 作用：拦截在这个组件之下的所有子组件（整个 React 树）发出的未经处理的运行时崩溃 (Runtime Error)。
 * 目标：防止整个白屏死机，提供一个优雅的“刷新重试”界面，而不是展示一长串吓人的客户端代码报错。
 * 原理：这是少数几个 React 目前要求强行要求用 class 组件而不是 hooks 编写的功能。
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // 生命周期：当子组件抛出错误时立刻被调用，用来更新 fallback UI
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // 生命周期：通常配合 Sentry 或 LogRocket 在这里往远程端发报错误日志
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 暂时仅拦截并打印在客户端控制台，避免污染普通用户的视线
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // 优雅降级全屏 UI (Fallback rendering)
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#13111c] px-4">
          <div className="max-w-sm text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                // 提供自闭环修复按钮：清空错误状态位，强制刷新浏览器
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    // 平安无事：直接透传子组件渲染树
    return this.props.children;
  }
}

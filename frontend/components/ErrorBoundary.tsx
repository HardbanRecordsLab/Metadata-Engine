
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from './icons';
import Button from './Button';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust Error Boundary to catch UI crashes.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-dark-bg text-slate-800 dark:text-slate-200 p-4">
          <div className="max-w-md w-full bg-white dark:bg-dark-card shadow-2xl rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black mb-2">Something went wrong</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              The application encountered an unexpected error.
            </p>

            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg text-left mb-6 overflow-auto max-h-32 text-xs font-mono text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-800">
              {this.state.error?.toString() || 'Unknown Error'}
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => window.location.reload()} variant="primary">
                <RefreshCw className="w-4 h-4" /> Reload App
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="secondary">
                <Home className="w-4 h-4" /> Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

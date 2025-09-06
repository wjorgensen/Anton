'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-bg-secondary border border-border rounded-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-16 h-16 text-error" />
            </div>
            
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              Something went wrong
            </h1>
            
            <p className="text-text-secondary mb-4">
              We encountered an unexpected error. This might be a temporary issue.
            </p>

            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-sm text-text-secondary cursor-pointer hover:text-text-primary">
                  Error Details
                </summary>
                <pre className="mt-2 p-2 bg-bg-primary rounded text-xs text-error overflow-auto">
                  {this.state.error.message}
                  {process.env.NODE_ENV === 'development' && (
                    <>
                      {'\n\nStack:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="space-y-2">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-bg-tertiary text-text-secondary rounded hover:bg-border hover:text-text-primary transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
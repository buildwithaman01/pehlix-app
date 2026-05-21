'use client';

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-light p-6 font-satoshi">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-teal-soft/20 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-deep/10 text-emerald-deep rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-graphite mb-3">Something went wrong</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              An unexpected error occurred. Please try reloading the page, or contact the lab staff if the issue persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="bg-neutral-light text-left p-4 rounded-lg text-xs overflow-auto max-h-40 mb-6 text-red-700 border border-red-100 font-mono">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-deep hover:bg-emerald-deep/90 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-soft"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

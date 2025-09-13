import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Update state with error details
    this.setState({ error, errorInfo });
    
    // Force garbage collection if available to clean up memory
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        console.warn('Failed to trigger garbage collection:', e);
      }
    }
    
    // Clear any active downloads or processes that might be consuming memory
    this.emergencyCleanup();
  }

  emergencyCleanup = () => {
    try {
      // Clear any active file readers
      if (typeof FileReader !== 'undefined') {
        // Force cleanup of any active file operations
        const event = new CustomEvent('emergency-cleanup');
        window.dispatchEvent(event);
      }
      
      // Clear any pending timeouts/intervals
      const highestTimeoutId = window.setTimeout(function(){}, 1);
      for (let i = 0; i < highestTimeoutId; i++) {
        window.clearTimeout(i);
        window.clearInterval(i);
      }
      
      // Clear caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        }).catch(e => console.warn('Cache cleanup failed:', e));
      }
      
    } catch (e) {
      console.warn('Emergency cleanup failed:', e);
    }
  };

  handleRetry = () => {
    // Reset error state to try rendering the component again
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Additional cleanup before retry
    this.emergencyCleanup();
  };

  handleReload = () => {
    // Force a hard reload to clear all memory and state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="h-full w-full flex items-center justify-center p-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <Card className="max-w-md w-full border-red-200 dark:border-red-800">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-6 w-6" />
                <span>Something went wrong</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                An error occurred that prevented the page from working correctly.
                This often happens when processing large files or many files at once.
              </p>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={this.handleRetry}
                  variant="outline"
                  className="w-full"
                  data-testid="button-error-retry"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button 
                  onClick={this.handleReload}
                  variant="default"
                  className="w-full"
                  data-testid="button-error-reload"
                >
                  Reload Page
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded mt-4">
                  <summary className="cursor-pointer font-medium">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Global error handler for unhandled promise rejections
export const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Prevent default behavior (which would show browser error)
    event.preventDefault();
    
    // Try to trigger garbage collection
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        console.warn('Failed to trigger GC after unhandled rejection:', e);
      }
    }
    
    // Show user-friendly error instead of crashing
    const customEvent = new CustomEvent('app-error', {
      detail: {
        type: 'promise-rejection',
        message: event.reason?.message || 'An unexpected error occurred',
        error: event.reason
      }
    });
    window.dispatchEvent(customEvent);
  });

  // Handle generic window errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Try to trigger garbage collection
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        console.warn('Failed to trigger GC after global error:', e);
      }
    }
    
    // Prevent default error handling that might crash the page
    event.preventDefault();
    
    const customEvent = new CustomEvent('app-error', {
      detail: {
        type: 'javascript-error',
        message: event.error?.message || event.message || 'A JavaScript error occurred',
        error: event.error
      }
    });
    window.dispatchEvent(customEvent);
  });
};
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-background text-foreground p-4">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-w-full">
            {this.state.error.toString()}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-w-full mt-2">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

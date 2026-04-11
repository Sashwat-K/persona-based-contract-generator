import React from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { Renew, WarningAlt, Copy, Checkmark } from '@carbon/icons-react';

/**
 * ErrorBoundary Component
 * Catches React component errors and displays user-friendly error messages
 * Provides recovery options and logs errors for debugging
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Send error to logging service (if configured)
    if (window.electron?.logError) {
      window.electron.logError({
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      ``,
      `Error: ${error?.toString() || 'Unknown error'}`,
      ``,
      `Stack Trace:`,
      error?.stack || 'N/A',
      ``,
      `Component Stack:`,
      errorInfo?.componentStack || 'N/A'
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount, copied } = this.state;
      const { fallback } = this.props;

      // If custom fallback provided, use it
      if (fallback) {
        return fallback({ error, errorInfo, reset: this.handleReset });
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <div className="error-boundary__header">
              <WarningAlt size={64} className="error-boundary__icon" />
              <h1 className="error-boundary__title">
                Something went wrong
              </h1>
              <p className="error-boundary__copy">
                The application encountered an unexpected error. Please try again.
              </p>
            </div>

            <InlineNotification
              kind="error"
              title="Error Details"
              subtitle={error?.toString() || 'Unknown error'}
              lowContrast
              hideCloseButton
              className="error-boundary__notification"
            />

            {errorInfo && (
              <details className="error-boundary__details">
                <summary className="error-boundary__summary">
                  Component Stack Trace
                </summary>
                <pre className="error-boundary__stack">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="error-boundary__actions">
              <Button
                kind="primary"
                renderIcon={Renew}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                kind="secondary"
                onClick={this.handleReload}
              >
                Reload Application
              </Button>
              <Button
                kind="ghost"
                renderIcon={copied ? Checkmark : Copy}
                onClick={this.handleCopyError}
              >
                {copied ? 'Copied!' : 'Copy Error for Bug Report'}
              </Button>
            </div>

            {errorCount > 2 && (
              <InlineNotification
                kind="warning"
                title="Persistent Error"
                subtitle="This error has occurred multiple times. Please contact support if the issue persists."
                lowContrast
                hideCloseButton
                className="error-boundary__persistent"
              />
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


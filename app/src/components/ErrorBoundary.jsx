import React from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { Renew, WarningAlt } from '@carbon/icons-react';

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
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state;
      const { fallback } = this.props;

      // If custom fallback provided, use it
      if (fallback) {
        return fallback({ error, errorInfo, reset: this.handleReset });
      }

      // Default error UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: 'var(--cds-background)'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              <WarningAlt size={64} style={{ color: 'var(--cds-support-error)' }} />
              <h1 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                Something went wrong
              </h1>
              <p style={{ color: 'var(--cds-text-secondary)' }}>
                The application encountered an unexpected error. Please try again.
              </p>
            </div>

            <InlineNotification
              kind="error"
              title="Error Details"
              subtitle={error?.toString() || 'Unknown error'}
              lowContrast
              hideCloseButton
              style={{ marginBottom: '2rem' }}
            />

            {process.env.NODE_ENV === 'development' && errorInfo && (
              <details style={{
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: 'var(--cds-layer-01)',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Component Stack Trace
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  color: 'var(--cds-text-secondary)'
                }}>
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
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
            </div>

            {errorCount > 2 && (
              <InlineNotification
                kind="warning"
                title="Persistent Error"
                subtitle="This error has occurred multiple times. Please contact support if the issue persists."
                lowContrast
                hideCloseButton
                style={{ marginTop: '2rem' }}
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



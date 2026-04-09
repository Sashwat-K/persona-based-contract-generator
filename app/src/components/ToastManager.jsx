import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastNotification } from '@carbon/react';

/**
 * ToastManager Component
 * Provides a global toast notification system
 * Supports success, error, warning, and info notifications with auto-dismiss
 */

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      kind: 'info',
      timeout: 5000,
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after timeout
    if (newToast.timeout > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.timeout);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((title, subtitle, options = {}) => {
    return addToast({
      kind: 'success',
      title,
      subtitle,
      ...options
    });
  }, [addToast]);

  const showError = useCallback((title, subtitle, options = {}) => {
    return addToast({
      kind: 'error',
      title,
      subtitle,
      timeout: 0, // Errors don't auto-dismiss by default
      ...options
    });
  }, [addToast]);

  const showWarning = useCallback((title, subtitle, options = {}) => {
    return addToast({
      kind: 'warning',
      title,
      subtitle,
      ...options
    });
  }, [addToast]);

  const showInfo = useCallback((title, subtitle, options = {}) => {
    return addToast({
      kind: 'info',
      title,
      subtitle,
      ...options
    });
  }, [addToast]);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
    addToast,
    removeToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '5rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '400px',
        width: '100%'
      }}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          kind={toast.kind}
          title={toast.title}
          subtitle={toast.subtitle}
          caption={toast.caption}
          lowContrast={toast.lowContrast}
          hideCloseButton={toast.hideCloseButton}
          onClose={() => onClose(toast.id)}
          timeout={toast.timeout}
          style={{
            minWidth: '100%',
            marginBottom: 0
          }}
        />
      ))}
    </div>
  );
};

export default ToastProvider;



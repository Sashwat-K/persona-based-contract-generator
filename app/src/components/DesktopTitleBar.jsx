import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@carbon/react';
import HyperProtectIcon from './HyperProtectIcon';
import apiClient from '../services/apiClient';

const CONNECTION_POLL_INTERVAL_MS = 15000;
const CONNECTION_TIMEOUT_MS = 5000;

const normalizeServerUrl = (value = '') => value.trim().replace(/\/+$/, '');

const DesktopTitleBar = ({
  title = 'IBM CC Contract Builder',
  zIndex = 10000,
  showConnectionStatus = false,
  enableConnectionWatcher = false
}) => {
  const zIndexClass = zIndex >= 10000
    ? 'desktop-titlebar--z-top'
    : 'desktop-titlebar--z-base';
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
  const [connectionStatus, setConnectionStatus] = useState(showConnectionStatus ? 'checking' : 'unknown');
  const [connectionError, setConnectionError] = useState('');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutDetails, setAboutDetails] = useState(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutError, setAboutError] = useState('');
  const hasSeenOnline = useRef(false);

  const getServerUrl = useCallback(() => {
    const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('server_url') : '';
    const clientUrl = apiClient.getBaseURL?.() || '';
    return normalizeServerUrl(storedUrl || clientUrl || 'http://localhost:8080');
  }, []);

  const checkConnection = useCallback(async ({ forceModal = false } = {}) => {
    if (!showConnectionStatus) return true;

    const serverUrl = getServerUrl();
    if (!serverUrl) {
      setConnectionStatus('offline');
      setConnectionError('Server URL is not configured.');
      if (enableConnectionWatcher && (forceModal || hasSeenOnline.current)) {
        setShowConnectionModal(true);
      }
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Health endpoint returned HTTP ${response.status}.`);
      }

      clearTimeout(timeoutId);
      hasSeenOnline.current = true;
      setConnectionStatus('online');
      setConnectionError('');
      if (enableConnectionWatcher) {
        setShowConnectionModal(false);
      }
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err.name === 'AbortError'
        ? `Connection test timed out for ${serverUrl}.`
        : `Cannot reach ${serverUrl}. ${err.message || 'Server may be unavailable.'}`;
      setConnectionStatus('offline');
      setConnectionError(message);
      if (enableConnectionWatcher && (forceModal || hasSeenOnline.current)) {
        setShowConnectionModal(true);
      }
      return false;
    }
  }, [enableConnectionWatcher, getServerUrl, showConnectionStatus]);

  useEffect(() => {
    if (!showConnectionStatus) return undefined;

    checkConnection({ forceModal: false });
    if (!enableConnectionWatcher) return undefined;

    const pollId = window.setInterval(() => {
      checkConnection({ forceModal: false });
    }, CONNECTION_POLL_INTERVAL_MS);

    const handleFocus = () => {
      checkConnection({ forceModal: false });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkConnection({ forceModal: false });
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkConnection, enableConnectionWatcher, showConnectionStatus]);

  const statusMeta = {
    checking: { label: 'Checking', className: 'desktop-titlebar__status--checking' },
    online: { label: 'Connected', className: 'desktop-titlebar__status--online' },
    offline: { label: 'Disconnected', className: 'desktop-titlebar__status--offline' },
    unknown: { label: 'Unknown', className: 'desktop-titlebar__status--checking' }
  }[connectionStatus] || { label: 'Unknown', className: 'desktop-titlebar__status--checking' };

  const handleRetryConnection = async () => {
    if (isRetryingConnection) return;
    setIsRetryingConnection(true);
    const isHealthy = await checkConnection({ forceModal: true });
    if (isHealthy) {
      setShowConnectionModal(false);
    }
    setIsRetryingConnection(false);
  };

  const handleCloseApp = () => {
    if (window.electron?.closeWindow) {
      window.electron.closeWindow();
      return;
    }
    window.close();
  };

  const loadAboutDetails = useCallback(async () => {
    if (aboutLoading) return;

    if (!window.electron?.appInfo?.getClientToolInfo) {
      setAboutDetails(null);
      setAboutError('Client tool info API is unavailable. Restart the app to load the latest client bridge.');
      return;
    }

    try {
      setAboutLoading(true);
      setAboutError('');
      const details = await window.electron.appInfo.getClientToolInfo();
      setAboutDetails(details);
    } catch (error) {
      setAboutDetails(null);
      setAboutError(error?.message || 'Failed to fetch client tool details.');
    } finally {
      setAboutLoading(false);
    }
  }, [aboutLoading]);

  const handleOpenAbout = async () => {
    setShowAboutModal(true);
    await loadAboutDetails();
  };

  return (
    <>
      <div className={`desktop-titlebar ${zIndexClass}${isMac ? ' desktop-titlebar--mac' : ''}`}>
        <div className="desktop-titlebar__brand" aria-hidden="true" />
        <div className="desktop-titlebar__center">
          <HyperProtectIcon size={18} />
          <button
            type="button"
            className="desktop-titlebar__title-button"
            onClick={handleOpenAbout}
            title="View client tool information"
          >
            <span className="desktop-titlebar__title">{title}</span>
          </button>
        </div>

        <div className="desktop-titlebar__right">
          {showConnectionStatus && (
            <div
              className={`desktop-titlebar__status ${statusMeta.className}`}
              title={connectionError || `Server status: ${statusMeta.label}`}
            >
              <span className="desktop-titlebar__status-dot" />
              <span className="desktop-titlebar__status-label">{statusMeta.label}</span>
            </div>
          )}

          <div className="desktop-window-controls">
            <button
              className="desktop-window-btn"
              onClick={() => window.electron?.minimizeWindow?.()}
              title="Minimize"
              type="button"
              aria-label="Minimize window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <button
              className="desktop-window-btn"
              onClick={() => window.electron?.maximizeWindow?.()}
              title="Maximize"
              type="button"
              aria-label="Maximize window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1" />
              </svg>
            </button>

            <button
              className="desktop-window-btn desktop-window-btn--close"
              onClick={() => window.electron?.closeWindow?.()}
              title="Close"
              type="button"
              aria-label="Close window"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={showConnectionModal}
        danger
        modalHeading="Connection Lost"
        primaryButtonText="Close App"
        secondaryButtonText={isRetryingConnection ? 'Retrying...' : 'Retry'}
        onRequestSubmit={handleCloseApp}
        onSecondarySubmit={handleRetryConnection}
        onRequestClose={() => {}}
        preventCloseOnClickOutside
        primaryButtonDisabled={isRetryingConnection}
      >
        <p className="desktop-titlebar__connection-modal-copy">
          The app lost connectivity to the backend server.
        </p>
        <p className="desktop-titlebar__connection-modal-copy desktop-titlebar__connection-modal-copy--muted">
          {connectionError || `Unable to reach ${getServerUrl()}.`}
        </p>
      </Modal>

      <Modal
        open={showAboutModal}
        modalHeading="About IBM CC Contract Builder"
        primaryButtonText="Close"
        secondaryButtonText={aboutLoading ? 'Refreshing...' : 'Refresh'}
        onRequestSubmit={() => setShowAboutModal(false)}
        onSecondarySubmit={loadAboutDetails}
        onRequestClose={() => setShowAboutModal(false)}
      >
        <div className="desktop-titlebar__about">
          {aboutLoading && <p className="desktop-titlebar__about-loading">Loading client details...</p>}
          {aboutError && <p className="desktop-titlebar__about-error">{aboutError}</p>}

          {aboutDetails && (
            <>
              <section className="desktop-titlebar__about-section">
                <h4>Application</h4>
                <div className="desktop-titlebar__about-grid">
                  <span>Name</span>
                  <span>{aboutDetails.app?.name || title}</span>
                  <span>Version</span>
                  <span>{aboutDetails.app?.version || 'Unknown'}</span>
                  <span>Electron</span>
                  <span>{aboutDetails.app?.electron || 'Unknown'}</span>
                  <span>Chromium</span>
                  <span>{aboutDetails.app?.chromium || 'Unknown'}</span>
                  <span>Node.js</span>
                  <span>{aboutDetails.app?.node || 'Unknown'}</span>
                  <span>Platform</span>
                  <span>{aboutDetails.app?.platform || 'Unknown'}</span>
                </div>
              </section>

              <section className="desktop-titlebar__about-section">
                <h4>contract-cli</h4>
                <div className="desktop-titlebar__about-grid">
                  <span>Status</span>
                  <span>{aboutDetails.contractCli?.installed ? 'Installed' : 'Not detected'}</span>
                  <span>Version</span>
                  <span>{aboutDetails.contractCli?.version || 'Unknown'}</span>
                  <span>Command</span>
                  <span>{aboutDetails.contractCli?.command || 'contract-cli --version'}</span>
                  <span>Details</span>
                  <span>{aboutDetails.contractCli?.details || 'No details available'}</span>
                </div>
              </section>

              <section className="desktop-titlebar__about-section">
                <h4>OpenSSL</h4>
                <div className="desktop-titlebar__about-grid">
                  <span>Status</span>
                  <span>{aboutDetails.openssl?.installed ? 'Installed' : 'Not detected'}</span>
                  <span>Version</span>
                  <span>{aboutDetails.openssl?.version || 'Unknown'}</span>
                  <span>Command</span>
                  <span>{aboutDetails.openssl?.command || 'openssl version'}</span>
                  <span>Details</span>
                  <span>{aboutDetails.openssl?.details || 'No details available'}</span>
                </div>
              </section>

              <p className="desktop-titlebar__about-checked-at">
                Last checked: {aboutDetails.checkedAt || 'Unknown'}
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default DesktopTitleBar;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@carbon/react';
import HyperProtectIcon from './HyperProtectIcon';
import apiClient from '../services/apiClient';

const CONNECTION_POLL_INTERVAL_MS = 15000;
const CONNECTION_TIMEOUT_MS = 5000;

const normalizeServerUrl = (value = '') => value.trim().replace(/\/+$/, '');
const extractVersionToken = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';

  const semanticMatch = raw.match(/\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/);
  if (semanticMatch?.[0]) return semanticMatch[0];

  return raw.split(/\s+/)[0] || raw;
};

const normalizeContractCliVersion = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';

  const match = raw.match(/^contract-cli\s+version\s+(.+)$/i);
  if (match?.[1]) return extractVersionToken(match[1]);

  return extractVersionToken(raw);
};

const normalizeOpenSSLVersion = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';

  const match = raw.match(/^openssl\s+([^\s]+)/i);
  if (match?.[1]) return match[1].trim();

  const parts = raw.split(/\s+/);
  if (parts.length >= 2) return parts[1];
  return raw;
};

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
  const [connectionLatencyMs, setConnectionLatencyMs] = useState(null);
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
    const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

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

      const endedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      const latency = Math.max(0, Math.round(endedAt - startedAt));

      clearTimeout(timeoutId);
      hasSeenOnline.current = true;
      setConnectionStatus('online');
      setConnectionLatencyMs(latency);
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
      setConnectionLatencyMs(null);
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

    try {
      setAboutLoading(true);
      setAboutError('');
      
      // Fetch client (Electron) details
      let clientDetails = null;
      if (window.electron?.appInfo?.getClientToolInfo) {
        try {
          clientDetails = await window.electron.appInfo.getClientToolInfo();
        } catch (err) {
          console.warn('Failed to fetch client tool info:', err);
        }
      }
      
      // Fetch backend details from /about API
      let backendDetails = null;
      try {
        const serverUrl = getServerUrl();
        const response = await fetch(`${serverUrl}/about`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (response.ok) {
          backendDetails = await response.json();
        }
      } catch (err) {
        console.warn('Failed to fetch backend info:', err);
      }
      
      setAboutDetails({
        client: clientDetails,
        backend: backendDetails
      });
    } catch (error) {
      setAboutDetails(null);
      setAboutError(error?.message || 'Failed to fetch version details.');
    } finally {
      setAboutLoading(false);
    }
  }, [aboutLoading, getServerUrl]);

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
              title={
                connectionError
                  ? connectionError
                  : `Server status: ${statusMeta.label}${connectionStatus === 'online' && connectionLatencyMs !== null ? ` (${connectionLatencyMs} ms)` : ''}`
              }
            >
              <span className="desktop-titlebar__status-dot" />
              <span className="desktop-titlebar__status-label">{statusMeta.label}</span>
              {connectionStatus === 'online' && connectionLatencyMs !== null && (
                <span className="desktop-titlebar__status-latency">{connectionLatencyMs} ms</span>
              )}
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
          {aboutLoading && <p className="desktop-titlebar__about-loading">Loading version details...</p>}
          {aboutError && <p className="desktop-titlebar__about-error">{aboutError}</p>}

          {aboutDetails && (
            <>
              {/* App Section */}
              <section className="desktop-titlebar__about-section">
                <h4>App</h4>
                <div className="desktop-titlebar__about-grid">
                  <span>Name</span>
                  <span>{aboutDetails.client?.app?.name || title}</span>
                  <span>Version</span>
                  <span>{aboutDetails.client?.app?.version || aboutDetails.backend?.app?.version || '1.0.0'}</span>
                  {aboutDetails.client?.app?.electron && (
                    <>
                      <span>Electron</span>
                      <span>{aboutDetails.client.app.electron}</span>
                    </>
                  )}
                  {aboutDetails.client?.app?.chromium && (
                    <>
                      <span>Chromium</span>
                      <span>{aboutDetails.client.app.chromium}</span>
                    </>
                  )}
                  {aboutDetails.client?.app?.node && (
                    <>
                      <span>Node.js</span>
                      <span>{aboutDetails.client.app.node}</span>
                    </>
                  )}
                  {aboutDetails.client?.app?.platform && (
                    <>
                      <span>Platform</span>
                      <span>{aboutDetails.client.app.platform}</span>
                    </>
                  )}
                </div>
              </section>

              {/* Backend Section */}
              {aboutDetails.backend && (
                <section className="desktop-titlebar__about-section">
                  <h4>Backend</h4>
                  <div className="desktop-titlebar__about-grid">
                    <span>Version</span>
                    <span>{aboutDetails.backend.backend?.version || 'Unknown'}</span>
                    <span>contract-go Version</span>
                    <span>{aboutDetails.backend.backend?.contract_go_version || 'Unknown'}</span>
                    <span>OpenSSL Version</span>
                    <span>{aboutDetails.backend.backend?.openssl_version || 'Unknown'}</span>
                    <span>Go Version</span>
                    <span>{aboutDetails.backend.backend?.go_version || 'Unknown'}</span>
                    <span>Platform</span>
                    <span>{aboutDetails.backend.backend?.platform || 'Unknown'}</span>
                  </div>
                </section>
              )}

              {aboutDetails.client?.checkedAt && (
                <p className="desktop-titlebar__about-checked-at">
                  Last checked: {aboutDetails.client.checkedAt}
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default DesktopTitleBar;

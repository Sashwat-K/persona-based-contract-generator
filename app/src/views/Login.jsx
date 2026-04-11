import React, { useState, useEffect } from 'react';
import {
  Form,
  TextInput,
  PasswordInput,
  Button,
  Theme,
  InlineNotification,
  Tile,
  Checkbox,
  Loading,
  Tag,
  Modal
} from '@carbon/react';
import { LogoGithub, Document, WarningAlt, Settings, CheckmarkFilled, ErrorFilled, Renew } from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import authService from '../services/authService';
import apiClient from '../services/apiClient';
import HyperProtectIcon from '../components/HyperProtectIcon';
import DesktopTitleBar from '../components/DesktopTitleBar';
import { getPrimaryRole } from '../utils/roles';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState('http://localhost:8080');
  const [lastTestedUrl, setLastTestedUrl] = useState('');
  const [lastTestPassed, setLastTestPassed] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [error, setError] = useState('');

  // Server status
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);

  const { setAuth } = useAuthStore();
  const setServerUrl = useConfigStore((state) => state.setServerUrl);

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      setUsername(rememberedEmail);
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    // Get server URL from localStorage or use default
    const savedUrl = localStorage.getItem('server_url') || 'http://localhost:8080';
    setTempServerUrl(savedUrl);

    // Check server status on mount
    checkServerStatus(savedUrl);
  }, []);

  const formatLogTimestamp = () => new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const appendConnectionLog = (line) => {
    const timestamp = formatLogTimestamp();
    setConnectionLogs((previous) => {
      const next = [...previous, `[${timestamp}] ${line}`];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  };

  const normalizeServerUrl = (value) => value.trim().replace(/\/+$/, '');

  const validateServerUrlInput = (value) => {
    const normalizedUrl = normalizeServerUrl(value);
    if (!normalizedUrl) {
      return { valid: false, error: 'Server URL cannot be empty' };
    }

    try {
      const urlObj = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Server URL must use HTTP or HTTPS protocol' };
      }
    } catch (_err) {
      return {
        valid: false,
        error: 'Invalid URL format. Please enter a valid URL (e.g., http://localhost:8080)'
      };
    }

    return { valid: true, url: normalizedUrl };
  };

  const runServerHealthCheck = async (url, { withLogs = false } = {}) => {
    const healthUrl = `${url}/health`;
    const startedAt = Date.now();

    if (withLogs) {
      appendConnectionLog(`Testing connectivity: GET ${healthUrl}`);
    }

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000)
      });

      const latency = Date.now() - startedAt;
      if (withLogs) {
        appendConnectionLog(`Received HTTP ${response.status} in ${latency} ms`);
      }

      if (!response.ok) {
        return {
          ok: false,
          message: `Server returned status ${response.status}. Please check the URL.`
        };
      }

      let payload = {};
      try {
        payload = await response.json();
      } catch (_err) {
        payload = {};
      }

      if (withLogs) {
        appendConnectionLog(`Connection test passed. Reported version: ${payload.version || 'Unknown'}`);
      }

      return { ok: true, payload };
    } catch (err) {
      if (withLogs) {
        appendConnectionLog(`Connection test failed: ${err.message}`);
      }
      return {
        ok: false,
        message: `Cannot reach server at ${url}. Please verify the URL and ensure the server is running.`
      };
    }
  };

  const checkServerStatus = async (url) => {
    const validation = validateServerUrlInput(url);
    if (!validation.valid) {
      setServerStatus('offline');
      setServerVersion(null);
      return;
    }

    setIsCheckingServer(true);
    setServerStatus('checking');

    try {
      const result = await runServerHealthCheck(validation.url);
      if (result.ok) {
        setServerStatus('online');
        setServerVersion(result.payload?.version || 'Unknown');
      } else {
        setServerStatus('offline');
        setServerVersion(null);
      }
    } catch (err) {
      console.error('Server health check failed:', err);
      setServerStatus('offline');
      setServerVersion(null);
    } finally {
      setIsCheckingServer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      // Call real backend API
      const response = await authService.login(username, password);

      // Store auth in Zustand store
      setAuth(response.user, response.token);

      // Persist auth to localStorage so App.jsx can read role/email on re-render
      localStorage.setItem('auth_token', response.token);
      const allRoles = response.user.roles || [];
      const primaryRole = getPrimaryRole(allRoles);
      localStorage.setItem('user_role', primaryRole);
      localStorage.setItem('user_roles', JSON.stringify(allRoles));
      localStorage.setItem('user_email', response.user.email);

      // Handle remember email
      if (rememberEmail) {
        localStorage.setItem('remembered_email', username);
      } else {
        localStorage.removeItem('remembered_email');
      }

      // Notify parent component
      onLogin(true);

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openServerConfigModal = () => {
    const savedUrl = localStorage.getItem('server_url') || 'http://localhost:8080';
    setTempServerUrl(savedUrl);
    setLastTestedUrl('');
    setLastTestPassed(false);
    setConnectionLogs([`[${formatLogTimestamp()}] Opened server configuration dialog.`]);
    setError('');
    setShowServerConfig(true);
  };

  const closeServerConfigModal = () => {
    setShowServerConfig(false);
    setTempServerUrl(localStorage.getItem('server_url') || 'http://localhost:8080');
    setLastTestedUrl('');
    setLastTestPassed(false);
    setConnectionLogs([]);
    setError('');
  };

  const handleTestServerConnection = async () => {
    const validation = validateServerUrlInput(tempServerUrl);
    if (!validation.valid) {
      setLastTestPassed(false);
      setLastTestedUrl('');
      setError(validation.error);
      appendConnectionLog(`Validation error: ${validation.error}`);
      return;
    }

    setError('');
    setLastTestPassed(false);
    setLastTestedUrl(validation.url);
    setIsCheckingServer(true);

    appendConnectionLog(`Running test for ${validation.url}`);
    const result = await runServerHealthCheck(validation.url, { withLogs: true });

    if (result.ok) {
      setLastTestPassed(true);
      setServerStatus('online');
      setServerVersion(result.payload?.version || 'Unknown');
      appendConnectionLog('Test finished successfully.');
    } else {
      setLastTestPassed(false);
      setServerStatus('offline');
      setServerVersion(null);
      setError(result.message);
      appendConnectionLog('Test finished with errors.');
    }

    setIsCheckingServer(false);
  };

  const handleSaveServerUrl = () => {
    const validation = validateServerUrlInput(tempServerUrl);
    if (!validation.valid) {
      setError(validation.error);
      appendConnectionLog(`Save blocked: ${validation.error}`);
      return;
    }

    if (!lastTestPassed || lastTestedUrl !== validation.url) {
      const validationMessage = 'Run Test Connection successfully before saving this server URL.';
      setError(validationMessage);
      appendConnectionLog(`Save blocked: ${validationMessage}`);
      return;
    }

    localStorage.setItem('server_url', validation.url);
    setServerUrl(validation.url);
    apiClient.setBaseURL(validation.url);
    setServerStatus('online');
    appendConnectionLog(`Saved server URL: ${validation.url}`);
    setShowServerConfig(false);
    setError('');
  };

  // Function to open links in external browser
  const openExternalLink = (url) => {
    if (window.electron?.shell) {
      window.electron.shell.openExternal(url);
    } else {
      // Fallback for development
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Theme theme="g100">
      <DesktopTitleBar
        zIndex={9999}
        showConnectionStatus
      />

      <div className="login-page">
        {/* Left Section - Login Card */}
        <div className="login-page__left">
          <div className="login-page__left-content">
            {/* Logo/Icon */}
            <div className="login-logo">
              <HyperProtectIcon size={48} />
            </div>

            {/* Title */}
            <h1 className="login-section-title">
              Log in to <strong>IBM Confidential Computing Contract Generator</strong>
            </h1>

            <p className="login-section-subtitle">
              Don't have an account? Contact system administrator
            </p>

            {/* Login Card */}
            <Tile className="login-card">
              {isLoggingIn ? (
                <div className="login-loading">
                  <Loading description="Authenticating..." withOverlay={false} />
                  <p className="login-loading__text">
                    Connecting to backend server...
                  </p>
                </div>
              ) : (
                <Form onSubmit={handleSubmit}>
                  {error && !showServerConfig && (
                    <div className="login-form-group">
                      <InlineNotification
                        kind="error"
                        title="Login Failed"
                        subtitle={error}
                        hideCloseButton={false}
                        onCloseButtonClick={() => setError('')}
                      />
                    </div>
                  )}

                  <div className="login-form-group">
                    <TextInput
                      id="login-username"
                      labelText="Email"
                      placeholder="username@example.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="login-form-group">
                    <PasswordInput
                      id="login-password"
                      labelText="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="login-form-group login-form-group--spacious">
                    <Checkbox
                      id="remember-email"
                      labelText="Remember email"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                    />
                  </div>

                  <Button type="submit" size="lg" className="login-submit-button">
                    Continue
                  </Button>

                  <div className="login-help-text">
                    <span>
                      Forgot password? Contact system administrator
                    </span>
                  </div>
                </Form>
              )}
            </Tile>

            {/* Server Configuration Card */}
            <Tile className="login-server-card">
              <div className="login-server-card__header">
                <div className="login-server-card__details">
                  <div className="login-server-card__status-row">
                    <span className="login-server-card__label">
                      Server Configuration
                    </span>
                    <div className="login-server-card__tag">
                      {isCheckingServer ? (
                        <Tag type="gray" size="sm">Checking...</Tag>
                      ) : serverStatus === 'online' ? (
                        <Tag type="green" size="sm" renderIcon={CheckmarkFilled}>Online</Tag>
                      ) : serverStatus === 'offline' ? (
                        <Tag type="red" size="sm" renderIcon={ErrorFilled}>Offline</Tag>
                      ) : null}
                    </div>
                  </div>
                  <div className="login-server-card__url">
                    {tempServerUrl}
                  </div>
                  {serverVersion && (
                    <div className="login-server-card__version">
                      Version: {serverVersion}
                    </div>
                  )}
                </div>
                <div className="login-server-card__actions">
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Renew}
                    onClick={() => checkServerStatus(tempServerUrl)}
                    disabled={isCheckingServer}
                    iconDescription="Refresh status"
                    hasIconOnly
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Settings}
                    onClick={openServerConfigModal}
                  >
                    Change
                  </Button>
                </div>
              </div>
            </Tile>
          </div>

          <Modal
            open={showServerConfig}
            modalHeading="Server Configuration"
            primaryButtonText="Save"
            secondaryButtonText="Cancel"
            onRequestSubmit={handleSaveServerUrl}
            onRequestClose={closeServerConfigModal}
            onSecondarySubmit={closeServerConfigModal}
            primaryButtonDisabled={
              isCheckingServer ||
              !lastTestPassed ||
              normalizeServerUrl(tempServerUrl) !== lastTestedUrl
            }
            size="md"
          >
            <div className="login-server-modal">
              {error && (
                <div className="login-form-group">
                  <InlineNotification
                    kind="error"
                    title="Configuration Error"
                    subtitle={error}
                    hideCloseButton={false}
                    onCloseButtonClick={() => setError('')}
                    lowContrast
                  />
                </div>
              )}

              <div className="login-form-group">
                <TextInput
                  id="server-url"
                  labelText="Server URL"
                  placeholder="http://localhost:8080"
                  value={tempServerUrl}
                  onChange={(e) => {
                    setTempServerUrl(e.target.value);
                    setLastTestPassed(false);
                  }}
                  helperText="Enter the backend API server URL"
                />
              </div>

              <div className="login-server-modal__actions">
                <Button
                  kind="secondary"
                  size="sm"
                  onClick={handleTestServerConnection}
                  disabled={isCheckingServer || !tempServerUrl.trim()}
                >
                  {isCheckingServer ? 'Testing...' : 'Test Connection'}
                </Button>
                {lastTestPassed && (
                  <Tag type="green" size="sm" renderIcon={CheckmarkFilled}>
                    Test Passed
                  </Tag>
                )}
              </div>

              <div className="login-server-terminal" role="log" aria-live="polite">
                <div className="login-server-terminal__header">Connection Test Log</div>
                <pre className="login-server-terminal__content">
                  {connectionLogs.length > 0 ? connectionLogs.join('\n') : 'No logs yet. Run a connection test.'}
                </pre>
              </div>
            </div>
          </Modal>

          {/* Footer */}
          <footer className="login-footer">
            Powered by IBM Confidential Computing
          </footer>
        </div>

        {/* Right Section - Information Panel */}
        <div className="login-page__right">
          <div className="login-page__right-content">
            {/* Main Heading */}
            <h2 className="login-right-title">
              IBM Confidential Computing Contract Generator
            </h2>

            <p className="login-right-powered-by">
              Powered by IBM Confidential Computing Team
            </p>

            <p className="login-right-description">
              A collaborative desktop application for building secure, auditable contracts for confidential computing workloads with multi-party collaboration and cryptographic verification.
            </p>

            {/* Features */}
            <div className="login-feature-list">
              <div className="login-feature-item">
                <HyperProtectIcon size={24} className="login-feature-icon" />
                <div>
                  <h4 className="login-feature-title">
                    Multi-Persona Workflow
                  </h4>
                  <p className="login-feature-description">
                    Six distinct roles (Admin, Solution Provider, Data Owner, Auditor, Environment Operator, Viewer) ensure proper separation of duties and secure collaboration.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#multi-persona-workflow');
                    }}
                    className="login-inline-link"
                  >
                    Learn more →
                  </a>
                </div>
              </div>

              <div className="login-feature-item">
                <Document size={24} className="login-feature-icon" />
                <div>
                  <h4 className="login-feature-title">
                    Cryptographic Security
                  </h4>
                  <p className="login-feature-description">
                    RSA-4096 key pairs, AES-256-GCM encryption, and SHA-256 hashing protect sensitive workload configurations and environment data throughout the build process.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#cryptographic-security');
                    }}
                    className="login-inline-link"
                  >
                    Learn more →
                  </a>
                </div>
              </div>

              <div className="login-feature-item login-feature-item--last">
                <WarningAlt size={24} className="login-feature-icon" />
                <div>
                  <h4 className="login-feature-title">
                    Immutable Audit Trail
                  </h4>
                  <p className="login-feature-description">
                    Every action is cryptographically signed and chained with SHA-256 hashes, creating a tamper-proof, verifiable record of all contract modifications.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#audit-trail');
                    }}
                    className="login-inline-link"
                  >
                    Learn more →
                  </a>
                </div>
              </div>
            </div>

            {/* Version and Links */}
            <div className="login-info-card">
              <div className="login-info-card__version">
                <strong className="login-info-card__version-label">Version:</strong> 1.0.0-beta
              </div>

              <div className="login-info-card__links">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator/blob/main/README.md');
                  }}
                  className="login-link"
                >
                  <Document size={16} />
                  Documentation
                </a>

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator/issues');
                  }}
                  className="login-link"
                >
                  <WarningAlt size={16} />
                  Report Issues
                </a>

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator');
                  }}
                  className="login-link"
                >
                  <LogoGithub size={16} />
                  GitHub Repository
                </a>
              </div>
            </div>

            {/* Additional Info */}
            <div className="login-dev-note">
              <strong className="login-dev-note__label">Note:</strong> This is a development build.
              For production deployment, ensure all security configurations are properly set and reviewed by your security team.
            </div>
          </div>
        </div>
      </div>
    </Theme>
  );
};

export default Login;

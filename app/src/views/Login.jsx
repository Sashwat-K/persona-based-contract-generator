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
  Tag
} from '@carbon/react';
import { LogoGithub, Document, WarningAlt, Settings, CheckmarkFilled, ErrorFilled, Renew } from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import apiClient from '../services/apiClient';
import HyperProtectIcon from '../components/HyperProtectIcon';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState('http://localhost:8080');
  const [error, setError] = useState('');
  
  // Server status
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  
  const { setAuth } = useAuthStore();
  
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
  
  const checkServerStatus = async (url) => {
    setIsCheckingServer(true);
    setServerStatus('checking');
    
    try {
      // Try to reach the health endpoint with proper CORS handling
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        setServerStatus('online');
        setServerVersion(data.version || 'Unknown');
        console.log('Server health check successful:', data);
      } else {
        console.warn('Server returned non-OK status:', response.status);
        setServerStatus('offline');
        setServerVersion(null);
      }
    } catch (err) {
      console.error('Server health check failed:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        url: `${url}/health`
      });
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

  const handleServerUrlChange = async () => {
    const newUrl = tempServerUrl.trim();
    
    if (!newUrl) {
      setError('Server URL cannot be empty');
      return;
    }
    
    // Validate URL format
    try {
      const urlObj = new URL(newUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setError('Server URL must use HTTP or HTTPS protocol');
        return;
      }
    } catch (err) {
      setError('Invalid URL format. Please enter a valid URL (e.g., http://localhost:8080)');
      return;
    }
    
    // Check if server is reachable before applying
    setIsCheckingServer(true);
    setError('');
    
    try {
      const response = await fetch(`${newUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        // Server is reachable, apply the change
        localStorage.setItem('server_url', newUrl);
        apiClient.defaults.baseURL = newUrl;
        setServerStatus('online');
        setShowServerConfig(false);
        
        const data = await response.json();
        setServerVersion(data.version || 'Unknown');
      } else {
        setError(`Server returned status ${response.status}. Please check the URL.`);
        setServerStatus('offline');
      }
    } catch (err) {
      setError(`Cannot reach server at ${newUrl}. Please verify the URL and ensure the server is running.`);
      setServerStatus('offline');
    } finally {
      setIsCheckingServer(false);
    }
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
      {/* Custom Title Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40px',
        background: 'rgba(22, 22, 22, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        WebkitAppRegion: 'drag',
        zIndex: 9999
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HyperProtectIcon size={18} />
          <span style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 500,
            letterSpacing: '0.02em'
          }}>
            HPCR Contract Builder
          </span>
        </div>
        
        {/* Window Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          WebkitAppRegion: 'no-drag'
        }}>
          <button
            onClick={() => window.electron?.minimizeWindow?.()}
            style={{
              background: 'transparent',
              border: 'none',
              width: '46px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              transition: 'all 0.2s ease',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="Minimize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={() => window.electron?.maximizeWindow?.()}
            style={{
              background: 'transparent',
              border: 'none',
              width: '46px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              transition: 'all 0.2s ease',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="Maximize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
            </svg>
          </button>
          <button
            onClick={() => window.electron?.closeWindow?.()}
            style={{
              background: 'transparent',
              border: 'none',
              width: '46px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              transition: 'all 0.2s ease',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#da1e28';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        backgroundColor: 'var(--cds-background)',
        backgroundImage: 'linear-gradient(135deg, rgba(0, 122, 255, 0.05) 0%, rgba(138, 43, 226, 0.05) 100%)',
        paddingTop: '40px'
      }}>
        {/* Left Section - Login Card */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem'
        }}>
          <div style={{ width: '100%', maxWidth: '420px' }}>
            {/* Logo/Icon */}
            <div style={{ marginBottom: '2rem' }}>
              <HyperProtectIcon size={48} />
            </div>

            {/* Title */}
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: '400', 
              marginBottom: '0.5rem',
              color: 'var(--cds-text-primary)'
            }}>
              Log in to <strong>IBM Confidential Computing Contract Generator</strong>
            </h1>

            <p style={{ 
              fontSize: '0.875rem', 
              color: 'var(--cds-text-secondary)',
              marginBottom: '2rem'
            }}>
              Don't have an account? Contact system administrator
            </p>

            {/* Login Card */}
            <Tile style={{ padding: '2rem', marginBottom: '1rem' }}>
              {isLoggingIn ? (
                <div style={{ margin: '2rem 0', textAlign: 'center' }}>
                  <Loading description="Authenticating..." withOverlay={false} />
                  <p style={{ marginTop: '1rem', color: 'var(--cds-text-secondary)' }}>
                    Connecting to backend server...
                  </p>
                </div>
              ) : (
                <Form onSubmit={handleSubmit}>
                  {error && !showServerConfig && (
                    <div style={{ marginBottom: '1rem' }}>
                      <InlineNotification
                        kind="error"
                        title="Login Failed"
                        subtitle={error}
                        hideCloseButton={false}
                        onCloseButtonClick={() => setError('')}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <TextInput
                      id="login-username"
                      labelText="Email"
                      placeholder="username@example.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <PasswordInput
                      id="login-password"
                      labelText="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <Checkbox
                      id="remember-email"
                      labelText="Remember email"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                    />
                  </div>

                  <Button type="submit" size="lg" style={{ width: '100%', marginBottom: '1rem' }}>
                    Continue
                  </Button>

                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      Forgot password? Contact system administrator
                    </span>
                  </div>
                </Form>
              )}
            </Tile>

            {/* Server Configuration Card */}
            <Tile style={{ padding: '1.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: showServerConfig ? '1rem' : '0'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      color: 'var(--cds-text-secondary)',
                      fontWeight: 500
                    }}>
                      Server Configuration
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {isCheckingServer ? (
                        <Tag type="gray" size="sm">Checking...</Tag>
                      ) : serverStatus === 'online' ? (
                        <Tag type="green" size="sm" renderIcon={CheckmarkFilled}>Online</Tag>
                      ) : serverStatus === 'offline' ? (
                        <Tag type="red" size="sm" renderIcon={ErrorFilled}>Offline</Tag>
                      ) : null}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'var(--cds-text-primary)',
                    marginBottom: '0.25rem',
                    wordBreak: 'break-all'
                  }}>
                    {tempServerUrl}
                  </div>
                  {serverVersion && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--cds-text-secondary)',
                      marginTop: '0.25rem'
                    }}>
                      Version: {serverVersion}
                    </div>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginLeft: '1rem',
                  flexShrink: 0
                }}>
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
                    onClick={() => setShowServerConfig(!showServerConfig)}
                  >
                    {showServerConfig ? 'Cancel' : 'Change'}
                  </Button>
                </div>
              </div>

              {/* Server URL Change Form */}
              {showServerConfig && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--cds-border-subtle)' }}>
                  {error && (
                    <div style={{ marginBottom: '1rem' }}>
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
                  <div style={{ marginBottom: '1rem' }}>
                    <TextInput
                      id="server-url"
                      labelText="Server URL"
                      placeholder="http://localhost:8080"
                      value={tempServerUrl}
                      onChange={(e) => setTempServerUrl(e.target.value)}
                      helperText="Enter the backend API server URL"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      size="sm"
                      onClick={handleServerUrlChange}
                      disabled={!tempServerUrl.trim() || isCheckingServer}
                    >
                      {isCheckingServer ? 'Checking...' : 'Test & Save'}
                    </Button>
                    <Button
                      kind="secondary"
                      size="sm"
                      onClick={() => {
                        setShowServerConfig(false);
                        setTempServerUrl(localStorage.getItem('server_url') || 'http://localhost:8080');
                        setError('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Tile>
          </div>

          {/* Footer */}
          <footer style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            color: 'var(--cds-text-secondary)',
            fontSize: '0.75rem'
          }}>
            Powered by IBM Confidential Computing
          </footer>
        </div>

        {/* Right Section - Information Panel */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '4rem'
        }}>
          <div style={{ maxWidth: '600px' }}>
            {/* Main Heading */}
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: '300',
              marginBottom: '1rem',
              color: 'var(--cds-text-primary)',
              lineHeight: '1.2'
            }}>
              IBM Confidential Computing Contract Generator
            </h2>

            <p style={{ 
              fontSize: '1rem',
              color: 'var(--cds-text-secondary)',
              marginBottom: '0.5rem',
              fontStyle: 'italic'
            }}>
              Powered by IBM Confidential Computing Team
            </p>

            <p style={{ 
              fontSize: '1.125rem',
              color: 'var(--cds-text-secondary)',
              marginBottom: '2.5rem',
              lineHeight: '1.6'
            }}>
              A collaborative desktop application for building secure, auditable contracts for confidential computing workloads with multi-party collaboration and cryptographic verification.
            </p>

            {/* Features */}
            <div style={{ marginBottom: '3rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '1.5rem',
                gap: '1rem'
              }}>
                <HyperProtectIcon size={24} style={{ flexShrink: 0, marginTop: '0.25rem' }} />
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--cds-text-primary)' }}>
                    Multi-Persona Workflow
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                    Six distinct roles (Admin, Solution Provider, Data Owner, Auditor, Environment Operator, Viewer) ensure proper separation of duties and secure collaboration.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#multi-persona-workflow');
                    }}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--cds-link-primary)',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Learn more →
                  </a>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '1.5rem',
                gap: '1rem'
              }}>
                <Document size={24} style={{ fill: 'var(--cds-icon-primary)', flexShrink: 0, marginTop: '0.25rem' }} />
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--cds-text-primary)' }}>
                    Cryptographic Security
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                    RSA-4096 key pairs, AES-256-GCM encryption, and SHA-256 hashing protect sensitive workload configurations and environment data throughout the build process.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#cryptographic-security');
                    }}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--cds-link-primary)',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Learn more →
                  </a>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <WarningAlt size={24} style={{ fill: 'var(--cds-icon-primary)', flexShrink: 0, marginTop: '0.25rem' }} />
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--cds-text-primary)' }}>
                    Immutable Audit Trail
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                    Every action is cryptographically signed and chained with SHA-256 hashes, creating a tamper-proof, verifiable record of all contract modifications.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator#audit-trail');
                    }}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--cds-link-primary)',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Learn more →
                  </a>
                </div>
              </div>
            </div>

            {/* Version and Links */}
            <div style={{
              padding: '1.5rem',
              backgroundColor: 'var(--cds-layer-01)',
              borderRadius: '4px',
              borderLeft: '4px solid var(--cds-border-interactive)'
            }}>
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'var(--cds-text-secondary)',
                marginBottom: '1rem'
              }}>
                <strong style={{ color: 'var(--cds-text-primary)' }}>Version:</strong> 1.0.0-beta
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalLink('https://github.com/Sashwat-K/persona-based-contract-generator/blob/main/README.md');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--cds-link-primary)',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--cds-link-primary)',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--cds-link-primary)',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <LogoGithub size={16} />
                  GitHub Repository
                </a>
              </div>
            </div>

            {/* Additional Info */}
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: 'rgba(0, 122, 255, 0.1)',
              borderRadius: '4px',
              fontSize: '0.875rem',
              color: 'var(--cds-text-secondary)'
            }}>
              <strong style={{ color: 'var(--cds-text-primary)' }}>Note:</strong> This is a development build. 
              For production deployment, ensure all security configurations are properly set and reviewed by your security team.
            </div>
          </div>
        </div>
      </div>
    </Theme>
  );
};

export default Login;

// Made with Bob

import React, { useState } from 'react';
import {
  Form,
  TextInput,
  Button,
  InlineNotification,
  Loading,
  Tile,
  Stack
} from '@carbon/react';
import { Checkmark, Error, WarningAlt } from '@carbon/icons-react';
import { useConfigStore } from '../store/configStore';
import apiClient from '../services/apiClient';
import { validateUrl } from '../utils/validators';
import { formatDate } from '../utils/formatters';

function ServerConfigSettings() {
  const {
    serverUrl,
    setServerUrl,
    setConnectionStatus,
    connectionStatus,
    lastConnectionTest
  } = useConfigStore();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUrlChange = (e) => {
    setInputUrl(e.target.value);
    setTestResult(null);
    setError(null);
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    // Validate URL format
    const validation = validateUrl(inputUrl, true);
    if (!validation.valid) {
      setError(validation.error);
      setTesting(false);
      return;
    }

    try {
      // Temporarily update API client base URL for testing
      const originalUrl = apiClient.getBaseURL();
      apiClient.setBaseURL(inputUrl);

      // Test connection with roles endpoint (doesn't require auth)
      await apiClient.get('/roles');

      setTestResult('success');
      setConnectionStatus('connected', new Date().toISOString());

      // Restore original URL (will be updated on save)
      apiClient.setBaseURL(originalUrl);
    } catch (err) {
      setTestResult('error');
      setConnectionStatus('failed', new Date().toISOString());
      setError(err.response?.data?.message || err.message || 'Connection failed. Please check the server URL and try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (testResult === 'success') {
      setServerUrl(inputUrl);
      apiClient.setBaseURL(inputUrl);
      setError(null);
    } else {
      setError('Please test the connection before saving');
    }
  };

  const handleReset = () => {
    const defaultUrl = 'https://localhost:8443';
    setInputUrl(defaultUrl);
    setTestResult(null);
    setError(null);
  };

  return (
    <div className="app-page app-page--narrow app-page--padded">
      <h2 className="server-config-title">Server Configuration</h2>
      <p className="server-config-subtitle">
        Configure the backend server URL for this IBM Confidential Computing Contract Generator instance.
      </p>

      <Tile className="server-config-card">
        <Form>
          <Stack gap={6}>
            <TextInput
              id="server-url"
              labelText="Server URL"
              placeholder="https://192.168.1.100:8443"
              value={inputUrl}
              onChange={handleUrlChange}
              invalid={!!error && !testing}
              invalidText={error}
              helperText="Enter the HTTPS URL of your backend server (e.g., https://192.168.1.100:8443 or https://server.example.com:8443)"
            />

            <div className="server-config-actions">
              <Button
                kind="secondary"
                onClick={testConnection}
                disabled={testing || !inputUrl}
              >
                {testing ? (
                  <>
                    <Loading small withOverlay={false} className="server-config-button-loader" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button
                kind="tertiary"
                onClick={handleReset}
                disabled={testing}
              >
                Reset to Default
              </Button>
            </div>
          </Stack>
        </Form>

        {testResult === 'success' && (
          <InlineNotification
            kind="success"
            title="Connection Successful"
            subtitle="The server is reachable and responding correctly."
            className="server-config-notification"
            hideCloseButton
            lowContrast
          />
        )}

        {testResult === 'error' && (
          <InlineNotification
            kind="error"
            title="Connection Failed"
            subtitle={error}
            className="server-config-notification"
            hideCloseButton
            lowContrast
          />
        )}
      </Tile>

      <div className="server-config-footer-actions">
        <Button
          kind="primary"
          onClick={handleSave}
          disabled={testResult !== 'success'}
        >
          Save Configuration
        </Button>
      </div>

      <Tile className="server-config-summary">
        <h4 className="server-config-summary__title">Current Configuration</h4>
        <div className="server-config-summary__content">
          <div>
            <strong>Server URL:</strong> {serverUrl}
          </div>
          <div className="server-config-summary__status-row">
            <strong>Status:</strong>
            {connectionStatus === 'connected' ? (
              <span className="server-config-status server-config-status--connected">
                <Checkmark size={16} /> Connected
              </span>
            ) : connectionStatus === 'failed' ? (
              <span className="server-config-status server-config-status--failed">
                <Error size={16} /> Failed
              </span>
            ) : (
              <span className="server-config-status server-config-status--unknown">
                <WarningAlt size={16} /> Unknown
              </span>
            )}
          </div>
          {lastConnectionTest && (
            <div>
              <strong>Last Test:</strong> {formatDate(lastConnectionTest)}
            </div>
          )}
        </div>
      </Tile>

      <InlineNotification
        kind="info"
        title="Security Notice"
        subtitle="Only HTTPS connections are allowed. Ensure your server has a valid SSL/TLS certificate."
        className="server-config-security-note"
        lowContrast
        hideCloseButton
      />
    </div>
  );
}

export default ServerConfigSettings;

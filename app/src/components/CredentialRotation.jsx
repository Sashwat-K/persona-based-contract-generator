import React, { useState, useEffect } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableSelectAll,
  TableSelectRow,
  Button,
  InlineNotification,
  Modal,
  ProgressIndicator,
  ProgressStep,
  Tag,
  Tile,
  Loading,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel
} from '@carbon/react';
import {
  WarningAlt,
  Renew,
  TrashCan,
  CheckmarkFilled,
  ErrorFilled,
  Time
} from '@carbon/icons-react';
import { useRotationStore } from '../store/rotationStore';
import { useAuthStore } from '../store/authStore';
import rotationService from '../services/rotationService';

/**
 * CredentialRotation Component
 * Admin dashboard for monitoring and managing credential expiration
 * Features: Expired credentials view, bulk operations, current user status
 */
const CredentialRotation = () => {
  const {
    expiredCredentials,
    expiringSoon,
    loading,
    error,
    setExpiredCredentials,
    setExpiringSoon,
    setLoading,
    setError
  } = useRotationStore();

  // Derive arrays from store shape — normalize backend field names to what render functions expect
  const expiredPasswords = (expiredCredentials?.expired_passwords || []).map(item => ({
    user_id: item.user_id,
    username: item.user_name,
    full_name: item.user_name,
    email: item.user_email,
    password_expires_at: item.last_changed
      ? new Date(new Date(item.last_changed).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    // must_change overrides date math — treat as expired regardless of age
    days_until_expiry: item.must_change
      ? -1
      : Math.ceil((new Date(item.last_changed).getTime() + 90 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
  }));
  const expiredKeys = (expiredCredentials?.expired_public_keys || []).map(item => {
    const neverRegistered = !item.expires_at || item.expires_at.startsWith('0001-');
    return {
      user_id: item.user_id,
      username: item.user_name,
      full_name: item.user_name,
      email: item.user_email,
      key_fingerprint: null,
      key_expires_at: neverRegistered ? null : item.expires_at,
      days_until_expiry: neverRegistered ? -9999 : -item.days_overdue
    };
  });
  const expiringPasswords = expiringSoon?.filter(i => i.type === 'password') || [];
  const expiringKeys = expiringSoon?.filter(i => i.type === 'key') || [];

  const { user } = useAuthStore();

  // UI state
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showForceChangeModal, setShowForceChangeModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [operationResult, setOperationResult] = useState(null);

  // Current user status
  const [userStatus, setUserStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rotationService.getExpiredCredentials();
      setExpiredCredentials(data);

      const soon = await rotationService.getUsersExpiringSoon(30).catch(() => []);
      setExpiringSoon(soon);
    } catch (err) {
      setError(err.message || 'Failed to load rotation data');
    } finally {
      setLoading(false);
    }
    await loadUserStatus();
  };

  const loadUserStatus = async () => {
    try {
      const status = await rotationService.checkMyCredentialStatus();
      setUserStatus(status);
    } catch (err) {
      console.error('Failed to load user status:', err);
    }
  };

  const handleForcePasswordChange = async () => {
    setOperationInProgress(true);
    setOperationResult(null);

    try {
      const userIds = selectedRows.map(row => row.id);
      const result = await rotationService.bulkForcePasswordChange(userIds);

      setOperationResult({
        success: true,
        message: `Successfully forced password change for ${result.affected} user(s)`
      });

      // Refresh data
      await loadData();
      setSelectedRows([]);
      setShowForceChangeModal(false);
    } catch (err) {
      setOperationResult({
        success: false,
        message: `Failed to force password change: ${err.message}`
      });
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleRevokeKeys = async () => {
    setOperationInProgress(true);
    setOperationResult(null);

    try {
      const userIds = selectedRows.map(row => row.id);
      const result = await rotationService.bulkRevokeKeys(userIds);

      setOperationResult({
        success: true,
        message: `Successfully revoked keys for ${result.affected} user(s)`
      });

      // Refresh data
      await loadData();
      setSelectedRows([]);
      setShowRevokeModal(false);
    } catch (err) {
      setOperationResult({
        success: false,
        message: `Failed to revoke keys: ${err.message}`
      });
    } finally {
      setOperationInProgress(false);
    }
  };

  const getStatusTag = (daysUntilExpiry) => {
    if (daysUntilExpiry < 0) {
      return <Tag type="red" renderIcon={ErrorFilled}>Expired</Tag>;
    } else if (daysUntilExpiry <= 7) {
      return <Tag type="red" renderIcon={WarningAlt}>Critical</Tag>;
    } else if (daysUntilExpiry <= 30) {
      return <Tag type="yellow" renderIcon={Time}>Warning</Tag>;
    } else {
      return <Tag type="green" renderIcon={CheckmarkFilled}>Good</Tag>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filterRows = (rows) => {
    if (!searchTerm) return rows;

    return rows.filter(row =>
      row.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderPasswordTable = (data, title) => {
    if (data.length === 0) {
      return (
        <Tile className="credential-rotation-empty-state">
          <CheckmarkFilled size={32} className="credential-rotation-empty-state__icon" />
          <p className="credential-rotation-empty-state__title">{title}</p>
          <p className="credential-rotation-empty-state__description">No users found.</p>
        </Tile>
      );
    }

    const headers = [
      { key: 'username', header: 'Username' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'email', header: 'Email' },
      { key: 'password_expires_at', header: 'Expires At' },
      { key: 'days_until_expiry', header: 'Days Until Expiry' },
      { key: 'status', header: 'Status' }
    ];

    const rows = filterRows(data).map(item => ({
      id: item.user_id,
      username: item.username,
      full_name: item.full_name,
      email: item.email,
      password_expires_at: formatDate(item.password_expires_at),
      days_until_expiry: item.days_until_expiry,
      status: getStatusTag(item.days_until_expiry)
    }));

    return (
      <DataTable rows={rows} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getSelectionProps,
          getTableProps,
          getTableContainerProps,
          selectRow
        }) => (
          <TableContainer title={title} {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users..."
                />
                <Button
                  kind="danger"
                  renderIcon={Renew}
                  onClick={() => setShowForceChangeModal(true)}
                  disabled={selectedRows.length === 0}
                >
                  Force Password Change ({selectedRows.length})
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableSelectAll {...getSelectionProps()} />
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });
                  return (
                    <TableRow key={key} {...rowProps}>
                      <TableSelectRow
                        {...getSelectionProps({ row })}
                        onChange={(checked) => {
                          if (checked) {
                            setSelectedRows([...selectedRows, row]);
                          } else {
                            setSelectedRows(selectedRows.filter(r => r.id !== row.id));
                          }
                        }}
                      />
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    );
  };

  const renderKeyTable = (data, title) => {
    if (data.length === 0) {
      return (
        <Tile className="credential-rotation-empty-state">
          <CheckmarkFilled size={32} className="credential-rotation-empty-state__icon" />
          <p className="credential-rotation-empty-state__title">{title}</p>
          <p className="credential-rotation-empty-state__description">No users found.</p>
        </Tile>
      );
    }

    const headers = [
      { key: 'username', header: 'Username' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'email', header: 'Email' },
      { key: 'key_fingerprint', header: 'Key Fingerprint' },
      { key: 'key_expires_at', header: 'Expires At' },
      { key: 'days_until_expiry', header: 'Days Until Expiry' },
      { key: 'status', header: 'Status' }
    ];

    const rows = filterRows(data).map(item => ({
      id: item.user_id,
      username: item.username,
      full_name: item.full_name,
      email: item.email,
      key_fingerprint: item.key_fingerprint ? item.key_fingerprint.substring(0, 16) + '...' : 'N/A',
      key_expires_at: formatDate(item.key_expires_at),
      days_until_expiry: item.days_until_expiry === -9999 ? 'Never registered' : item.days_until_expiry,
      status: getStatusTag(item.days_until_expiry)
    }));

    return (
      <DataTable rows={rows} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getSelectionProps,
          getTableProps,
          getTableContainerProps
        }) => (
          <TableContainer title={title} {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users..."
                />
                <Button
                  kind="danger"
                  renderIcon={TrashCan}
                  onClick={() => setShowRevokeModal(true)}
                  disabled={selectedRows.length === 0}
                >
                  Revoke Keys ({selectedRows.length})
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableSelectAll {...getSelectionProps()} />
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });
                  return (
                    <TableRow key={key} {...rowProps}>
                      <TableSelectRow
                        {...getSelectionProps({ row })}
                        onChange={(checked) => {
                          if (checked) {
                            setSelectedRows([...selectedRows, row]);
                          } else {
                            setSelectedRows(selectedRows.filter(r => r.id !== row.id));
                          }
                        }}
                      />
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    );
  };

  const renderUserStatus = () => {
    if (!userStatus) return null;

    const passwordExpiry = userStatus.passwordExpiry;
    const keyExpiry = userStatus.keyExpiry;

    // If neither exists, nothing to show
    if (!passwordExpiry && !keyExpiry) return null;

    return (
      <Tile className="user-status">
        <h5>Your Credential Status</h5>

        <div className="status-grid">
          {passwordExpiry && (
            <div className="status-item">
              <div className="status-header">
                <span className="status-label">Password</span>
                {getStatusTag(passwordExpiry.daysUntilExpiry)}
              </div>
              <div className="status-details">
                <span>Changed: {formatDate(passwordExpiry.changedAt)}</span>
                <span className="days-count">
                  {passwordExpiry.isExpired ? 'Expired' : `${passwordExpiry.daysUntilExpiry} days remaining`}
                </span>
              </div>
              {passwordExpiry.daysUntilExpiry <= 30 && (
                <InlineNotification
                  kind={passwordExpiry.isExpired ? 'error' : 'warning'}
                  title={passwordExpiry.isExpired ? 'Password Expired' : 'Password Expiring Soon'}
                  subtitle="Please change your password in Account Settings"
                  lowContrast
                  hideCloseButton
                />
              )}
            </div>
          )}

          {keyExpiry && (
            <div className="status-item">
              <div className="status-header">
                <span className="status-label">Public Key</span>
                {getStatusTag(keyExpiry.daysUntilExpiry)}
              </div>
              <div className="status-details">
                <span>Expires: {formatDate(keyExpiry.expiresAt)}</span>
                <span className="days-count">
                  {keyExpiry.isExpired ? 'Expired' : `${keyExpiry.daysUntilExpiry} days remaining`}
                </span>
                {keyExpiry.fingerprint && (
                  <span className="fingerprint">
                    Fingerprint: {keyExpiry.fingerprint.substring(0, 16)}...
                  </span>
                )}
              </div>
              {keyExpiry.daysUntilExpiry <= 30 && (
                <InlineNotification
                  kind={keyExpiry.isExpired ? 'error' : 'warning'}
                  title={keyExpiry.isExpired ? 'Key Expired' : 'Key Expiring Soon'}
                  subtitle="Please rotate your public key in Account Settings"
                  lowContrast
                  hideCloseButton
                />
              )}
            </div>
          )}
        </div>
      </Tile>
    );
  };

  const renderSummaryStats = () => {
    const totalExpired = expiredPasswords.length + expiredKeys.length;
    const totalExpiring = expiringPasswords.length + expiringKeys.length;

    return (
      <div className="summary-stats">
        <Tile className="stat-tile critical">
          <div className="stat-value">{totalExpired}</div>
          <div className="stat-label">Expired Credentials</div>
        </Tile>
        <Tile className="stat-tile warning">
          <div className="stat-value">{totalExpiring}</div>
          <div className="stat-label">Expiring Soon (30 days)</div>
        </Tile>
        <Tile className="stat-tile">
          <div className="stat-value">{expiredPasswords.length}</div>
          <div className="stat-label">Expired Passwords</div>
        </Tile>
        <Tile className="stat-tile">
          <div className="stat-value">{expiredKeys.length}</div>
          <div className="stat-label">Expired Keys</div>
        </Tile>
      </div>
    );
  };

  return (
    <div className="credential-rotation">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          lowContrast
        />
      )}

      {operationResult && (
        <InlineNotification
          kind={operationResult.success ? 'success' : 'error'}
          title={operationResult.success ? 'Success' : 'Error'}
          subtitle={operationResult.message}
          onCloseButtonClick={() => setOperationResult(null)}
          lowContrast
        />
      )}

      <div className="rotation-header">
        <h3>Credential Rotation Management</h3>
        <Button
          kind="tertiary"
          size="md"
          renderIcon={Renew}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {renderUserStatus()}
      {renderSummaryStats()}

      {loading ? (
        <Loading description="Loading credential data..." withOverlay={false} />
      ) : (
        <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => {
          setSelectedTab(selectedIndex);
          setSelectedRows([]);
          setSearchTerm('');
        }}>
          <TabList aria-label="Credential rotation tabs">
            <Tab>Expired Passwords ({expiredPasswords.length})</Tab>
            <Tab>Expiring Passwords ({expiringPasswords.length})</Tab>
            <Tab>Expired Keys ({expiredKeys.length})</Tab>
            <Tab>Expiring Keys ({expiringKeys.length})</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              {renderPasswordTable(expiredPasswords, 'Expired Passwords')}
            </TabPanel>
            <TabPanel>
              {renderPasswordTable(expiringPasswords, 'Expiring Passwords (Next 30 Days)')}
            </TabPanel>
            <TabPanel>
              {renderKeyTable(expiredKeys, 'Expired Public Keys')}
            </TabPanel>
            <TabPanel>
              {renderKeyTable(expiringKeys, 'Expiring Public Keys (Next 30 Days)')}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}

      {/* Force Password Change Modal */}
      <Modal
        open={showForceChangeModal}
        onRequestClose={() => !operationInProgress && setShowForceChangeModal(false)}
        modalHeading="Force Password Change"
        primaryButtonText="Force Change"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleForcePasswordChange}
        onSecondarySubmit={() => setShowForceChangeModal(false)}
        danger
        primaryButtonDisabled={operationInProgress}
      >
        <p>
          Are you sure you want to force password change for {selectedRows.length} user(s)?
          This will immediately expire their passwords and require them to change it on next login.
        </p>
        {operationInProgress && (
          <ProgressIndicator>
            <ProgressStep label="Processing..." />
          </ProgressIndicator>
        )}
      </Modal>

      {/* Revoke Keys Modal */}
      <Modal
        open={showRevokeModal}
        onRequestClose={() => !operationInProgress && setShowRevokeModal(false)}
        modalHeading="Revoke Public Keys"
        primaryButtonText="Revoke Keys"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleRevokeKeys}
        onSecondarySubmit={() => setShowRevokeModal(false)}
        danger
        primaryButtonDisabled={operationInProgress}
      >
        <p>
          Are you sure you want to revoke public keys for {selectedRows.length} user(s)?
          This will immediately invalidate their keys and prevent them from signing contracts
          until they register a new key.
        </p>
        {operationInProgress && (
          <ProgressIndicator>
            <ProgressStep label="Processing..." />
          </ProgressIndicator>
        )}
      </Modal>
    </div>
  );
};

export default CredentialRotation;

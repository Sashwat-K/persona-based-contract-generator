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
  TextInput,
  Select,
  SelectItem,
  Tag,
  Tile,
  Loading,
  CodeSnippet,
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import {
  Add,
  TrashCan,
  View,
  ViewOff,
  Copy,
  CheckmarkFilled,
  ErrorFilled,
  Time,
  Renew
} from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import tokenService from '../services/tokenService';
import { formatDate } from '../utils/formatters';

/**
 * APITokenManager Component
 * Manage API tokens for programmatic access
 * Features: Token creation, revocation, masking, statistics
 */
const APITokenManager = () => {
  const { user, apiTokens, fetchApiTokens } = useAuthStore();

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Create token form
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState('90');
  const [createdToken, setCreatedToken] = useState(null);

  // Token visibility
  const [visibleTokens, setVisibleTokens] = useState(new Set());

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);

    try {
      await fetchApiTokens();
    } catch (err) {
      setError(`Failed to load tokens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      setError('Token name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const expiryDays = parseInt(tokenExpiry);
      const result = await tokenService.createToken(tokenName.trim(), expiryDays);

      setCreatedToken(result);
      setShowCreateModal(false);
      setShowTokenModal(true);

      // Reset form
      setTokenName('');
      setTokenExpiry('90');

      // Reload tokens
      await loadTokens();
    } catch (err) {
      setError(`Failed to create token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeTokens = async () => {
    setLoading(true);
    setError(null);

    try {
      const tokenIds = selectedRows.map(row => row.id);
      await tokenService.bulkRevokeTokens(tokenIds);

      setSuccess(`Successfully revoked ${tokenIds.length} token(s)`);
      setSelectedRows([]);
      setShowRevokeModal(false);

      // Reload tokens
      await loadTokens();
    } catch (err) {
      setError(`Failed to revoke tokens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    setLoading(true);
    setError(null);

    try {
      await tokenService.revokeToken(tokenId);
      setSuccess('Token revoked successfully');

      // Reload tokens
      await loadTokens();
    } catch (err) {
      setError(`Failed to revoke token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleTokenVisibility = (tokenId) => {
    setVisibleTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  const maskToken = (token) => {
    if (!token) return 'N/A';
    return `${token.substring(0, 8)}${'*'.repeat(32)}${token.substring(token.length - 8)}`;
  };

  const getStatusTag = (token) => {
    if (token.revoked_at) {
      return <Tag type="red" renderIcon={ErrorFilled}>Revoked</Tag>;
    }

    const now = new Date();
    const expiry = new Date(token.expires_at);
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return <Tag type="red" renderIcon={ErrorFilled}>Expired</Tag>;
    } else if (daysUntilExpiry <= 7) {
      return <Tag type="red" renderIcon={Time}>Expiring Soon</Tag>;
    } else if (daysUntilExpiry <= 30) {
      return <Tag type="yellow" renderIcon={Time}>Expiring</Tag>;
    } else {
      return <Tag type="green" renderIcon={CheckmarkFilled}>Active</Tag>;
    }
  };

  const filterRows = (rows) => {
    if (!searchTerm) return rows;

    return rows.filter(row =>
      row.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.token_prefix?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getTokenStats = () => {
    const now = new Date();

    const active = apiTokens.filter(t =>
      !t.revoked_at && new Date(t.expires_at) > now
    ).length;

    const expired = apiTokens.filter(t =>
      !t.revoked_at && new Date(t.expires_at) <= now
    ).length;

    const expiringSoon = apiTokens.filter(t => {
      if (t.revoked_at) return false;
      const expiry = new Date(t.expires_at);
      const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }).length;

    const revoked = apiTokens.filter(t => t.revoked_at).length;

    return { active, expired, expiringSoon, revoked };
  };

  const renderStats = () => {
    const stats = getTokenStats();

    return (
      <div className="api-token-manager__stats">
        <Tile className="api-token-manager__stat-tile">
          <div className="api-token-manager__stat-value">{stats.active}</div>
          <div className="api-token-manager__stat-label">Active Tokens</div>
        </Tile>
        <Tile className="api-token-manager__stat-tile api-token-manager__stat-tile--warning">
          <div className="api-token-manager__stat-value">{stats.expiringSoon}</div>
          <div className="api-token-manager__stat-label">Expiring Soon</div>
        </Tile>
        <Tile className="api-token-manager__stat-tile api-token-manager__stat-tile--critical">
          <div className="api-token-manager__stat-value">{stats.expired}</div>
          <div className="api-token-manager__stat-label">Expired</div>
        </Tile>
        <Tile className="api-token-manager__stat-tile">
          <div className="api-token-manager__stat-value">{stats.revoked}</div>
          <div className="api-token-manager__stat-label">Revoked</div>
        </Tile>
      </div>
    );
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'token_prefix', header: 'Token Prefix' },
    { key: 'created_at', header: 'Created' },
    { key: 'expires_at', header: 'Expires' },
    { key: 'last_used_at', header: 'Last Used' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = filterRows(apiTokens).map(token => ({
    id: token.id,
    name: token.name,
    token_prefix: token.token_prefix,
    created_at: formatDate(token.created_at),
    expires_at: formatDate(token.expires_at),
    last_used_at: token.last_used_at ? formatDate(token.last_used_at) : 'Never',
    status: getStatusTag(token),
    actions: (
      <OverflowMenu flipped>
        <OverflowMenuItem
          itemText="View Token"
          onClick={() => toggleTokenVisibility(token.id)}
          disabled={token.revoked_at !== null}
        />
        <OverflowMenuItem
          itemText="Revoke"
          onClick={() => handleRevokeToken(token.id)}
          disabled={token.revoked_at !== null}
          hasDivider
          isDelete
        />
      </OverflowMenu>
    ),
    _token: token
  }));

  return (
    <div className="api-token-manager">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
        />
      )}

      <div className="api-token-manager__header">
        <h3>API Token Management</h3>
        <div className="api-token-manager__header-actions">
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Renew}
            onClick={loadTokens}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            kind="primary"
            renderIcon={Add}
            onClick={() => setShowCreateModal(true)}
          >
            Create Token
          </Button>
        </div>
      </div>

      {renderStats()}

      {loading && !apiTokens.length ? (
        <Loading description="Loading tokens..." withOverlay={false} />
      ) : (
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
            <TableContainer title="API Tokens" {...getTableContainerProps()}>
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tokens..."
                  />
                  <Button
                    kind="danger--ghost"
                    renderIcon={TrashCan}
                    onClick={() => setShowRevokeModal(true)}
                    disabled={selectedRows.length === 0}
                  >
                    Revoke Selected ({selectedRows.length})
                  </Button>
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    <TableSelectAll {...getSelectionProps()} />
                    {headers.map((header) => {
                      const headerProps = getHeaderProps({ header });
                      const { key, ...restProps } = headerProps;
                      return (
                        <TableHeader key={key} {...restProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <TableRow {...getRowProps({ row })}>
                        <TableSelectRow
                          {...getSelectionProps({ row })}
                          onChange={(checked) => {
                            if (checked) {
                              setSelectedRows([...selectedRows, row]);
                            } else {
                              setSelectedRows(selectedRows.filter(r => r.id !== row.id));
                            }
                          }}
                          disabled={row._token.revoked_at !== null}
                        />
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                      {visibleTokens.has(row.id) && (
                        <TableRow className="api-token-manager__token-reveal-row">
                          <TableCell colSpan={headers.length + 1}>
                            <div className="api-token-manager__token-reveal">
                              <span className="api-token-manager__reveal-label">Full Token:</span>
                              <CodeSnippet type="single" feedback="Copied">
                                {row._token.token_prefix}...
                              </CodeSnippet>
                              <Button
                                kind="ghost"
                                size="sm"
                                renderIcon={ViewOff}
                                onClick={() => toggleTokenVisibility(row.id)}
                              >
                                Hide
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      {/* Create Token Modal */}
      <Modal
        open={showCreateModal}
        onRequestClose={() => !loading && setShowCreateModal(false)}
        modalHeading="Create API Token"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateToken}
        onSecondarySubmit={() => setShowCreateModal(false)}
        primaryButtonDisabled={loading || !tokenName.trim()}
      >
        <div className="api-token-manager__create-form">
          <TextInput
            id="token-name"
            labelText="Token Name"
            placeholder="e.g., CI/CD Pipeline, Mobile App"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            disabled={loading}
          />

          <Select
            id="token-expiry"
            labelText="Expiry Period"
            value={tokenExpiry}
            onChange={(e) => setTokenExpiry(e.target.value)}
            disabled={loading}
          >
            <SelectItem value="30" text="30 days" />
            <SelectItem value="60" text="60 days" />
            <SelectItem value="90" text="90 days (recommended)" />
            <SelectItem value="180" text="180 days" />
            <SelectItem value="365" text="1 year" />
          </Select>

          <InlineNotification
            kind="info"
            title="Security Notice"
            subtitle="Store the token securely. It will only be shown once."
            lowContrast
            hideCloseButton
          />
        </div>
      </Modal>

      {/* Show Created Token Modal */}
      <Modal
        open={showTokenModal}
        onRequestClose={() => setShowTokenModal(false)}
        modalHeading="Token Created Successfully"
        passiveModal
      >
        <div className="api-token-manager__created-token">
          <InlineNotification
            kind="warning"
            title="Important"
            subtitle="Copy this token now. You won't be able to see it again!"
            lowContrast
            hideCloseButton
          />

          <div className="api-token-manager__token-info">
            <div className="api-token-manager__info-item">
              <span className="api-token-manager__info-label">Name:</span>
              <span className="api-token-manager__info-value">{createdToken?.name}</span>
            </div>
            <div className="api-token-manager__info-item">
              <span className="api-token-manager__info-label">Expires:</span>
              <span className="api-token-manager__info-value">
                {createdToken && formatDate(createdToken.expires_at)}
              </span>
            </div>
          </div>

          <div className="api-token-manager__token-display">
            <CodeSnippet type="multi" feedback="Copied">
              {createdToken?.token}
            </CodeSnippet>
          </div>

          <Button
            kind="primary"
            renderIcon={Copy}
            onClick={() => copyToClipboard(createdToken?.token)}
          >
            Copy Token
          </Button>
        </div>
      </Modal>

      {/* Revoke Tokens Modal */}
      <Modal
        open={showRevokeModal}
        onRequestClose={() => !loading && setShowRevokeModal(false)}
        modalHeading="Revoke API Tokens"
        primaryButtonText="Revoke"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleRevokeTokens}
        onSecondarySubmit={() => setShowRevokeModal(false)}
        danger
        primaryButtonDisabled={loading}
      >
        <p>
          Are you sure you want to revoke {selectedRows.length} token(s)?
          This action cannot be undone and will immediately invalidate the tokens.
        </p>
      </Modal>
    </div>
  );
};

export default APITokenManager;

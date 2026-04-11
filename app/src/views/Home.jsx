import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Grid,
  Column,
  Tile,
  Tag,
  Button
} from '@carbon/react';
import {
  Checkmark,
  Warning,
  WarningAlt,
  Locked,
  Unlocked,
  Time,
  Renew
} from '@carbon/icons-react';
import buildService from '../services/buildService';
import { FullPageLoader } from '../components/LoadingSpinner';
import { useAuthStore } from '../store/authStore';
import { formatDateOnly } from '../utils/formatters';
import { getRoleLabel } from '../utils/roles';

const ALERT_CLASS_BY_TYPE = {
  critical: 'home-alert-item--critical',
  warning: 'home-alert-item--warning',
  info: 'home-alert-item--info'
};

const TERMINAL_BUILD_STATUSES = new Set(['CONTRACT_DOWNLOADED', 'CANCELLED']);

const BUILD_ACTION_RULES = [
  {
    role: 'SOLUTION_PROVIDER',
    status: 'CREATED',
    title: 'Upload Workload & Certificate',
    description: 'Upload workload definition and encryption certificate to proceed.'
  },
  {
    role: 'DATA_OWNER',
    status: 'WORKLOAD_SUBMITTED',
    title: 'Stage Environment Configuration',
    description: 'Upload environment file with secrets for encryption.'
  },
  {
    role: 'AUDITOR',
    status: 'ENVIRONMENT_STAGED',
    title: 'Sign & Add Attestation',
    description: 'Generate signing and attestation artifacts, then confirm attestation readiness.'
  },
  {
    role: 'AUDITOR',
    status: 'AUDITOR_KEYS_REGISTERED',
    title: 'Finalize Contract',
    description: 'Assemble final contract and sign with your keys.'
  },
  {
    role: 'ENV_OPERATOR',
    status: 'FINALIZED',
    title: 'Download Contract',
    description: 'Download final contract and acknowledge receipt.'
  }
];

const Home = ({ userEmail, userRole, onNavigate, onSelectBuild }) => {
  const authUser = useAuthStore((state) => state.user);
  const publicKeyExpiry = useAuthStore((state) =>
    state.publicKeyExpiry || state.user?.public_key_expires_at || null
  );
  const isKeyExpired = useAuthStore((state) => state.isKeyExpired());
  const isPasswordExpired = useAuthStore((state) => state.isPasswordExpired());
  const isSetupRequired = useAuthStore((state) => state.isSetupRequired());
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const lastPasswordChange = useAuthStore((state) =>
    state.lastPasswordChange || state.user?.password_changed_at || null
  );

  const [myBuilds, setMyBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isViewer = userRole === 'VIEWER';

  const defaultUserName = useMemo(() => {
    const localPart = (userEmail || '').split('@')[0];
    return localPart || 'User';
  }, [userEmail]);

  const getDaysUntil = useCallback((dateValue) => {
    if (!dateValue) return null;
    return Math.ceil((new Date(dateValue) - new Date()) / (1000 * 60 * 60 * 24));
  }, []);

  const passwordExpiresAt = useMemo(() => {
    const explicitExpiry = authUser?.password_expires_at;
    if (explicitExpiry) return explicitExpiry;
    if (!lastPasswordChange) return null;

    const expiry = new Date(lastPasswordChange);
    expiry.setDate(expiry.getDate() + 90);
    return expiry.toISOString();
  }, [authUser?.password_expires_at, lastPasswordChange]);

  // Prepare current user data from authStore
  const currentUser = useMemo(() => {
    const keyDaysUntilExpiry = getDaysUntil(publicKeyExpiry || null);
    const passwordDaysUntilExpiry = getDaysUntil(passwordExpiresAt);

    return {
      name: authUser?.full_name || authUser?.name || defaultUserName,
      email: authUser?.email || userEmail,
      role: userRole,
      keyStatus: !(publicKeyExpiry || authUser?.public_key_fingerprint) ? 'Not Registered' : (isKeyExpired ? 'Expired' : 'Active'),
      keyExpiresAt: publicKeyExpiry || null,
      keyDaysUntilExpiry,
      passwordLastChangedAt: lastPasswordChange,
      passwordExpiresAt,
      passwordDaysUntilExpiry,
      passwordExpired: mustChangePassword || isPasswordExpired || (passwordDaysUntilExpiry != null && passwordDaysUntilExpiry <= 0)
    };
  }, [
    authUser,
    defaultUserName,
    userEmail,
    userRole,
    publicKeyExpiry,
    isKeyExpired,
    lastPasswordChange,
    passwordExpiresAt,
    mustChangePassword,
    isPasswordExpired,
    getDaysUntil
  ]);

  const loadBuilds = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      if (isSetupRequired) {
        setMyBuilds([]);
        return;
      }

      // Load builds assigned to current user
      const builds = await buildService.getBuilds();
      setMyBuilds(builds);
    } catch (err) {
      console.error('Failed to load builds:', err);
      setMyBuilds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSetupRequired]);

  // Load builds on mount
  useEffect(() => {
    loadBuilds({ showLoader: true });
  }, [loadBuilds]);

  // Calculate pending actions
  const pendingActions = useMemo(() => {
    const actions = [];

    // Check password status
    if (currentUser.passwordExpired) {
      actions.push({
        type: 'critical',
        icon: WarningAlt,
        title: 'Password Expired',
        description: 'Your password has expired. Please update it immediately.',
        action: 'Update Password',
        onClick: () => onNavigate('SETTINGS')
      });
    }

    // Check key status
    if (currentUser.keyStatus === 'Expired') {
      actions.push({
        type: 'critical',
        icon: Unlocked,
        title: 'Public Key Expired',
        description: 'Your cryptographic key has expired. Generate a new keypair.',
        action: 'Rotate Keys',
        onClick: () => onNavigate('SETTINGS')
      });
    } else if (currentUser.keyStatus === 'Active') {
      const daysUntilExpiry = Math.floor(
        (new Date(currentUser.keyExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
        actions.push({
          type: 'warning',
          icon: Time,
          title: 'Key Expiring Soon',
          description: `Your public key expires in ${daysUntilExpiry} days (${formatDateOnly(currentUser.keyExpiresAt)}).`,
          action: 'Rotate Keys',
          onClick: () => onNavigate('SETTINGS')
        });
      }
    }

    return actions;
  }, [currentUser, onNavigate]);

  // Get build actions separately
  const buildActions = useMemo(() => {
    const dedupe = new Set();
    const nextActions = [];

    myBuilds.forEach((build) => {
      const buildStatus = (build.status || '').toUpperCase();

      BUILD_ACTION_RULES.forEach((rule) => {
        if (rule.role !== userRole || buildStatus !== rule.status) return;
        const dedupeKey = `${build.id}-${rule.role}-${rule.status}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);

        nextActions.push({
          buildId: build.id,
          buildName: build.name,
          title: rule.title,
          description: rule.description,
          status: build.status,
          role: rule.role
        });
      });
    });

    return nextActions;
  }, [myBuilds, userRole]);

  const buildOverview = useMemo(() => {
    const normalizedStatuses = myBuilds.map((build) => (build.status || '').toUpperCase());
    const inProgress = normalizedStatuses.filter((status) => !TERMINAL_BUILD_STATUSES.has(status)).length;
    const downloaded = normalizedStatuses.filter((status) => status === 'CONTRACT_DOWNLOADED').length;
    const cancelled = normalizedStatuses.filter((status) => status === 'CANCELLED').length;

    return {
      total: myBuilds.length,
      inProgress,
      downloaded,
      cancelled
    };
  }, [myBuilds]);

  // Get status color and icon
  const getStatusDisplay = useCallback((status) => {
    if (status === 'Active') {
      return { color: 'green', icon: Checkmark, text: 'Active' };
    } else if (status === 'Expired') {
      return { color: 'red', icon: WarningAlt, text: 'Expired' };
    } else if (status === 'Not Registered') {
      return { color: 'gray', icon: Unlocked, text: 'Not Registered' };
    }
    return { color: 'gray', icon: Warning, text: status };
  }, []);

  const keyStatusDisplay = getStatusDisplay(currentUser.keyStatus);
  const passwordStatusDisplay = currentUser.passwordExpired
    ? { color: 'red', icon: WarningAlt, text: 'Expired' }
    : (currentUser.passwordDaysUntilExpiry != null && currentUser.passwordDaysUntilExpiry <= 14)
      ? { color: 'yellow', icon: Time, text: 'Expiring Soon' }
      : { color: 'green', icon: Checkmark, text: 'Active' };

  const getExpiryHint = useCallback((daysUntilExpiry) => {
    if (daysUntilExpiry == null) return '(Not available)';
    if (daysUntilExpiry < 0) return '(Expired)';
    if (daysUntilExpiry === 0) return '(Expires today)';
    if (daysUntilExpiry === 1) return '(1 day remaining)';
    return `(${daysUntilExpiry} days remaining)`;
  }, []);

  // Show loading state only for builds
  if (loading) {
    return <FullPageLoader description="Loading builds..." />;
  }

  return (
    <div className="app-page home-page">
      <div className="app-page__header">
        <div>
          <h1 className="app-page__title">Welcome, {currentUser.name}</h1>
          <p className="app-page__subtitle">
            {currentUser.email} • {getRoleLabel(userRole)}
          </p>
        </div>
        <div className="app-page__actions">
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Renew}
            disabled={refreshing}
            onClick={() => loadBuilds({ showLoader: false })}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <h2 className="app-section-title">Account Overview</h2>

      <Grid>
        <Column lg={8} md={4} sm={4} className="home-grid-column">
          <Tile className="home-tile">
            <h3 className="home-tile__title">Account Status</h3>

            <div className="home-status-section">
              <div className="home-status-section__header">
                <Locked size={20} className="home-status-icon" />
                <strong>Password Status</strong>
              </div>
              <div className="home-key-status-content">
                <Tag type={passwordStatusDisplay.color} className="home-status-tag">
                  {passwordStatusDisplay.text}
                </Tag>
                {currentUser.passwordExpired && (
                  <span className="home-status-action-required">Action required</span>
                )}
                <div className="home-muted-text">
                  Changed: {formatDateOnly(currentUser.passwordLastChangedAt)}
                </div>
                <div className="home-muted-text">
                  Expires: {formatDateOnly(currentUser.passwordExpiresAt)} {getExpiryHint(currentUser.passwordDaysUntilExpiry)}
                </div>
              </div>
            </div>

            <div className="home-status-section">
              <div className="home-status-section__header">
                {currentUser.keyStatus === 'Active' ? (
                  <Locked size={20} className="home-status-icon" />
                ) : (
                  <Unlocked size={20} className="home-status-icon" />
                )}
                <strong>Public Key Status</strong>
              </div>
              <div className="home-key-status-content">
                <Tag type={keyStatusDisplay.color} className="home-status-tag">
                  {keyStatusDisplay.text}
                </Tag>
                <div className="home-muted-text">
                  Expires: {formatDateOnly(currentUser.keyExpiresAt)} {getExpiryHint(currentUser.keyDaysUntilExpiry)}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              kind="tertiary"
              onClick={() => onNavigate('SETTINGS')}
            >
              Manage Account Settings
            </Button>
          </Tile>
        </Column>

        <Column lg={8} md={4} sm={4} className="home-grid-column">
          <Tile className="home-tile">
            <h3 className="home-tile__title">Account & System Alerts</h3>

            {pendingActions.length > 0 ? (
              <div>
                {pendingActions.map((action, index) => {
                  const Icon = action.icon;
                  const typeClass = ALERT_CLASS_BY_TYPE[action.type] || ALERT_CLASS_BY_TYPE.info;

                  return (
                    <div key={index} className={`home-alert-item ${typeClass}`}>
                      <Icon size={24} className="home-alert-item__icon" />
                      <div className="home-alert-item__body">
                        <h4 className="home-alert-item__title">{action.title}</h4>
                        <p className="home-alert-item__description">{action.description}</p>
                        <Button
                          size="sm"
                          onClick={action.onClick}
                        >
                          {action.action}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="home-empty-state">
                <Checkmark size={32} className="home-empty-state__icon" />
                <p className="home-empty-state__title">All Clear</p>
                <p className="home-empty-state__description">
                  No account or system alerts at this time.
                </p>
              </div>
            )}
          </Tile>
        </Column>
      </Grid>

      <h2 className="app-section-title home-section-title-spacing">
        Build Overview
      </h2>

      <Grid>
        <Column lg={isViewer ? 16 : 8} md={isViewer ? 8 : 4} sm={4} className="home-grid-column">
          <Tile className="home-tile">
            <h3 className="home-tile__title">My Builds</h3>

            {myBuilds.length > 0 ? (
              <>
                <div className="home-build-count">
                  <div className="home-build-count__value">{buildOverview.inProgress}</div>
                  <div className="home-muted-text">
                    In-progress builds for your current role
                  </div>
                  <div className="home-muted-text">
                    Total visible: {buildOverview.total}
                  </div>
                  <div className="home-muted-text">
                    Downloaded: {buildOverview.downloaded} • Cancelled: {buildOverview.cancelled}
                  </div>
                  {!isViewer && (
                    <div className="home-muted-text">
                      Action required now: {buildActions.length}
                    </div>
                  )}
                </div>

                <div className="home-build-list">
                  {myBuilds.map((build) => (
                    <div key={build.id} className="home-build-list-item">
                      <div className="home-build-list-item__name">
                        {build.name}
                      </div>
                      <div className="home-build-list-item__meta">
                        Status: {(build.status || 'UNKNOWN').replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  kind="tertiary"
                  onClick={() => onNavigate('BUILDS')}
                >
                  View All Builds
                </Button>
              </>
            ) : (
              <div className="home-text-empty">
                <p>No builds assigned to you yet.</p>
              </div>
            )}
          </Tile>
        </Column>

        {!isViewer && (
          <Column lg={8} md={4} sm={4} className="home-grid-column">
            <Tile className="home-tile">
              <h3 className="home-tile__title">Build Actions Required</h3>

              {buildActions.length > 0 ? (
                <div>
                  {buildActions.map((action, index) => (
                    <div key={index} className="home-build-action-card">
                      <div className="home-build-action-card__header">
                        <div>
                          <h4 className="home-build-action-card__build-name">{action.buildName}</h4>
                          <Tag type="blue" size="sm" className="home-build-action-card__status-tag">
                            {action.status.replace(/_/g, ' ')}
                          </Tag>
                        </div>
                      </div>
                      <div className="home-build-action-card__details">
                        <div className="home-build-action-card__title">
                          {action.title}
                        </div>
                        <div className="home-build-action-card__description">
                          Role: {getRoleLabel(action.role)}
                        </div>
                        <div className="home-build-action-card__description">
                          {action.description}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          onSelectBuild(action.buildId);
                          onNavigate('BUILDS');
                        }}
                      >
                        Go to {action.buildName}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="home-empty-state">
                  <Checkmark size={32} className="home-empty-state__icon" />
                  <p className="home-empty-state__title">All Clear</p>
                  <p className="home-empty-state__description">
                    No build actions required at this time.
                  </p>
                </div>
              )}
            </Tile>
          </Column>
        )}
      </Grid>
    </div>
  );
};

export default Home;

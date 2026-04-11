import React from 'react';
import {
  Grid,
  Column,
  InlineNotification,
  Tag,
  Tile
} from '@carbon/react';
import { Locked, Unlocked } from '@carbon/icons-react';
import { useAuthStore } from '../store/authStore';
import { formatDateOnly } from '../utils/formatters';
import PublicKeyManager from '../components/PublicKeyManager';
import PasswordManager from '../components/PasswordManager';

/**
 * AccountSettings View
 * Integrated view for user account management
 * Features: Public key management, API token management
 */
const AccountSettings = () => {
  const { user, isSetupRequired, getSetupPending } = useAuthStore();
  const mustChangePassword = useAuthStore((state) =>
    state.mustChangePassword || state.user?.must_change_password || false
  );
  const isPasswordExpired = useAuthStore((state) => state.isPasswordExpired());
  const lastPasswordChange = useAuthStore((state) =>
    state.lastPasswordChange || state.user?.password_changed_at || null
  );
  const publicKeyExpiry = useAuthStore((state) =>
    state.publicKeyExpiry || state.user?.public_key_expires_at || null
  );
  const isKeyExpired = useAuthStore((state) => state.isKeyExpired());

  const setupRequired = isSetupRequired();
  const setupPending = getSetupPending();
  const passwordPending = setupPending.includes('password_change');
  const keyPending = setupPending.includes('public_key_registration');
  const hasPublicKey = Boolean(user?.public_key_fingerprint);

  const getDaysUntil = (dateValue) => {
    if (!dateValue) return null;
    return Math.ceil((new Date(dateValue) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const passwordExpiresAt = user?.password_expires_at || (() => {
    if (!lastPasswordChange) return null;
    const expiry = new Date(lastPasswordChange);
    expiry.setDate(expiry.getDate() + 90);
    return expiry.toISOString();
  })();
  const passwordDaysUntilExpiry = getDaysUntil(passwordExpiresAt);
  const keyDaysUntilExpiry = getDaysUntil(publicKeyExpiry);

  const passwordStatus = (
    mustChangePassword
    || isPasswordExpired
    || (passwordDaysUntilExpiry != null && passwordDaysUntilExpiry <= 0)
  )
    ? 'Expired'
    : (passwordDaysUntilExpiry != null && passwordDaysUntilExpiry <= 14)
      ? 'Expiring Soon'
      : 'Active';

  const keyStatus = !hasPublicKey
    ? 'Not Registered'
    : isKeyExpired
      ? 'Expired'
      : (keyDaysUntilExpiry != null && keyDaysUntilExpiry <= 14)
        ? 'Expiring Soon'
        : 'Active';

  const getTagType = (status) => {
    if (status === 'Expired') return 'red';
    if (status === 'Expiring Soon') return 'yellow';
    if (status === 'Not Registered') return 'gray';
    return 'green';
  };

  const getExpiryHint = (daysUntilExpiry) => {
    if (daysUntilExpiry == null) return '(Not available)';
    if (daysUntilExpiry < 0) return '(Expired)';
    if (daysUntilExpiry === 0) return '(Expires today)';
    if (daysUntilExpiry === 1) return '(1 day remaining)';
    return `(${daysUntilExpiry} days remaining)`;
  };

  return (
    <div className="app-page app-page--wide app-page--padded">
      <h1 className="app-page__title account-settings-title">Account Settings</h1>
      {setupRequired && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title="Account setup required"
          subtitle={`Complete the following before using the app: ${setupPending.join(', ')}.`}
          className="account-settings-notification"
        />
      )}

      <div className="account-settings-tab-content">
        <Tile className="account-settings-summary-tile">
          <h3 className="account-settings-summary-title">Credential Status</h3>
          <div className="account-settings-summary-grid">
            <div className="account-settings-summary-item">
              <div className="account-settings-summary-item__header">
                <h4>
                  <Locked size={18} />
                  Password Status
                </h4>
                <Tag type={getTagType(passwordStatus)}>{passwordStatus}</Tag>
              </div>
              <div className="account-settings-summary-item__row">
                <span className="account-settings-summary-item__label">Last changed:</span>
                <span>{formatDateOnly(lastPasswordChange)}</span>
              </div>
              <div className="account-settings-summary-item__row">
                <span className="account-settings-summary-item__label">Expires:</span>
                <span>{formatDateOnly(passwordExpiresAt)} {getExpiryHint(passwordDaysUntilExpiry)}</span>
              </div>
            </div>

            <div className="account-settings-summary-item">
              <div className="account-settings-summary-item__header">
                <h4>
                  {hasPublicKey ? <Locked size={18} /> : <Unlocked size={18} />}
                  Public Key Status
                </h4>
                <Tag type={getTagType(keyStatus)}>{keyStatus}</Tag>
              </div>
              <div className="account-settings-summary-item__row">
                <span className="account-settings-summary-item__label">Fingerprint:</span>
                <span>{hasPublicKey ? `${user.public_key_fingerprint.substring(0, 16)}...` : 'Not registered'}</span>
              </div>
              <div className="account-settings-summary-item__row">
                <span className="account-settings-summary-item__label">Expires:</span>
                <span>{formatDateOnly(publicKeyExpiry)} {getExpiryHint(keyDaysUntilExpiry)}</span>
              </div>
            </div>
          </div>
        </Tile>

        <Grid narrow className="account-settings-grid">
          <Column lg={8} md={4} sm={4} className={`account-settings-grid__column${passwordPending ? ' account-settings-grid__column--pending' : ''}`}>
            <PasswordManager />
          </Column>
          <Column lg={8} md={4} sm={4} className={`account-settings-grid__column${keyPending ? ' account-settings-grid__column--pending' : ''}`}>
            <PublicKeyManager
              userId={user?.id}
              isAdmin={user?.role === 'ADMIN'}
            />
          </Column>
        </Grid>
      </div>
    </div>
  );
};

export default AccountSettings;

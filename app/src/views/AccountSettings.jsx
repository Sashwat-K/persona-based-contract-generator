import React from 'react';
import {
  Grid,
  Column,
  InlineNotification
} from '@carbon/react';
import { useAuthStore } from '../store/authStore';
import PublicKeyManager from '../components/PublicKeyManager';
import PasswordManager from '../components/PasswordManager';

/**
 * AccountSettings View
 * Integrated view for user account management
 * Features: Public key management, API token management
 */
const AccountSettings = () => {
  const { user, isSetupRequired, getSetupPending } = useAuthStore();
  const setupRequired = isSetupRequired();
  const setupPending = getSetupPending();
  const passwordPending = setupPending.includes('password_change');
  const keyPending = setupPending.includes('public_key_registration');

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

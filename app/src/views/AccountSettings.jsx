import React, { useState } from 'react';
import { useEffect } from 'react';
import {
  Grid,
  Column,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
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
  const [selectedTab, setSelectedTab] = useState(0);
  const setupRequired = isSetupRequired();
  const setupPending = getSetupPending();

  useEffect(() => {
    if (setupPending.includes('password_change')) {
      setSelectedTab(0); // Password tab
    } else if (setupPending.includes('public_key_registration')) {
      setSelectedTab(1); // Cryptographic Identity tab
    }
  }, [setupPending.join(',')]);

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Account Settings</h1>
      {setupRequired && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title="Account setup required"
          subtitle={`Complete the following before using the app: ${setupPending.join(', ')}.`}
          style={{ marginBottom: '1rem' }}
        />
      )}
      
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Account settings tabs" contained>
          <Tab>Password</Tab>
          <Tab>Cryptographic Identity</Tab>
        </TabList>
        
        <TabPanels>
          {/* Password Management Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              <Grid narrow>
                <Column lg={16}>
                  <PasswordManager />
                </Column>
              </Grid>
            </div>
          </TabPanel>
          
          {/* Public Key Management Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              <Grid narrow>
                <Column lg={16}>
                  <PublicKeyManager
                    userId={user?.id}
                    isAdmin={user?.role === 'ADMIN'}
                  />
                </Column>
              </Grid>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default AccountSettings;

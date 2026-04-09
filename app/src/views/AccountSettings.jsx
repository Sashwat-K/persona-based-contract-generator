import React, { useState } from 'react';
import {
  Grid,
  Column,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel
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
  const { user } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Account Settings</h1>
      
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Account settings tabs" contained>
          <Tab>Cryptographic Identity</Tab>
          <Tab>Password</Tab>
        </TabList>
        
        <TabPanels>
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
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default AccountSettings;

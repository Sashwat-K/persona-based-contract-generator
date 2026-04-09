import React, { useState, useEffect } from 'react';
import { DonutChart, GroupedBarChart } from '@carbon/charts-react';
import {
  Grid,
  Column,
  Tile,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button
} from '@carbon/react';
import { WarningAlt, Locked, Unlocked } from '@carbon/icons-react';
import userService from '../services/userService';
import buildService from '../services/buildService';
import rotationService from '../services/rotationService';
import CredentialRotation from '../components/CredentialRotation';
import { FullPageLoader } from '../components/LoadingSpinner';

/**
 * AdminAnalytics View
 * Integrated admin dashboard with analytics and credential rotation monitoring
 * Features: Build/user statistics, security alerts, credential rotation management
 */
const AdminAnalytics = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for analytics data
  const [users, setUsers] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [rotationStatus, setRotationStatus] = useState(null);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load users, builds, and rotation status in parallel
        const [usersData, buildsData, rotationData] = await Promise.all([
          userService.listUsers(),
          buildService.getBuilds(),
          rotationService.getExpiryDashboard().catch(() => null) // Optional, may fail if no data
        ]);

        setUsers(usersData);
        setBuilds(buildsData);
        setRotationStatus(rotationData);

      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError(err.message || 'Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  // Show loading state
  if (loading) {
    return <FullPageLoader description="Loading analytics..." />;
  }

  // Show error state
  if (error) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
        <Tile>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <WarningAlt size={48} style={{ color: 'var(--cds-support-error)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Failed to Load Analytics</h3>
            <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Tile>
      </div>
    );
  }

  // Process data for Donut Chart (Build Status)
  const buildStatusCount = builds.reduce((acc, build) => {
    const statusName = (build.status || 'UNKNOWN').replace(/_/g, ' ');
    acc[statusName] = (acc[statusName] || 0) + 1;
    return acc;
  }, {});

  const donutData = Object.entries(buildStatusCount).map(([group, value]) => ({
    group,
    value
  }));

  const donutOptions = {
    title: 'Build Status Distribution',
    resizable: true,
    donut: {
      center: {
        label: 'Builds'
      }
    },
    height: '400px',
    legend: {
      enabled: true,
      truncation: {
        type: 'none',
        threshold: 1000,
        numCharacter: 1000
      }
    },
    tooltip: {
      truncation: {
        type: 'none',
        threshold: 1000,
        numCharacter: 1000
      }
    }
  };

  // Process data for Bar Chart (Users by Role)
  const roleStats = {};
  users.forEach(user => {
    const roles = user.roles && user.roles.length > 0 ? user.roles : ['No Role'];
    roles.forEach(role => {
      const roleName = role.replace(/_/g, ' ');
      if (!roleStats[roleName]) {
        roleStats[roleName] = { active: 0, inactive: 0 };
      }
      if (user.is_active) {
        roleStats[roleName].active += 1;
      } else {
        roleStats[roleName].inactive += 1;
      }
    });
  });

  const barData = [];
  Object.entries(roleStats).forEach(([roleName, stats]) => {
    barData.push({ group: 'Active', key: roleName, value: stats.active });
    barData.push({ group: 'Inactive', key: roleName, value: stats.inactive });
  });

  const barOptions = {
    title: 'Users by Persona Role',
    axes: {
      left: {
        mapsTo: 'value',
        ticks: {
          min: 0,
          max: Math.max(...barData.map(d => d.value), 0) + 1,
          values: Array.from({ length: Math.max(...barData.map(d => d.value), 0) + 2 }, (_, i) => i)
        }
      },
      bottom: {
        mapsTo: 'key',
        scaleType: 'labels',
        truncation: {
          type: 'none'
        }
      }
    },
    height: '400px',
    color: {
      scale: {
        'Active': '#24a148',
        'Inactive': '#da1e28'
      }
    },
    bars: {
      maxWidth: 50
    },
    legend: {
      truncation: {
        type: 'none'
      }
    }
  };

  // Calculate metrics
  const expiredKeys = users.filter(u => {
    if (!u.public_key_expires_at) return false;
    return new Date(u.public_key_expires_at) < new Date();
  }).length;

  const expiredPasswords = users.filter(u => {
    if (!u.password_expires_at) return false;
    return new Date(u.password_expires_at) < new Date();
  }).length;

  const activeBuilds = builds.filter(b => b.status !== 'FINALIZED' && b.status !== 'CANCELLED').length;

  const activeUsers = users.filter(u => u.is_active).length;
  const disabledUsers = users.filter(u => !u.is_active).length;

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Admin Diagnostics & Analytics</h1>
      
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Admin analytics tabs" contained>
          <Tab>Overview & Statistics</Tab>
          <Tab>Credential Rotation</Tab>
        </TabList>
        
        <TabPanels>
          {/* Overview & Statistics Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              {/* Key Metrics Row */}
              <Grid narrow style={{ marginBottom: '2rem' }}>
                <Column lg={4}>
                  <Tile style={{ minHeight: '120px' }}>
                     <h3>Total Users</h3>
                     <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{users.length}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile style={{ minHeight: '120px' }}>
                     <h3>Active Builds</h3>
                     <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{activeBuilds}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile style={{ minHeight: '120px' }}>
                     <h3>Finalized Contracts</h3>
                     <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{buildStatusCount['FINALIZED'] || 0}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile style={{ minHeight: '120px' }}>
                     <h3>Total Builds</h3>
                     <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{builds.length}</h1>
                  </Tile>
                </Column>
              </Grid>

              {/* User Status Row */}
              <Grid narrow style={{ marginBottom: '2rem' }}>
                <Column lg={8}>
                  <Tile style={{
                    minHeight: '120px',
                    backgroundColor: '#24a148',
                    color: '#fff'
                  }}>
                    <h3 style={{ color: '#fff' }}>Active Users</h3>
                    <h1 style={{ fontSize: '3rem', marginTop: '1rem', color: '#fff' }}>{activeUsers}</h1>
                  </Tile>
                </Column>
                <Column lg={8}>
                  <Tile style={{
                    minHeight: '120px',
                    backgroundColor: disabledUsers > 0 ? '#da1e28' : '#24a148',
                    color: '#fff'
                  }}>
                    <h3 style={{ color: '#fff' }}>Disabled Users</h3>
                    <h1 style={{ fontSize: '3rem', marginTop: '1rem', color: '#fff' }}>{disabledUsers}</h1>
                    {disabledUsers > 0 && (
                      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                        {disabledUsers} user(s) are currently deactivated
                      </p>
                    )}
                  </Tile>
                </Column>
              </Grid>

              {/* Security Alerts Row */}
              <Grid narrow style={{ marginBottom: '2rem' }}>
                <Column lg={8}>
                  <Tile style={{
                    minHeight: '120px',
                    backgroundColor: expiredKeys > 0 ? '#da1e28' : '#24a148',
                    color: '#fff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {expiredKeys > 0 ? <WarningAlt size={32} /> : <Locked size={32} />}
                      <div>
                        <h3 style={{ color: '#fff' }}>Expired Public Keys</h3>
                        <h1 style={{ fontSize: '3rem', marginTop: '0.5rem', color: '#fff' }}>{expiredKeys}</h1>
                        {expiredKeys > 0 && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                            Action required: Users must renew their keys
                          </p>
                        )}
                      </div>
                    </div>
                  </Tile>
                </Column>
                <Column lg={8}>
                  <Tile style={{
                    minHeight: '120px',
                    backgroundColor: expiredPasswords > 0 ? '#da1e28' : '#24a148',
                    color: '#fff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {expiredPasswords > 0 ? <Unlocked size={32} /> : <Locked size={32} />}
                      <div>
                        <h3 style={{ color: '#fff' }}>Expired Passwords</h3>
                        <h1 style={{ fontSize: '3rem', marginTop: '0.5rem', color: '#fff' }}>{expiredPasswords}</h1>
                        {expiredPasswords > 0 && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                            Action required: Users must change their passwords
                          </p>
                        )}
                      </div>
                    </div>
                  </Tile>
                </Column>
              </Grid>

              {/* Charts Row */}
              <Grid narrow>
                <Column lg={8}>
                  <Tile>
                     {typeof window !== 'undefined' && <DonutChart data={donutData} options={donutOptions} />}
                  </Tile>
                </Column>
                <Column lg={8}>
                  <Tile>
                    {typeof window !== 'undefined' && <GroupedBarChart data={barData} options={barOptions} />}
                  </Tile>
                </Column>
              </Grid>
            </div>
          </TabPanel>
          
          {/* Credential Rotation Tab */}
          <TabPanel>
            <div style={{ padding: '2rem 0' }}>
              <Grid narrow>
                <Column lg={16}>
                  <CredentialRotation />
                </Column>
              </Grid>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default AdminAnalytics;

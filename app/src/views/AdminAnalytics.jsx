import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { WarningAlt, Locked, Unlocked, Renew } from '@carbon/icons-react';
import userService from '../services/userService';
import buildService from '../services/buildService';
import CredentialRotation from '../components/CredentialRotation';
import { FullPageLoader } from '../components/LoadingSpinner';
import { ErrorStatePanel } from '../components/StatePanel';

const CHART_TOOLBAR_CONTROLS = [
  { type: 'Export as CSV' },
  { type: 'Export as PNG' },
  { type: 'Export as JPG' },
  { type: 'Make fullscreen' }
];

/**
 * AdminAnalytics View
 * Integrated admin dashboard with analytics and credential rotation monitoring
 * Features: Build/user statistics, security alerts, credential rotation management
 */
const AdminAnalytics = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // State for analytics data
  const [users, setUsers] = useState([]);
  const [builds, setBuilds] = useState([]);

  const loadAnalytics = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const [usersData, buildsData] = await Promise.all([
        userService.listUsers(),
        buildService.getBuilds()
      ]);

      setUsers(usersData);
      setBuilds(buildsData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics({ showLoader: true });
  }, [loadAnalytics]);

  // Process data for Donut Chart (Build Status)
  const buildStatusCount = useMemo(() => (
    builds.reduce((acc, build) => {
      const statusName = (build.status || 'UNKNOWN').replace(/_/g, ' ');
      acc[statusName] = (acc[statusName] || 0) + 1;
      return acc;
    }, {})
  ), [builds]);

  const donutData = useMemo(
    () => Object.entries(buildStatusCount).map(([group, value]) => ({ group, value })),
    [buildStatusCount]
  );

  const donutOptions = useMemo(() => ({
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
    },
    toolbar: {
      enabled: true,
      controls: CHART_TOOLBAR_CONTROLS
    }
  }), []);

  // Process data for Bar Chart (Users by Role)
  const barData = useMemo(() => {
    const roleStats = {};
    users.forEach((user) => {
      const roles = user.roles && user.roles.length > 0 ? user.roles : ['No Role'];
      roles.forEach((role) => {
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

    const rows = [];
    Object.entries(roleStats).forEach(([roleName, stats]) => {
      rows.push({ group: 'Active', key: roleName, value: stats.active });
      rows.push({ group: 'Inactive', key: roleName, value: stats.inactive });
    });
    return rows;
  }, [users]);

  const maxBarValue = useMemo(
    () => Math.max(...barData.map((item) => item.value), 0),
    [barData]
  );

  const barOptions = useMemo(() => ({
    title: 'Users by Persona Role',
    axes: {
      left: {
        mapsTo: 'value',
        ticks: {
          min: 0,
          max: maxBarValue + 1,
          values: Array.from({ length: maxBarValue + 2 }, (_, i) => i)
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
        Active: '#24a148',
        Inactive: '#da1e28'
      }
    },
    bars: {
      maxWidth: 50
    },
    legend: {
      truncation: {
        type: 'none'
      }
    },
    toolbar: {
      enabled: true,
      controls: CHART_TOOLBAR_CONTROLS
    }
  }), [maxBarValue]);

  // Calculate metrics
  const expiredKeys = useMemo(() => users.filter((u) => {
    if (!u.public_key_expires_at) return false;
    return new Date(u.public_key_expires_at) < new Date();
  }).length, [users]);

  const expiredPasswords = useMemo(() => users.filter((u) => {
    if (!u.password_expires_at) return false;
    return new Date(u.password_expires_at) < new Date();
  }).length, [users]);

  const activeBuilds = useMemo(
    () => builds.filter((b) => !['FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED'].includes(b.status)).length,
    [builds]
  );

  const completedContracts = useMemo(
    () => (buildStatusCount['FINALIZED'] || 0) + (buildStatusCount['CONTRACT DOWNLOADED'] || 0),
    [buildStatusCount]
  );

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const disabledUsers = useMemo(() => users.filter((u) => !u.is_active).length, [users]);

  // Render loading/error states after all hooks to preserve stable hook order.
  if (loading) {
    return <FullPageLoader description="Loading analytics..." />;
  }

  if (error) {
    return (
      <div className="app-page app-page--wide app-page--padded">
        <ErrorStatePanel
          title="Failed to Load Analytics"
          description={error}
          action={<Button onClick={() => loadAnalytics({ showLoader: true })}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="app-page app-page--wide app-page--padded">
      <div className="app-page__header">
        <h1 className="app-page__title admin-analytics-title">Admin Diagnostics & Analytics</h1>
      </div>
      
      <Tabs selectedIndex={selectedTab} onChange={(e) => setSelectedTab(e.selectedIndex)}>
        <TabList aria-label="Admin analytics tabs" contained>
          <Tab>Overview & Statistics</Tab>
          <Tab>Credential Rotation</Tab>
        </TabList>
        
        <TabPanels>
          {/* Overview & Statistics Tab */}
          <TabPanel>
            <div className="admin-analytics-tab-content">
              <div className="admin-analytics-overview-actions">
                <Button
                  kind="tertiary"
                  size="md"
                  renderIcon={Renew}
                  onClick={() => loadAnalytics({ showLoader: false })}
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>

              {/* Key Metrics Row */}
              <Grid narrow className="admin-analytics-grid-spacing">
                <Column lg={4}>
                  <Tile className="analytics-kpi-tile">
                    <h3 className="analytics-kpi-title">Total Users</h3>
                    <h1 className="analytics-kpi-value">{users.length}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className="analytics-kpi-tile">
                    <h3 className="analytics-kpi-title">Active Builds</h3>
                    <h1 className="analytics-kpi-value">{activeBuilds}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className="analytics-kpi-tile">
                    <h3 className="analytics-kpi-title">Completed Contracts</h3>
                    <h1 className="analytics-kpi-value">{completedContracts}</h1>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className="analytics-kpi-tile">
                    <h3 className="analytics-kpi-title">Total Builds</h3>
                    <h1 className="analytics-kpi-value">{builds.length}</h1>
                  </Tile>
                </Column>
              </Grid>

              {/* User & Security Status Row */}
              <Grid narrow className="admin-analytics-grid-spacing">
                <Column lg={4}>
                  <Tile className="analytics-kpi-tile analytics-kpi-tile--ok">
                    <h3 className="analytics-kpi-title">Active Users</h3>
                    <h1 className="analytics-kpi-value">{activeUsers}</h1>
                    <p className="analytics-kpi-caption">Accounts currently enabled.</p>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className={`analytics-kpi-tile ${disabledUsers > 0 ? 'analytics-kpi-tile--danger' : 'analytics-kpi-tile--ok'}`}>
                    <h3 className="analytics-kpi-title">Disabled Users</h3>
                    <h1 className="analytics-kpi-value">{disabledUsers}</h1>
                    <p className="analytics-kpi-caption">
                      {disabledUsers > 0 ? 'Review and reactivate if needed.' : 'No disabled accounts.'}
                    </p>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className={`analytics-kpi-tile ${expiredKeys > 0 ? 'analytics-kpi-tile--danger' : 'analytics-kpi-tile--ok'}`}>
                    <div className="analytics-kpi-header">
                      {expiredKeys > 0 ? <WarningAlt size={32} /> : <Locked size={32} />}
                      <div>
                        <h3 className="analytics-kpi-title">Expired Public Keys</h3>
                        <h1 className="analytics-kpi-value admin-analytics-security-value">{expiredKeys}</h1>
                        <p className="analytics-kpi-caption">
                          {expiredKeys > 0
                            ? 'Action required: renew user keys.'
                            : 'No key expiry action needed.'}
                        </p>
                      </div>
                    </div>
                  </Tile>
                </Column>
                <Column lg={4}>
                  <Tile className={`analytics-kpi-tile ${expiredPasswords > 0 ? 'analytics-kpi-tile--danger' : 'analytics-kpi-tile--ok'}`}>
                    <div className="analytics-kpi-header">
                      {expiredPasswords > 0 ? <Unlocked size={32} /> : <Locked size={32} />}
                      <div>
                        <h3 className="analytics-kpi-title">Expired Passwords</h3>
                        <h1 className="analytics-kpi-value admin-analytics-security-value">{expiredPasswords}</h1>
                        <p className="analytics-kpi-caption">
                          {expiredPasswords > 0
                            ? 'Action required: users must change passwords.'
                            : 'No password expiry action needed.'}
                        </p>
                      </div>
                    </div>
                  </Tile>
                </Column>
              </Grid>

              {/* Charts Row */}
              <Grid narrow>
                <Column lg={8}>
                  <Tile className="admin-analytics-chart-tile">
                    <div className="admin-analytics-chart-body">
                      {typeof window !== 'undefined' && <DonutChart data={donutData} options={donutOptions} />}
                    </div>
                  </Tile>
                </Column>
                <Column lg={8}>
                  <Tile className="admin-analytics-chart-tile">
                    <div className="admin-analytics-chart-body">
                      {typeof window !== 'undefined' && <GroupedBarChart data={barData} options={barOptions} />}
                    </div>
                  </Tile>
                </Column>
              </Grid>
            </div>
          </TabPanel>
          
          {/* Credential Rotation Tab */}
          <TabPanel>
            <div className="admin-analytics-tab-content">
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

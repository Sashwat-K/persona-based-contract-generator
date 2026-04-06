import React from 'react';
import { DonutChart, SimpleBarChart } from '@carbon/charts-react';
import { Grid, Column, Tile } from '@carbon/react';
import { WarningAlt, Locked, Unlocked } from '@carbon/icons-react';
import { initialBuilds, mockUsers } from '../store/mockData';

const AdminAnalytics = () => {
  // Process data for Donut Chart (Build Status)
  const buildStatusCount = initialBuilds.reduce((acc, build) => {
    const statusName = build.status.replace(/_/g, ' ');
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
  const userRoleCount = mockUsers.reduce((acc, user) => {
    const roleName = user.role.replace(/_/g, ' ');
    acc[roleName] = (acc[roleName] || 0) + 1;
    return acc;
  }, {});

  const barData = Object.entries(userRoleCount).map(([group, value]) => ({
    group,
    value
  }));

  const barOptions = {
    title: 'Users by Persona Role',
    axes: {
      left: {
        mapsTo: 'value',
        ticks: {
          min: 0,
          max: Math.max(...barData.map(d => d.value)) + 1,
          values: Array.from({ length: Math.max(...barData.map(d => d.value)) + 2 }, (_, i) => i)
        }
      },
      bottom: {
        mapsTo: 'group',
        scaleType: 'labels',
        truncation: {
          type: 'none'
        }
      }
    },
    height: '400px',
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
  const expiredKeys = mockUsers.filter(u => u.keyStatus === 'Expired').length;
  const expiredPasswords = mockUsers.filter(u => u.passwordExpired === true).length;
  const activeBuilds = initialBuilds.filter(b => b.status !== 'FINALIZED' && b.status !== 'CANCELLED').length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin Diagnostics & Analytics</h1>
      
      {/* Key Metrics Row */}
      <Grid narrow style={{ marginBottom: '2rem' }}>
        <Column lg={4}>
          <Tile style={{ minHeight: '120px' }}>
             <h3>Total Users</h3>
             <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{mockUsers.length}</h1>
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
             <h1 style={{ fontSize: '3rem', marginTop: '1rem' }}>{initialBuilds.length}</h1>
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
            {typeof window !== 'undefined' && <SimpleBarChart data={barData} options={barOptions} />}
          </Tile>
        </Column>
      </Grid>
    </div>
  );
};

export default AdminAnalytics;

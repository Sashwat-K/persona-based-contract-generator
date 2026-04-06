import React from 'react';
import {
  Grid,
  Column,
  Tile,
  Tag,
  Button,
  ProgressBar
} from '@carbon/react';
import { 
  Checkmark, 
  Warning, 
  WarningAlt,
  Locked,
  Unlocked,
  Time
} from '@carbon/icons-react';
import { mockUsers, initialBuilds } from '../store/mockData';

const Home = ({ userEmail, userRole, onNavigate, onSelectBuild }) => {
  // Get current user data
  const currentUser = mockUsers.find(u => u.email === userEmail) || {
    name: 'User',
    email: userEmail,
    role: userRole,
    keyStatus: 'Unknown',
    keyExpiresAt: 'N/A',
    passwordExpired: false
  };

  // Get builds assigned to current user
  const myBuilds = initialBuilds.filter(build => {
    const assignments = Object.values(build.assignments || {});
    return assignments.some(assignment => 
      assignment.toLowerCase().includes(currentUser.name.toLowerCase().split(' ')[0])
    );
  });

  // Calculate pending actions
  const getPendingActions = () => {
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
          description: `Your public key expires in ${daysUntilExpiry} days (${currentUser.keyExpiresAt}).`,
          action: 'Rotate Keys',
          onClick: () => onNavigate('SETTINGS')
        });
      }
    }

    return actions;
  };

  // Get build actions separately
  const getBuildActions = () => {
    const buildActions = [];
    
    myBuilds.forEach(build => {
      if (userRole === 'SOLUTION_PROVIDER' && build.status === 'CREATED') {
        buildActions.push({
          buildId: build.id,
          buildName: build.name,
          title: 'Upload Workload & Certificate',
          description: 'Upload workload definition and encryption certificate to proceed.',
          status: build.status
        });
      } else if (userRole === 'DATA_OWNER' && build.status === 'WORKLOAD_SUBMITTED') {
        buildActions.push({
          buildId: build.id,
          buildName: build.name,
          title: 'Stage Environment Configuration',
          description: 'Upload environment file with secrets for encryption.',
          status: build.status
        });
      } else if (userRole === 'AUDITOR' && build.status === 'ENVIRONMENT_STAGED') {
        buildActions.push({
          buildId: build.id,
          buildName: build.name,
          title: 'Register Attestation Keys',
          description: 'Generate and register attestation key pair locally.',
          status: build.status
        });
      } else if (userRole === 'AUDITOR' && build.status === 'AUDITOR_KEYS_REGISTERED') {
        buildActions.push({
          buildId: build.id,
          buildName: build.name,
          title: 'Finalize Contract',
          description: 'Assemble final contract and sign with your keys.',
          status: build.status
        });
      } else if (userRole === 'ENV_OPERATOR' && build.status === 'FINALIZED') {
        buildActions.push({
          buildId: build.id,
          buildName: build.name,
          title: 'Download Contract',
          description: 'Download final contract and acknowledge receipt.',
          status: build.status
        });
      }
    });
    
    return buildActions;
  };

  const pendingActions = getPendingActions();
  const buildActions = getBuildActions();

  // Get status color and icon
  const getStatusDisplay = (status) => {
    if (status === 'Active') {
      return { color: 'green', icon: Checkmark, text: 'Active' };
    } else if (status === 'Expired') {
      return { color: 'red', icon: WarningAlt, text: 'Expired' };
    }
    return { color: 'gray', icon: Warning, text: status };
  };

  const keyStatusDisplay = getStatusDisplay(currentUser.keyStatus);
  const passwordStatusDisplay = currentUser.passwordExpired 
    ? { color: 'red', icon: WarningAlt, text: 'Expired' }
    : { color: 'green', icon: Checkmark, text: 'Valid' };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome, {currentUser.name}</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--cds-text-secondary)' }}>
        {currentUser.email} • {userRole.replace(/_/g, ' ')}
      </p>

      {/* Section Title for Row 1 */}
      <h2 style={{
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--cds-border-subtle)'
      }}>
        Account Overview
      </h2>

      <Grid>
        {/* Row 1: Account Status & Account Alerts */}
        {/* Account Status Section */}
        <Column lg={8} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ height: '100%' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Account Status</h3>
            
            {/* Password Status */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <Locked size={20} style={{ marginRight: '0.5rem' }} />
                <strong>Password Status</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
                <Tag type={passwordStatusDisplay.color} style={{ marginRight: '0.5rem' }}>
                  {passwordStatusDisplay.text}
                </Tag>
                {currentUser.passwordExpired && (
                  <span style={{ color: 'var(--cds-text-error)', fontSize: '0.875rem' }}>
                    Action required
                  </span>
                )}
              </div>
            </div>

            {/* Public Key Status */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                {currentUser.keyStatus === 'Active' ? (
                  <Locked size={20} style={{ marginRight: '0.5rem' }} />
                ) : (
                  <Unlocked size={20} style={{ marginRight: '0.5rem' }} />
                )}
                <strong>Public Key Status</strong>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <Tag type={keyStatusDisplay.color} style={{ marginRight: '0.5rem' }}>
                  {keyStatusDisplay.text}
                </Tag>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  Expires: {currentUser.keyExpiresAt}
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

        {/* Account & System Pending Actions - Always visible */}
        <Column lg={8} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ height: '100%' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Account & System Alerts</h3>
            
            {pendingActions.length > 0 ? (
              
              <div>
                {pendingActions.map((action, index) => {
                  const Icon = action.icon;
                  const bgColor = action.type === 'critical' ? 'var(--cds-support-error)' :
                                  action.type === 'warning' ? 'var(--cds-support-warning)' :
                                  'var(--cds-support-info)';
                  
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '1rem',
                      marginBottom: '1rem',
                      backgroundColor: 'var(--cds-layer-01)',
                      borderLeft: `4px solid ${bgColor}`
                    }}>
                      <Icon size={24} style={{
                        marginRight: '1rem',
                        marginTop: '0.25rem',
                        flexShrink: 0,
                        color: bgColor
                      }} />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>{action.title}</h4>
                        <p style={{
                          marginBottom: '1rem',
                          fontSize: '0.875rem',
                          color: 'var(--cds-text-secondary)'
                        }}>
                          {action.description}
                        </p>
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
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'var(--cds-layer-01)',
                borderRadius: '4px'
              }}>
                <Checkmark size={32} style={{
                  color: 'var(--cds-support-success)',
                  marginBottom: '0.5rem'
                }} />
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>All Clear</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  No account or system alerts at this time.
                </p>
              </div>
            )}
          </Tile>
        </Column>

      </Grid>

      {/* Section Title for Row 2 */}
      <h2 style={{
        marginTop: '1.5rem',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--cds-border-subtle)'
      }}>
        Build Overview
      </h2>

      <Grid>
        {/* Row 2: My Builds & Build Actions */}
        {/* My Builds Section */}
        <Column lg={8} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ height: '100%' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>My Builds</h3>
            
            {myBuilds.length > 0 ? (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--cds-text-primary)' }}>
                    {myBuilds.length}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                    Active builds assigned to you
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  {myBuilds.map(build => (
                    <div key={build.id} style={{ 
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: 'var(--cds-layer-01)',
                      borderLeft: '3px solid var(--cds-border-interactive)'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                        {build.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                        Status: {build.status.replace(/_/g, ' ')}
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
              <div style={{ 
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--cds-text-secondary)'
              }}>
                <p>No builds assigned to you yet.</p>
              </div>
            )}
          </Tile>
        </Column>

        {/* Build Actions Section - Always visible */}
        <Column lg={8} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ height: '100%' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Build Actions Required</h3>
            
            {buildActions.length > 0 ? (
              <div>
                {buildActions.map((action, index) => (
                  <div key={index} style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: 'var(--cds-layer-01)',
                    borderLeft: '4px solid var(--cds-support-info)',
                    borderRadius: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ marginBottom: '0.25rem' }}>{action.buildName}</h4>
                        <Tag type="blue" size="sm" style={{ marginTop: '0.25rem' }}>
                          {action.status.replace(/_/g, ' ')}
                        </Tag>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--cds-layer-02)',
                      borderRadius: '4px',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        {action.title}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
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
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'var(--cds-layer-01)',
                borderRadius: '4px'
              }}>
                <Checkmark size={32} style={{
                  color: 'var(--cds-support-success)',
                  marginBottom: '0.5rem'
                }} />
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>All Clear</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  No build actions required at this time.
                </p>
              </div>
            )}
          </Tile>
        </Column>
      </Grid>
    </div>
  );
};

export default Home;

// Made with Bob

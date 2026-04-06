import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  HeaderMenuButton,
  Theme,
  SideNav,
  SideNavItems,
  SideNavMenuItem,
  SideNavMenu,
  Modal
} from '@carbon/react';
import {
  Settings,
  Logout,
  UserAvatar,
  UserAdmin,
  Application,
  DataBase,
  Security,
  CloudApp,
  View,
  Home,
  Catalog,
  ChartLine,
  UserMultiple,
  DocumentTasks,
  Minimize,
  Maximize,
  Close
} from '@carbon/icons-react';
import HyperProtectIcon from './HyperProtectIcon';

const AppShell = ({ activeNav, setActiveNav, onLogout, userRole, userEmail, children }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(true);
  
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };
  
  const confirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };
  
  // Define which navigation items each role can see
  const canViewAnalytics = userRole === 'ADMIN';
  const canViewUsers = userRole === 'ADMIN';
  const canViewLogs = userRole === 'ADMIN' || userRole === 'AUDITOR';
  const canViewBuilds = true; // All users can view builds
  
  const hasAdminOperations = canViewAnalytics || canViewUsers || canViewLogs;
  
  // Format role name for display
  const getRoleName = (role) => {
    const roleNames = {
      'ADMIN': 'Administrator',
      'SOLUTION_PROVIDER': 'Solution Provider',
      'DATA_OWNER': 'Data Owner',
      'AUDITOR': 'Auditor',
      'ENV_OPERATOR': 'Environment Operator',
      'VIEWER': 'Viewer'
    };
    return roleNames[role] || role;
  };
  
  // Get username from email
  const getUsername = (email) => {
    return email.split('@')[0].replace(/\./g, ' ').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Get persona icon
  const getPersonaIcon = (role) => {
    const icons = {
      'ADMIN': UserAdmin,
      'SOLUTION_PROVIDER': Application,
      'DATA_OWNER': DataBase,
      'AUDITOR': Security,
      'ENV_OPERATOR': CloudApp,
      'VIEWER': View
    };
    const IconComponent = icons[role] || UserAvatar;
    return <IconComponent size={20} />;
  };
  
  return (
    <>
      <Theme theme="g100">
        {/* Custom Title Bar */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'rgba(22, 22, 22, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          WebkitAppRegion: 'drag',
          zIndex: 10000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <HyperProtectIcon size={18} />
            <span style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 500,
              letterSpacing: '0.02em'
            }}>
              HPCR Contract Builder
            </span>
          </div>
          
          {/* Window Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            WebkitAppRegion: 'no-drag'
          }}>
            <button
              onClick={() => window.electron?.minimizeWindow?.()}
              style={{
                background: 'transparent',
                border: 'none',
                width: '46px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)',
                transition: 'all 0.2s ease',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              title="Minimize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => window.electron?.maximizeWindow?.()}
              style={{
                background: 'transparent',
                border: 'none',
                width: '46px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)',
                transition: 'all 0.2s ease',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              title="Maximize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
              </svg>
            </button>
            <button
              onClick={() => window.electron?.closeWindow?.()}
              style={{
                background: 'transparent',
                border: 'none',
                width: '46px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)',
                transition: 'all 0.2s ease',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#da1e28';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <Header aria-label="IBM Confidential Computing Contract Builder" style={{ WebkitAppRegion: 'drag', marginTop: '40px' }}>
          <HeaderMenuButton
            aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
            onClick={() => setIsSideNavExpanded(!isSideNavExpanded)}
            isActive={isSideNavExpanded}
            style={{ WebkitAppRegion: 'no-drag' }}
          />
          <HeaderName href="#" prefix="IBM" style={{ WebkitAppRegion: 'no-drag' }}>
            Confidential Computing Contract Builder v1.0
          </HeaderName>
          <HeaderGlobalBar>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              paddingRight: '1rem',
              color: 'var(--cds-text-secondary)',
              fontSize: '0.875rem',
              WebkitAppRegion: 'no-drag'
            }}>
              {getPersonaIcon(userRole)}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 600, color: 'var(--cds-text-primary)' }}>
                  {getUsername(userEmail)}
                </span>
                <span style={{ fontSize: '0.75rem' }}>
                  {getRoleName(userRole)}
                </span>
              </div>
            </div>
          </HeaderGlobalBar>
        </Header>
        
        <SideNav
          isFixedNav
          expanded={isSideNavExpanded}
          isChildOfHeader={true}
          aria-label="Side navigation"
          style={{ height: 'calc(100vh - 3rem - 40px)', top: 'calc(3rem + 40px)' }}
        >
          <SideNavItems style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Home - visible to all users except VIEWER */}
            {userRole !== 'VIEWER' && (
              <SideNavMenuItem
                renderIcon={Home}
                isActive={activeNav === 'HOME'}
                onClick={() => setActiveNav('HOME')}
              >
                Home
              </SideNavMenuItem>
            )}
            
            {/* Build Management - visible to all users */}
            <SideNavMenuItem
              renderIcon={Catalog}
              isActive={activeNav === 'BUILDS'}
              onClick={() => setActiveNav('BUILDS')}
            >
              Build Management
            </SideNavMenuItem>
            
            {/* Admin Operations - only for admin and auditor */}
            {hasAdminOperations && (
              <SideNavMenu title="Admin Operations" defaultExpanded>
                {canViewAnalytics && (
                  <SideNavMenuItem
                    renderIcon={ChartLine}
                    isActive={activeNav === 'ANALYTICS'}
                    onClick={() => setActiveNav('ANALYTICS')}
                  >
                    Diagnostics & Analytics
                  </SideNavMenuItem>
                )}
                {canViewUsers && (
                  <SideNavMenuItem
                    renderIcon={UserMultiple}
                    isActive={activeNav === 'USERS'}
                    onClick={() => setActiveNav('USERS')}
                  >
                    User Management
                  </SideNavMenuItem>
                )}
                {canViewLogs && (
                  <SideNavMenuItem
                    renderIcon={DocumentTasks}
                    isActive={activeNav === 'LOGS'}
                    onClick={() => setActiveNav('LOGS')}
                  >
                    System Logs
                  </SideNavMenuItem>
                )}
              </SideNavMenu>
            )}
            
            {/* Spacer to push Account menu to bottom */}
            <div style={{ flex: '1 1 auto' }} />
            
            {/* Account menu at bottom */}
            <div style={{ borderTop: '1px solid var(--cds-border-subtle)', paddingTop: '1rem' }}>
              <SideNavMenu renderIcon={Settings} title="Account">
                <SideNavMenuItem onClick={() => setActiveNav('SETTINGS')}>
                  Settings
                </SideNavMenuItem>
                <SideNavMenuItem onClick={handleLogoutClick}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Logout size={16} />
                    Logout
                  </div>
                </SideNavMenuItem>
              </SideNavMenu>
            </div>
          </SideNavItems>
        </SideNav>
      </Theme>

      <main style={{
        marginTop: 'calc(3rem + 40px)',
        marginLeft: isSideNavExpanded ? '16rem' : '3rem',
        height: 'calc(100vh - 3rem - 40px)',
        backgroundColor: 'var(--cds-background)',
        overflowY: 'auto',
        transition: 'margin-left 110ms cubic-bezier(0.2, 0, 1, 0.9)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: '1 0 auto', padding: '2rem' }}>
          {children}
        </div>
        <footer style={{
          padding: '1rem 2rem',
          backgroundColor: 'var(--cds-layer)',
          borderTop: '1px solid var(--cds-border-subtle)',
          color: 'var(--cds-text-secondary)',
          fontSize: '0.75rem',
          textAlign: 'center',
          flexShrink: 0
        }}>
          Powered by IBM Confidential Computing
        </footer>
      </main>
      
      <Modal
        open={showLogoutModal}
        modalHeading="Confirm Logout"
        primaryButtonText="Logout"
        secondaryButtonText="Cancel"
        onRequestClose={() => setShowLogoutModal(false)}
        onRequestSubmit={confirmLogout}
        danger
      >
        <p>Are you sure you want to logout? Any unsaved changes will be lost.</p>
      </Modal>
    </>
  );
};

export default AppShell;

import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderMenuButton,
  Theme,
  SideNav,
  SideNavItems,
  SideNavMenuItem,
  SideNavMenu,
  Modal,
  MenuButton,
  MenuItem
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
  Help
} from '@carbon/icons-react';
import DesktopTitleBar from './DesktopTitleBar';
import FeatureHelp from './FeatureHelp';
import { getRoleLabel, sortRolesByPriority } from '../utils/roles';

const AppShell = ({
  activeNav,
  setActiveNav,
  onLogout,
  userRole,
  userRoles = [],
  userEmail,
  onRoleChange,
  children
}) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(true);
  const [showFeatureHelp, setShowFeatureHelp] = useState(false);
  
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };
  
  const confirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };
  
  // Define which navigation items each role can see
  const availableRoles = sortRolesByPriority(
    Array.from(new Set((userRoles.length > 0 ? userRoles : [userRole]).filter(Boolean)))
  );
  const activeRole = userRole;
  const isAdmin = activeRole === 'ADMIN';
  const isAuditor = activeRole === 'AUDITOR';
  const canViewAnalytics = isAdmin;
  const canViewUsers = isAdmin;
  const canViewLogs = isAdmin || isAuditor;

  const hasAdminOperations = canViewAnalytics || canViewUsers || canViewLogs;
  
  // Get username from email
  const getUsername = (email) => {
    if (!email) return 'User';
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

  const handleRoleChange = (nextRole) => {
    if (!nextRole || nextRole === activeRole || typeof onRoleChange !== 'function') return;
    onRoleChange(nextRole);
  };
  
  return (
    <>
      <Theme theme="g100">
        <DesktopTitleBar
          zIndex={10000}
          showConnectionStatus
          enableConnectionWatcher
        />

        <Header aria-label="IBM Confidential Computing Contract Builder" className="app-shell-header">
          <HeaderMenuButton
            aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
            onClick={() => setIsSideNavExpanded(!isSideNavExpanded)}
            isActive={isSideNavExpanded}
            className="app-shell-no-drag"
          />
          <HeaderName href="#" prefix="IBM" className="app-shell-no-drag">
            <span className="app-shell-header-title">Confidential Computing Contract Builder v1.0</span>
          </HeaderName>
          <HeaderGlobalBar className="app-shell-header-global">
            <div className="app-shell-user-chip app-shell-no-drag">
              <div className="app-shell-user-chip__avatar">
                {getPersonaIcon(activeRole)}
              </div>
              <span className="app-shell-user-chip__name" title={userEmail}>
                {getUsername(userEmail)}
              </span>
              <MenuButton
                kind="ghost"
                size="sm"
                label={getRoleLabel(activeRole)}
                menuAlignment="bottom-end"
                className="app-shell-role-menu-button"
                disabled={availableRoles.length <= 1}
              >
                {availableRoles.map((role) => (
                  <MenuItem
                    key={role}
                    label={`${getRoleLabel(role)}${role === activeRole ? ' (Current)' : ''}`}
                    disabled={role === activeRole}
                    onClick={() => handleRoleChange(role)}
                  />
                ))}
              </MenuButton>
            </div>
          </HeaderGlobalBar>
        </Header>
        
        <SideNav
          isFixedNav
          expanded={isSideNavExpanded}
          isChildOfHeader={true}
          aria-label="Side navigation"
          className="app-shell-sidenav"
        >
          <SideNavItems className="app-shell-sidenav-items">
            <SideNavMenuItem
              isActive={activeNav === 'HOME'}
              onClick={() => setActiveNav('HOME')}
            >
              <Home size={16} className="app-shell-nav-icon" />
              Home
            </SideNavMenuItem>
            
            {/* Build Management - visible to all users */}
            <SideNavMenuItem
              isActive={activeNav === 'BUILDS'}
              onClick={() => setActiveNav('BUILDS')}
            >
              <Catalog size={16} className="app-shell-nav-icon" />
              Build Management
            </SideNavMenuItem>
            
            {/* Admin Operations - only for admin and auditor */}
            {hasAdminOperations && (
              <SideNavMenu title="Admin Operations" defaultExpanded>
                {canViewAnalytics && (
                  <SideNavMenuItem
                    isActive={activeNav === 'ANALYTICS'}
                    onClick={() => setActiveNav('ANALYTICS')}
                  >
                    <ChartLine size={16} className="app-shell-nav-icon" />
                    Diagnostics & Analytics
                  </SideNavMenuItem>
                )}
                {canViewUsers && (
                  <SideNavMenuItem
                    isActive={activeNav === 'USERS'}
                    onClick={() => setActiveNav('USERS')}
                  >
                    <UserMultiple size={16} className="app-shell-nav-icon" />
                    User Management
                  </SideNavMenuItem>
                )}
                {canViewLogs && (
                  <SideNavMenuItem
                    isActive={activeNav === 'LOGS'}
                    onClick={() => setActiveNav('LOGS')}
                  >
                    <DocumentTasks size={16} className="app-shell-nav-icon" />
                    System Logs
                  </SideNavMenuItem>
                )}
              </SideNavMenu>
            )}
            
            {/* Spacer to push Account menu to bottom */}
            <div className="app-shell-sidenav-spacer" />
            
            {/* Account menu at bottom */}
            <div className="app-shell-account-menu">
              <SideNavMenu renderIcon={Settings} title="Account">
                <SideNavMenuItem onClick={() => setActiveNav('SETTINGS')}>
                  Settings
                </SideNavMenuItem>
                <SideNavMenuItem onClick={() => setShowFeatureHelp(true)}>
                  <div className="app-shell-logout-row">
                    <Help size={16} />
                    Feature Help
                  </div>
                </SideNavMenuItem>
                <SideNavMenuItem onClick={handleLogoutClick}>
                  <div className="app-shell-logout-row">
                    <Logout size={16} />
                    Logout
                  </div>
                </SideNavMenuItem>
              </SideNavMenu>
            </div>
          </SideNavItems>
        </SideNav>
      </Theme>

      <main className={`app-shell-main ${isSideNavExpanded ? 'app-shell-main--expanded' : 'app-shell-main--collapsed'}`}>
        <div className="app-shell-content">
          {children}
        </div>
        <footer className="app-shell-footer">
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

      <FeatureHelp
        open={showFeatureHelp}
        onClose={() => setShowFeatureHelp(false)}
      />
    </>
  );
};

export default AppShell;

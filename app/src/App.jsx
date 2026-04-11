import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from './components/AppShell';
import Home from './views/Home';
import BuildManagement from './views/BuildManagement';
import BuildDetails from './views/BuildDetails';
import AdminAnalytics from './views/AdminAnalytics';
import UserManagement from './views/UserManagement';
import AccountSettings from './views/AccountSettings';
import SystemLogs from './views/SystemLogs';
import Login from './views/Login';
import NotFound from './views/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastManager';
import { PERSONAS } from './store/mockData';
import buildService from './services/buildService';
import { useAuthStore } from './store/authStore';
import { getPrimaryRole, ROLE_LABELS } from './utils/roles';
import { ProgressBar, Theme, Modal } from '@carbon/react';
import '@carbon/charts/styles.css';

const ROLE_PERSONA_MAP = {
  'ADMIN': PERSONAS.ADMIN,
  'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
  'DATA_OWNER': PERSONAS.DATA_OWNER,
  'AUDITOR': PERSONAS.AUDITOR,
  'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
  'VIEWER': PERSONAS.VIEWER
};

const normalizeRoles = (roles = []) => {
  if (!Array.isArray(roles)) return [];

  return Array.from(
    new Set(
      roles
        .map((role) => (typeof role === 'string' ? role : (role?.role_name || role?.name || '')))
        .filter(Boolean)
    )
  );
};

const getSafeStoredRoles = (rolesJson, role) => {
  if (!rolesJson) return role ? [role] : ['VIEWER'];
  try {
    const parsed = JSON.parse(rolesJson);
    const normalized = normalizeRoles(parsed);
    return normalized.length > 0 ? normalized : (role ? [role] : ['VIEWER']);
  } catch {
    return role ? [role] : ['VIEWER'];
  }
};

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userRole, setUserRole] = useState('ADMIN');
  const [userRoles, setUserRoles] = useState(['ADMIN']);
  const [userEmail, setUserEmail] = useState('');

  const [activePersona, setActivePersona] = useState(PERSONAS.ADMIN);
  const [activeNav, setActiveNav] = useState('HOME'); // Default to home for all users
  const [builds, setBuilds] = useState([]);
  const [selectedBuildId, setSelectedBuildId] = useState(null);
  const setupRequired = useAuthStore((state) => state.isSetupRequired());

  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole('ADMIN');
    setUserRoles(['ADMIN']);
    setUserEmail('');
    setActivePersona(PERSONAS.ADMIN);
    setActiveNav('HOME');
    setBuilds([]);
    setSelectedBuildId(null);
    setShowWelcomeModal(false);
  }, []);

  const applyStoredAuthState = useCallback(({ role, rolesJson, email }) => {
    const roles = getSafeStoredRoles(rolesJson, role);
    const primaryRole = getPrimaryRole(roles);
    const effectiveRole = roles.includes(role) ? role : primaryRole;

    setUserRoles(roles);
    setUserRole(effectiveRole);
    setActivePersona(ROLE_PERSONA_MAP[effectiveRole] || PERSONAS.ADMIN);
    setActiveNav('HOME');
    setUserEmail(email || '');
  }, []);

  useEffect(() => {
    // Clear any stale session data on mount
    const sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      // New session - clear localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_email');
      // Set new session ID
      sessionStorage.setItem('session_id', Date.now().toString());
    }
    
    // Initial Auth Check
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    const rolesJson = localStorage.getItem('user_roles');
    const email = localStorage.getItem('user_email');

    if (token) {
      setIsAuthenticated(true);
      applyStoredAuthState({ role, rolesJson, email });
    }
    
    // Cleanup on unmount (app close)
    return () => {
      // Clear session storage
      sessionStorage.clear();
    };
  }, [applyStoredAuthState]);

  useEffect(() => {
    const onForcedLogout = () => {
      resetAuthState();
    };

    window.addEventListener('auth:forced-logout', onForcedLogout);
    return () => window.removeEventListener('auth:forced-logout', onForcedLogout);
  }, [resetAuthState]);

  useEffect(() => {
    const onSessionUpdated = (event) => {
      const detail = event?.detail || {};
      const roleFromStorage = detail.role || localStorage.getItem('user_role');
      const rolesJson = detail.rolesJson || localStorage.getItem('user_roles');
      const email = detail.email || localStorage.getItem('user_email') || '';
      const roles = getSafeStoredRoles(rolesJson, roleFromStorage);
      const nextRole = roles.includes(roleFromStorage) ? roleFromStorage : getPrimaryRole(roles);

      setUserRoles(roles);
      setUserRole(nextRole);
      setActivePersona(ROLE_PERSONA_MAP[nextRole] || PERSONAS.VIEWER);
      setUserEmail(email);
      setSelectedBuildId(null);

      const canAccessAnalytics = nextRole === 'ADMIN';
      const canAccessUsers = nextRole === 'ADMIN';
      const canAccessLogs = nextRole === 'ADMIN' || nextRole === 'AUDITOR';
      const blockedAdminPage =
        (activeNav === 'ANALYTICS' && !canAccessAnalytics) ||
        (activeNav === 'USERS' && !canAccessUsers) ||
        (activeNav === 'LOGS' && !canAccessLogs);

      if (blockedAdminPage) {
        setActiveNav('HOME');
      }
    };

    window.addEventListener('auth:session-updated', onSessionUpdated);
    return () => window.removeEventListener('auth:session-updated', onSessionUpdated);
  }, [activeNav]);

  const loadBuilds = useCallback(async () => {
    if (setupRequired) {
      setBuilds([]);
      return;
    }
    const token = useAuthStore.getState().token;
    if (!token) {
      setBuilds([]);
      return;
    }
    try {
      const builds = await buildService.getBuilds();
      setBuilds(builds || []);
    } catch (error) {
      console.error('Failed to load builds:', error);
      setBuilds([]);
    }
  }, [setupRequired]);

  // Load builds when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadBuilds();
    }
  }, [isAuthenticated, loadBuilds]);

  useEffect(() => {
    if (setupRequired && activeNav !== 'SETTINGS') {
      setActiveNav('SETTINGS');
    }
  }, [setupRequired, activeNav]);

  useEffect(() => {
    if (!isBooting) return;
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress > 100) progress = 100;
      
      setBootProgress(progress);

      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 500); 
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isBooting]);

  const advanceBuildState = useCallback((buildId, newState) => {
    setBuilds(prev => prev.map(b => 
      b.id === buildId ? { ...b, status: newState } : b
    ));
  }, []);

  const handleLogin = useCallback((isFreshLogin) => {
    const role = localStorage.getItem('user_role');
    const rolesJson = localStorage.getItem('user_roles');
    const email = localStorage.getItem('user_email');

    setIsAuthenticated(true);
    applyStoredAuthState({ role, rolesJson, email });
    if (isFreshLogin) setShowWelcomeModal(true);
  }, [applyStoredAuthState]);

  const handleLogout = useCallback(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    resetAuthState();
  }, [resetAuthState]);

  const handleRoleChange = useCallback((nextRole) => {
    if (!nextRole || !userRoles.includes(nextRole)) return;

    localStorage.setItem('user_role', nextRole);
    setUserRole(nextRole);
    setActivePersona(ROLE_PERSONA_MAP[nextRole] || PERSONAS.VIEWER);
    setSelectedBuildId(null);

    const canAccessAnalytics = nextRole === 'ADMIN';
    const canAccessUsers = nextRole === 'ADMIN';
    const canAccessLogs = nextRole === 'ADMIN' || nextRole === 'AUDITOR';
    const blockedAdminPage =
      (activeNav === 'ANALYTICS' && !canAccessAnalytics) ||
      (activeNav === 'USERS' && !canAccessUsers) ||
      (activeNav === 'LOGS' && !canAccessLogs);

    if (blockedAdminPage) {
      setActiveNav('HOME');
    }
  }, [activeNav, userRoles]);

  const selectedBuild = useMemo(
    () => builds.find(b => b.id === selectedBuildId),
    [builds, selectedBuildId]
  );
  const handleSelectBuild = useCallback((buildId) => setSelectedBuildId(buildId), []);
  const handleBackToBuilds = useCallback(() => setSelectedBuildId(null), []);

  const activeView = useMemo(() => {
    if (activeNav === 'HOME') {
      return (
        <Home
        userEmail={userEmail}
        userRole={userRole}
        onNavigate={setActiveNav}
        onSelectBuild={handleSelectBuild}
        />
      );
    }
    if (activeNav === 'ANALYTICS') return <AdminAnalytics />;
    if (activeNav === 'USERS') return <UserManagement />;
    if (activeNav === 'LOGS') return <SystemLogs />;
    if (activeNav === 'SETTINGS') return <AccountSettings />;
    
    if (activeNav === 'BUILDS') {
       if (selectedBuildId && selectedBuild) {
          return (
            <BuildDetails
              build={selectedBuild}
              onBack={handleBackToBuilds}
              activePersona={activePersona}
              userRole={userRole}
              advanceBuildState={advanceBuildState}
            />
          );
       }
       return <BuildManagement builds={builds} onSelectBuild={handleSelectBuild} userRole={userRole} onBuildCreated={loadBuilds} />;
    }
    
    // Default to 404 page for unknown routes
    return <NotFound onNavigate={setActiveNav} />;
  }, [
    activeNav,
    userEmail,
    userRole,
    selectedBuildId,
    selectedBuild,
    activePersona,
    userRoles,
    builds,
    loadBuilds,
    advanceBuildState,
    handleBackToBuilds,
    handleSelectBuild
  ]);

  const welcomeMessage = useMemo(
    () => `Welcome Back, ${ROLE_LABELS[userRole] || 'User'}`,
    [userRole]
  );

  if (isBooting) {
    return (
      <Theme theme="g100">
        <div className="app-boot-screen">
          <h1 className="app-boot-screen__title">IBM <br /> Confidential Computing Contract Builder</h1>
          <div className="app-boot-screen__progress">
            <ProgressBar label="Loading" value={bootProgress} max={100} />
          </div>
        </div>
      </Theme>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell
           activeNav={activeNav}
           setActiveNav={setActiveNav}
           onLogout={handleLogout}
           userRole={userRole}
           userRoles={userRoles}
           userEmail={userEmail}
           onRoleChange={handleRoleChange}
        >
          <Modal
            open={showWelcomeModal}
            modalHeading={welcomeMessage}
            primaryButtonText="Get Started"
            onRequestSubmit={() => setShowWelcomeModal(false)}
            onRequestClose={() => setShowWelcomeModal(false)}
          >
            <p className="app-welcome-copy">
              You have successfully authenticated into the IBM Confidential Computing Contract Builder. Your cryptographic identity has been verified and active workflows are ready for review.
            </p>
          </Modal>
          {activeView}
        </AppShell>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

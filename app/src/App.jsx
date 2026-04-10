import React, { useState, useEffect } from 'react';
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
import { ToastProvider, useToast } from './components/ToastManager';
import { PERSONAS } from './store/mockData';
import buildService from './services/buildService';
import { useAuthStore } from './store/authStore';
import { ProgressBar, Theme, Modal } from '@carbon/react';
import '@carbon/charts/styles.css';

// Priority order — highest privilege wins for persona/nav decisions
const ROLE_PRIORITY = ['ADMIN', 'AUDITOR', 'ENV_OPERATOR', 'SOLUTION_PROVIDER', 'DATA_OWNER', 'VIEWER'];
const getPrimaryRole = (roles) => ROLE_PRIORITY.find(r => roles.includes(r)) || roles[0] || 'VIEWER';

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
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [selectedBuildId, setSelectedBuildId] = useState(null);
  const setupRequired = useAuthStore((state) => state.isSetupRequired());

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
      const roles = rolesJson ? JSON.parse(rolesJson) : (role ? [role] : ['VIEWER']);
      const primaryRole = getPrimaryRole(roles);
      setUserRoles(roles);
      setUserRole(primaryRole);
      const personaMap = {
        'ADMIN': PERSONAS.ADMIN,
        'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
        'DATA_OWNER': PERSONAS.DATA_OWNER,
        'AUDITOR': PERSONAS.AUDITOR,
        'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
        'VIEWER': PERSONAS.VIEWER
      };
      setActivePersona(personaMap[primaryRole] || PERSONAS.ADMIN);
      setActiveNav(primaryRole === 'VIEWER' && roles.length === 1 ? 'BUILDS' : 'HOME');
      if (email) setUserEmail(email);
    }
    
    // Cleanup on unmount (app close)
    return () => {
      // Clear session storage
      sessionStorage.clear();
    };
  }, []);

  useEffect(() => {
    const onForcedLogout = () => {
      setIsAuthenticated(false);
      setUserRole('ADMIN');
      setUserRoles(['ADMIN']);
      setUserEmail('');
      setActivePersona(PERSONAS.ADMIN);
      setActiveNav('HOME');
      setBuilds([]);
      setSelectedBuildId(null);
      setShowWelcomeModal(false);
    };

    window.addEventListener('auth:forced-logout', onForcedLogout);
    return () => window.removeEventListener('auth:forced-logout', onForcedLogout);
  }, []);

  const loadBuilds = async () => {
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
      setBuildsLoading(true);
      const builds = await buildService.getBuilds();
      setBuilds(builds || []);
    } catch (error) {
      console.error('Failed to load builds:', error);
      setBuilds([]);
    } finally {
      setBuildsLoading(false);
    }
  };

  // Load builds when authenticated
  useEffect(() => {
    if (isAuthenticated) loadBuilds();
  }, [isAuthenticated, setupRequired]);

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

  const advanceBuildState = (buildId, newState) => {
    setBuilds(prev => prev.map(b => 
      b.id === buildId ? { ...b, status: newState } : b
    ));
  };

  const handleLogin = (isFreshLogin) => {
    const role = localStorage.getItem('user_role');
    const rolesJson = localStorage.getItem('user_roles');
    const email = localStorage.getItem('user_email');

    setIsAuthenticated(true);
    const roles = rolesJson ? JSON.parse(rolesJson) : (role ? [role] : ['VIEWER']);
    const primaryRole = getPrimaryRole(roles);
    setUserRoles(roles);
    setUserRole(primaryRole);
    const personaMap = {
      'ADMIN': PERSONAS.ADMIN,
      'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
      'DATA_OWNER': PERSONAS.DATA_OWNER,
      'AUDITOR': PERSONAS.AUDITOR,
      'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
      'VIEWER': PERSONAS.VIEWER
    };
    setActivePersona(personaMap[primaryRole] || PERSONAS.ADMIN);
    setActiveNav(primaryRole === 'VIEWER' && roles.length === 1 ? 'BUILDS' : 'HOME');
    if (email) setUserEmail(email);
    if (isFreshLogin) setShowWelcomeModal(true);
  };

  const handleLogout = () => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset state
    setIsAuthenticated(false);
    setUserRole('ADMIN');
    setUserRoles(['ADMIN']);
    setUserEmail('');
    setActivePersona(PERSONAS.ADMIN);
    setActiveNav('HOME');
    setBuilds([]);
    setSelectedBuildId(null);
  };

  const selectedBuild = builds.find(b => b.id === selectedBuildId);

  const renderActiveView = () => {
    if (setupRequired && activeNav !== 'SETTINGS') {
      setActiveNav('SETTINGS');
      return null;
    }
    // Redirect pure VIEWERs from HOME to BUILDS
    if (activeNav === 'HOME' && userRoles.length <= 1 && userRole === 'VIEWER') {
      setActiveNav('BUILDS');
      return null;
    }
    
    if (activeNav === 'HOME') {
      return <Home
        userEmail={userEmail}
        userRole={userRole}
        onNavigate={setActiveNav}
        onSelectBuild={(buildId) => setSelectedBuildId(buildId)}
      />;
    }
    if (activeNav === 'ANALYTICS') return <AdminAnalytics />;
    if (activeNav === 'USERS') return <UserManagement />;
    if (activeNav === 'LOGS') return <SystemLogs />;
    if (activeNav === 'SETTINGS') return <AccountSettings userRole={userRole} />;
    
    if (activeNav === 'BUILDS') {
       if (selectedBuildId && selectedBuild) {
          return (
            <BuildDetails
              build={selectedBuild}
              onBack={() => setSelectedBuildId(null)}
              activePersona={activePersona}
              userRole={userRole}
              userRoles={userRoles}
              advanceBuildState={advanceBuildState}
            />
          );
       }
       return <BuildManagement builds={builds} onSelectBuild={(buildId) => setSelectedBuildId(buildId)} userRole={userRole} userRoles={userRoles} onBuildCreated={loadBuilds} />;
    }
    
    // Default to 404 page for unknown routes
    return <NotFound onNavigate={setActiveNav} />;
  };

  if (isBooting) {
    return (
      <Theme theme="g100">
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--cds-background)', color: 'var(--cds-text-primary)'}}>
          <h1 style={{ marginBottom: '1.5rem', fontWeight: 300, letterSpacing: '0.5px', textAlign: 'center' }}>IBM <br /> Confidential Computing Contract Builder</h1>
          <div style={{ width: '400px' }}>
            <ProgressBar label="Loading" value={bootProgress} max={100} />
          </div>
        </div>
      </Theme>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const getWelcomeMessage = () => {
    const roleNames = {
      'ADMIN': 'Administrator',
      'SOLUTION_PROVIDER': 'Solution Provider',
      'DATA_OWNER': 'Data Owner',
      'AUDITOR': 'Auditor',
      'ENV_OPERATOR': 'Environment Operator',
      'VIEWER': 'Viewer'
    };
    return `Welcome Back, ${roleNames[userRole] || 'User'}`;
  };

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
        >
          <Modal
            open={showWelcomeModal}
            modalHeading={getWelcomeMessage()}
            primaryButtonText="Get Started"
            onRequestSubmit={() => setShowWelcomeModal(false)}
            onRequestClose={() => setShowWelcomeModal(false)}
          >
            <p style={{ marginBottom: '1rem' }}>
              You have successfully authenticated into the IBM Confidential Computing Contract Builder. Your cryptographic identity has been verified and active workflows are ready for review.
            </p>
          </Modal>
          {renderActiveView()}
        </AppShell>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

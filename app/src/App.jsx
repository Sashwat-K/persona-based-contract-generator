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
import { initialBuilds, PERSONAS } from './store/mockData';
import { ProgressBar, Theme, Modal } from '@carbon/react';
import '@carbon/charts/styles.css';

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userRole, setUserRole] = useState('ADMIN');
  const [userEmail, setUserEmail] = useState('');

  const [activePersona, setActivePersona] = useState(PERSONAS.ADMIN);
  const [activeNav, setActiveNav] = useState('HOME'); // Default to home for all users
  const [builds, setBuilds] = useState(initialBuilds);
  const [selectedBuildId, setSelectedBuildId] = useState(null);

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
    const email = localStorage.getItem('user_email');
    
    if (token) {
      setIsAuthenticated(true);
      if (role) {
        setUserRole(role);
        // Map role to persona
        const personaMap = {
          'ADMIN': PERSONAS.ADMIN,
          'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
          'DATA_OWNER': PERSONAS.DATA_OWNER,
          'AUDITOR': PERSONAS.AUDITOR,
          'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
          'VIEWER': PERSONAS.VIEWER
        };
        setActivePersona(personaMap[role] || PERSONAS.ADMIN);
        
        // Set default navigation based on role
        if (role === 'VIEWER') {
          setActiveNav('BUILDS');
        } else {
          setActiveNav('HOME');
        }
      }
      if (email) {
        setUserEmail(email);
      }
    }
    
    // Cleanup on unmount (app close)
    return () => {
      // Clear session storage
      sessionStorage.clear();
    };
  }, []);

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
    const email = localStorage.getItem('user_email');
    
    setIsAuthenticated(true);
    if (role) {
      setUserRole(role);
      const personaMap = {
        'ADMIN': PERSONAS.ADMIN,
        'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
        'DATA_OWNER': PERSONAS.DATA_OWNER,
        'AUDITOR': PERSONAS.AUDITOR,
        'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
        'VIEWER': PERSONAS.VIEWER
      };
      setActivePersona(personaMap[role] || PERSONAS.ADMIN);
      
      // Set default navigation based on role
      if (role === 'VIEWER') {
        setActiveNav('BUILDS');
      } else {
        setActiveNav('HOME');
      }
    }
    if (email) {
      setUserEmail(email);
    }
    
    if (isFreshLogin) {
      setShowWelcomeModal(true);
    }
  };

  const handleLogout = () => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset state
    setIsAuthenticated(false);
    setUserRole('ADMIN');
    setUserEmail('');
    setActivePersona(PERSONAS.ADMIN);
    setActiveNav('HOME');
    setBuilds(initialBuilds);
    setSelectedBuildId(null);
  };

  const selectedBuild = builds.find(b => b.id === selectedBuildId);

  const renderActiveView = () => {
    // Redirect VIEWER from HOME to BUILDS
    if (activeNav === 'HOME' && userRole === 'VIEWER') {
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
              advanceBuildState={advanceBuildState}
            />
          );
       }
       return <BuildManagement builds={builds} onSelectBuild={(buildId) => setSelectedBuildId(buildId)} userRole={userRole} />;
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
    <AppShell
       activeNav={activeNav}
       setActiveNav={setActiveNav}
       onLogout={handleLogout}
       userRole={userRole}
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
  );
}

export default App;

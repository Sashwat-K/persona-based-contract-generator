import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, Search, Tag } from '@carbon/react';
import {
  Home,
  Catalog,
  User,
  Document,
  Settings,
  Add,
  Download,
  Renew,
  Filter,
  Logout,
  Light,
  Keyboard,
  Book,
  Email,
  UserMultiple
} from '@carbon/icons-react';

/**
 * Command Palette Component
 * Universal command palette for quick access to all application actions
 * Activated with Ctrl+K
 */
const CommandPalette = ({ 
  open, 
  onClose, 
  userRole,
  currentView,
  onAction 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState([]);
  const searchInputRef = useRef(null);

  // Load recent actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recent_actions');
    if (stored) {
      try {
        setRecentActions(JSON.parse(stored));
      } catch (e) {
        setRecentActions([]);
      }
    }
  }, []);

  // Define all available actions
  const allActions = useMemo(() => {
    const actions = [
      // Navigation
      {
        id: 'nav-home',
        label: 'Go to Home',
        category: 'Navigation',
        icon: Home,
        keywords: ['home', 'dashboard', 'main'],
        action: () => onAction('navigate', '/'),
      },
      {
        id: 'nav-builds',
        label: 'Go to Build Management',
        category: 'Navigation',
        icon: Catalog,
        keywords: ['builds', 'contracts', 'management'],
        action: () => onAction('navigate', 'BUILDS'),
      },
      {
        id: 'nav-users',
        label: 'Go to User Management',
        category: 'Navigation',
        icon: UserMultiple,
        keywords: ['users', 'accounts', 'management'],
        roles: ['ADMIN'],
        action: () => onAction('navigate', 'USERS'),
      },
      {
        id: 'nav-logs',
        label: 'Go to System Logs',
        category: 'Navigation',
        icon: Document,
        keywords: ['logs', 'audit', 'history'],
        roles: ['ADMIN', 'AUDITOR'],
        action: () => onAction('navigate', 'LOGS'),
      },
      {
        id: 'nav-settings',
        label: 'Go to Account Settings',
        category: 'Navigation',
        icon: Settings,
        keywords: ['settings', 'account', 'profile', 'preferences'],
        action: () => onAction('navigate', 'SETTINGS'),
      },

      // Build Actions
      {
        id: 'build-new',
        label: 'Create New Build',
        category: 'Build Actions',
        icon: Add,
        keywords: ['create', 'new', 'build', 'contract'],
        roles: ['ADMIN', 'AUDITOR'],
        context: ['BUILDS'],
        action: () => onAction('createBuild'),
      },
      {
        id: 'build-refresh',
        label: 'Refresh Builds',
        category: 'Build Actions',
        icon: Renew,
        keywords: ['refresh', 'reload', 'update'],
        context: ['BUILDS'],
        action: () => onAction('refreshBuilds'),
      },
      {
        id: 'build-filter',
        label: 'Toggle Filters',
        category: 'Build Actions',
        icon: Filter,
        keywords: ['filter', 'search', 'toggle'],
        context: ['BUILDS'],
        action: () => onAction('toggleFilters'),
      },
      {
        id: 'build-export',
        label: 'Export Builds to CSV',
        category: 'Build Actions',
        icon: Download,
        keywords: ['export', 'download', 'csv'],
        context: ['BUILDS'],
        action: () => onAction('exportBuilds'),
      },

      // User Actions
      {
        id: 'user-new',
        label: 'Create New User',
        category: 'User Actions',
        icon: Add,
        keywords: ['create', 'new', 'user', 'account'],
        roles: ['ADMIN'],
        context: ['USERS'],
        action: () => onAction('createUser'),
      },
      {
        id: 'user-profile',
        label: 'View My Profile',
        category: 'User Actions',
        icon: User,
        keywords: ['profile', 'account', 'me', 'settings'],
        action: () => onAction('navigate', 'SETTINGS'),
      },
      {
        id: 'user-logout',
        label: 'Logout',
        category: 'User Actions',
        icon: Logout,
        keywords: ['logout', 'sign out', 'exit'],
        action: () => onAction('logout'),
      },

      // Settings
      {
        id: 'settings-theme',
        label: 'Toggle Theme',
        category: 'Settings',
        icon: Light,
        keywords: ['theme', 'dark', 'light', 'mode'],
        action: () => onAction('toggleTheme'),
      },
      {
        id: 'settings-shortcuts',
        label: 'View Keyboard Shortcuts',
        category: 'Settings',
        icon: Keyboard,
        keywords: ['shortcuts', 'keyboard', 'help', 'keys'],
        action: () => onAction('showShortcuts'),
      },

      // Help
      {
        id: 'help-docs',
        label: 'Open Documentation',
        category: 'Help',
        icon: Book,
        keywords: ['docs', 'documentation', 'help', 'guide'],
        action: () => onAction('openDocs'),
      },
      {
        id: 'help-support',
        label: 'Contact Support',
        category: 'Help',
        icon: Email,
        keywords: ['support', 'help', 'contact', 'email'],
        action: () => onAction('contactSupport'),
      },
    ];

    // Filter by role and context
    return actions.filter(action => {
      // Check role permission
      if (action.roles && !action.roles.includes(userRole)) {
        return false;
      }
      // Check context (if specified, only show in that view)
      if (action.context && !action.context.includes(currentView)) {
        return false;
      }
      return true;
    });
  }, [userRole, currentView, onAction]);

  // Fuzzy search implementation
  const filteredActions = useMemo(() => {
    if (!searchTerm.trim()) {
      return allActions;
    }

    const searchLower = searchTerm.toLowerCase();
    return allActions.filter(action => {
      const labelMatch = action.label.toLowerCase().includes(searchLower);
      const keywordsMatch = action.keywords?.some(keyword => 
        keyword.toLowerCase().includes(searchLower)
      );
      return labelMatch || keywordsMatch;
    });
  }, [allActions, searchTerm]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups = {};
    filteredActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
    });
    return groups;
  }, [filteredActions]);

  // Get recent actions
  const recentActionItems = useMemo(() => {
    return recentActions
      .map(id => allActions.find(a => a.id === id))
      .filter(Boolean)
      .slice(0, 5);
  }, [recentActions, allActions]);

  // Add action to recent
  const addToRecent = useCallback((actionId) => {
    setRecentActions(prev => {
      const updated = [actionId, ...prev.filter(id => id !== actionId)].slice(0, 10);
      localStorage.setItem('recent_actions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Execute action
  const executeAction = useCallback((action) => {
    addToRecent(action.id);
    action.action();
    onClose();
    setSearchTerm('');
    setSelectedIndex(0);
  }, [addToRecent, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      const totalActions = filteredActions.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, totalActions - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredActions[selectedIndex]) {
            executeAction(filteredActions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          setSearchTerm('');
          setSelectedIndex(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredActions, selectedIndex, executeAction, onClose]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      passiveModal
      className="command-palette"
      size="md"
    >
      <div className="command-palette__container">
        <div className="command-palette__search">
          <Search
            ref={searchInputRef}
            placeholder="Type a command or search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            size="lg"
            labelText=""
            closeButtonLabelText="Clear search"
          />
        </div>

        <div className="command-palette__results">
          {!searchTerm && recentActionItems.length > 0 && (
            <div className="command-palette__section">
              <h4 className="command-palette__section-title">Recent</h4>
              <div className="command-palette__items">
                {recentActionItems.map((action, index) => (
                  <CommandPaletteItem
                    key={action.id}
                    action={action}
                    isSelected={selectedIndex === index}
                    onClick={() => executeAction(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category} className="command-palette__section">
              <h4 className="command-palette__section-title">{category}</h4>
              <div className="command-palette__items">
                {actions.map((action, index) => {
                  const globalIndex = filteredActions.indexOf(action);
                  return (
                    <CommandPaletteItem
                      key={action.id}
                      action={action}
                      isSelected={selectedIndex === globalIndex}
                      onClick={() => executeAction(action)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {filteredActions.length === 0 && (
            <div className="command-palette__empty">
              <p>No commands found for "{searchTerm}"</p>
            </div>
          )}
        </div>

        <div className="command-palette__footer">
          <div className="command-palette__hints">
            <span><Tag size="sm">↑↓</Tag> Navigate</span>
            <span><Tag size="sm">Enter</Tag> Execute</span>
            <span><Tag size="sm">Esc</Tag> Close</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Command Palette Item Component
 */
const CommandPaletteItem = ({ action, isSelected, onClick }) => {
  const Icon = action.icon;

  return (
    <button
      className={`command-palette__item ${isSelected ? 'command-palette__item--selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className="command-palette__item-icon">
        {Icon && <Icon size={20} />}
      </div>
      <div className="command-palette__item-content">
        <span className="command-palette__item-label">{action.label}</span>
        {action.category && (
          <span className="command-palette__item-category">{action.category}</span>
        )}
      </div>
    </button>
  );
};

export default CommandPalette;

// Made with Bob

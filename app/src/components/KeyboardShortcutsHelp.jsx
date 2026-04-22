import React from 'react';
import { Modal, Tag } from '@carbon/react';
import { getPlatformShortcut } from '../hooks/useKeyboardShortcuts';

/**
 * Keyboard shortcuts help modal
 * Displays all available keyboard shortcuts organized by category
 */
const KeyboardShortcutsHelp = ({ open, onClose }) => {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: 'Ctrl+K', description: 'Open command palette' },
        { keys: 'Ctrl+B', description: 'Toggle sidebar' },
        { keys: 'Alt+1', description: 'Go to Home' },
        { keys: 'Alt+2', description: 'Go to Build Management' },
        { keys: 'Alt+3', description: 'Go to User Management' },
        { keys: 'Alt+4', description: 'Go to System Logs' },
      ]
    },
    {
      category: 'Actions',
      items: [
        { keys: 'Ctrl+N', description: 'Create new build' },
        { keys: 'Ctrl+S', description: 'Save current form' },
        { keys: 'Ctrl+E', description: 'Export current view' },
        { keys: 'Ctrl+R', description: 'Refresh data' },
      ]
    },
    {
      category: 'Search & Selection',
      items: [
        { keys: 'Ctrl+F', description: 'Focus search input' },
        { keys: 'Ctrl+A', description: 'Select all (in tables)' },
      ]
    },
    {
      category: 'Forms & Modals',
      items: [
        { keys: 'Ctrl+Enter', description: 'Submit form' },
        { keys: 'Escape', description: 'Close modal or clear selection' },
        { keys: 'Tab', description: 'Navigate between fields' },
        { keys: 'Shift+Tab', description: 'Navigate backwards' },
      ]
    },
    {
      category: 'Help',
      items: [
        { keys: 'Shift+?', description: 'Show this help dialog' },
      ]
    }
  ];

  return (
    <Modal
      open={open}
      modalHeading="Keyboard Shortcuts"
      modalLabel="Help"
      passiveModal
      onRequestClose={onClose}
      size="md"
    >
      <div className="keyboard-shortcuts-help">
        <p className="keyboard-shortcuts-help__intro">
          Use these keyboard shortcuts to navigate and perform actions more efficiently.
        </p>
        
        {shortcuts.map((section) => (
          <div key={section.category} className="keyboard-shortcuts-help__section">
            <h4 className="keyboard-shortcuts-help__category">{section.category}</h4>
            <div className="keyboard-shortcuts-help__items">
              {section.items.map((item, index) => (
                <div key={index} className="keyboard-shortcuts-help__item">
                  <div className="keyboard-shortcuts-help__keys">
                    {item.keys.split('+').map((key, keyIndex) => (
                      <React.Fragment key={keyIndex}>
                        {keyIndex > 0 && <span className="keyboard-shortcuts-help__plus">+</span>}
                        <Tag type="gray" size="sm" className="keyboard-shortcuts-help__key">
                          {getPlatformShortcut(key)}
                        </Tag>
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="keyboard-shortcuts-help__description">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div className="keyboard-shortcuts-help__footer">
          <p className="keyboard-shortcuts-help__note">
            <strong>Note:</strong> Some shortcuts may not be available in all contexts or views.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsHelp;

// Made with Bob

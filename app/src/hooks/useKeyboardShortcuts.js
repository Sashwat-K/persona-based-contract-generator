import { useEffect, useCallback } from 'react';

/**
 * Custom hook for managing keyboard shortcuts
 * @param {Object} shortcuts - Map of key combinations to handler functions
 * @param {boolean} enabled - Whether shortcuts are enabled (default: true)
 * @param {Array} dependencies - Dependencies for the shortcuts handlers
 * 
 * @example
 * useKeyboardShortcuts({
 *   'Ctrl+K': () => openCommandPalette(),
 *   'Ctrl+S': () => saveForm(),
 *   'Escape': () => closeModal()
 * });
 */
export const useKeyboardShortcuts = (shortcuts, enabled = true, dependencies = []) => {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target;
    const isInputField = 
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Allow Escape key even in input fields
    if (isInputField && event.key !== 'Escape') {
      return;
    }

    // Build the key combination string
    const modifiers = [];
    if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    
    const key = event.key;
    const combination = modifiers.length > 0 
      ? `${modifiers.join('+')}+${key}`
      : key;

    // Check if this combination has a handler
    const handler = shortcuts[combination];
    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    }
  }, [shortcuts, enabled, ...dependencies]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

/**
 * Predefined keyboard shortcut combinations
 */
export const SHORTCUTS = {
  // Navigation
  COMMAND_PALETTE: 'Ctrl+k',
  TOGGLE_SIDEBAR: 'Ctrl+b',
  SETTINGS: 'Ctrl+,',
  
  // Actions
  NEW: 'Ctrl+n',
  SAVE: 'Ctrl+s',
  EXPORT: 'Ctrl+e',
  REFRESH: 'Ctrl+r',
  
  // Search
  SEARCH: 'Ctrl+f',
  
  // Selection
  SELECT_ALL: 'Ctrl+a',
  
  // Modal/Dialog
  CLOSE: 'Escape',
  SUBMIT: 'Ctrl+Enter',
  
  // Help
  HELP: 'Shift+?',
  
  // View Navigation
  HOME: 'Alt+1',
  BUILDS: 'Alt+2',
  USERS: 'Alt+3',
  LOGS: 'Alt+4',
};

/**
 * Get human-readable shortcut label
 * @param {string} shortcut - Shortcut combination (e.g., 'Ctrl+k')
 * @returns {string} - Human-readable label (e.g., 'Ctrl + K')
 */
export const getShortcutLabel = (shortcut) => {
  return shortcut
    .split('+')
    .map(key => {
      // Capitalize first letter
      return key.charAt(0).toUpperCase() + key.slice(1);
    })
    .join(' + ');
};

/**
 * Check if user is on Mac
 * @returns {boolean}
 */
export const isMac = () => {
  return typeof window !== 'undefined' && 
    /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
};

/**
 * Get platform-specific modifier key label
 * @returns {string} - 'Cmd' on Mac, 'Ctrl' on other platforms
 */
export const getModifierKey = () => {
  return isMac() ? 'Cmd' : 'Ctrl';
};

/**
 * Convert shortcut to platform-specific label
 * @param {string} shortcut - Shortcut combination
 * @returns {string} - Platform-specific label
 */
export const getPlatformShortcut = (shortcut) => {
  const modifier = getModifierKey();
  return shortcut.replace('Ctrl', modifier);
};

export default useKeyboardShortcuts;

// Made with Bob

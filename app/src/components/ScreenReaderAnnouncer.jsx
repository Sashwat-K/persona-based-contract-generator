import React, { useEffect, useRef } from 'react';

/**
 * Screen Reader Announcer Component
 * Provides live region announcements for screen readers
 * 
 * @param {string} message - Message to announce
 * @param {string} politeness - 'polite' or 'assertive' (default: 'polite')
 * @param {boolean} atomic - Whether to read entire region (default: true)
 */
const ScreenReaderAnnouncer = ({ message, politeness = 'polite', atomic = true }) => {
  const announcerRef = useRef(null);

  useEffect(() => {
    if (message && announcerRef.current) {
      // Clear and re-announce to ensure screen readers pick up the change
      announcerRef.current.textContent = '';
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = message;
        }
      }, 100);
    }
  }, [message]);

  return (
    <div
      ref={announcerRef}
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
      aria-relevant="additions text"
    />
  );
};

/**
 * Hook for managing screen reader announcements
 * Returns a function to trigger announcements
 */
export const useScreenReaderAnnouncement = () => {
  const [announcement, setAnnouncement] = React.useState('');

  const announce = React.useCallback((message, delay = 0) => {
    if (delay > 0) {
      setTimeout(() => setAnnouncement(message), delay);
    } else {
      setAnnouncement(message);
    }
    
    // Clear announcement after it's been read
    setTimeout(() => setAnnouncement(''), 3000);
  }, []);

  return { announcement, announce };
};

export default ScreenReaderAnnouncer;

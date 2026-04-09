/**
 * Format a date/timestamp to a human-readable string
 * @param {string|Date} timestamp 
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export const formatDate = (timestamp, options = {}) => {
  if (!timestamp) return 'N/A';

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return new Date(timestamp).toLocaleString('en-US', defaultOptions);
};

/**
 * Format a date to relative time (e.g., "2 hours ago")
 * @param {string|Date} timestamp 
 * @returns {string}
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'N/A';

  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

  return formatDate(timestamp);
};

/**
 * Format a cryptographic hash for display
 * @param {string} hash - Hash in hex format
 * @param {boolean} truncate - Whether to truncate the hash
 * @param {number} length - Number of characters to show on each end
 * @returns {string}
 */
export const formatHash = (hash, truncate = true, length = 8) => {
  if (!hash) return 'N/A';

  if (!truncate || hash.length <= length * 2 + 3) {
    return hash;
  }

  return `${hash.substring(0, length)}...${hash.substring(hash.length - length)}`;
};

/**
 * Format a key fingerprint (add colons every 2 characters)
 * @param {string} fingerprint 
 * @returns {string}
 */
export const formatFingerprint = (fingerprint) => {
  if (!fingerprint) return 'N/A';

  // If already formatted, return as-is
  if (fingerprint.includes(':')) return fingerprint;

  // Add colons every 2 characters
  return fingerprint.match(/.{1,2}/g)?.join(':').toUpperCase() || fingerprint;
};

/**
 * Format file size in human-readable format
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return 'N/A';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format a user's name
 * @param {Object} user 
 * @returns {string}
 */
export const formatUserName = (user) => {
  if (!user) return 'Unknown User';
  return user.name || user.email || 'Unknown User';
};

/**
 * Format a role name for display
 * @param {string} role 
 * @returns {string}
 */
export const formatRoleName = (role) => {
  if (!role) return 'N/A';

  // Convert SNAKE_CASE to Title Case
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format build status for display
 * @param {string} status 
 * @returns {string}
 */
export const formatBuildStatus = (status) => {
  if (!status) return 'Unknown';

  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format a duration in milliseconds to human-readable string
 * @param {number} ms 
 * @returns {string}
 */
export const formatDuration = (ms) => {
  if (!ms || ms < 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Format days until expiry
 * @param {string|Date} expiryDate 
 * @returns {string}
 */
export const formatDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return 'N/A';

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  return `${diffDays} days`;
};

/**
 * Truncate text to a maximum length
 * @param {string} text 
 * @param {number} maxLength 
 * @param {string} suffix 
 * @returns {string}
 */
export const truncateText = (text, maxLength = 50, suffix = '...') => {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Format a percentage
 * @param {number} value 
 * @param {number} total 
 * @param {number} decimals 
 * @returns {string}
 */
export const formatPercentage = (value, total, decimals = 1) => {
  if (!total || total === 0) return '0%';

  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format a number with thousand separators
 * @param {number} num 
 * @returns {string}
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('en-US');
};

/**
 * Format JSON for display
 * @param {Object} obj 
 * @param {number} indent 
 * @returns {string}
 */
export const formatJSON = (obj, indent = 2) => {
  try {
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    return String(obj);
  }
};

/**
 * Format a base64 string for display (truncated)
 * @param {string} base64 
 * @param {number} length 
 * @returns {string}
 */
export const formatBase64 = (base64, length = 20) => {
  if (!base64) return 'N/A';

  if (base64.length <= length * 2) {
    return base64;
  }

  return `${base64.substring(0, length)}...${base64.substring(base64.length - length)}`;
};



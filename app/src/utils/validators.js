import { PASSWORD_REQUIREMENTS, FILE_SIZE_LIMITS, ALLOWED_FILE_TYPES } from './constants';

/**
 * Validate email address
 * @param {string} email 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateEmail = (email) => {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!re.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, error: null };
};

/**
 * Validate password against requirements
 * @param {string} password 
 * @returns {{valid: boolean, error: string|null, strength: string}}
 */
export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Password is required', strength: 'none' };
  }

  const { MIN_LENGTH, REQUIRE_UPPERCASE, REQUIRE_LOWERCASE, REQUIRE_NUMBER, REQUIRE_SPECIAL, SPECIAL_CHARS } = PASSWORD_REQUIREMENTS;

  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_LENGTH} characters long`,
      strength: 'weak'
    };
  }

  if (REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter',
      strength: 'weak'
    };
  }

  if (REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter',
      strength: 'weak'
    };
  }

  if (REQUIRE_NUMBER && !/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number',
      strength: 'weak'
    };
  }

  if (REQUIRE_SPECIAL) {
    const specialRegex = new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialRegex.test(password)) {
      return {
        valid: false,
        error: `Password must contain at least one special character (${SPECIAL_CHARS})`,
        strength: 'weak'
      };
    }
  }

  // Calculate strength
  let strength = 'medium';
  if (password.length >= 16 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    strength = 'strong';
  }

  return { valid: true, error: null, strength };
};

/**
 * Validate URL format
 * @param {string} url 
 * @param {boolean} requireHttps 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateUrl = (url, requireHttps = true) => {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const parsed = new URL(url);

    if (requireHttps && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format. Use: https://hostname:port' };
  }
};

/**
 * Validate file type
 * @param {File} file 
 * @param {string} category - 'WORKLOAD', 'CERTIFICATE', or 'CONTRACT'
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateFileType = (file, category) => {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  const allowedTypes = ALLOWED_FILE_TYPES[category];
  if (!allowedTypes) {
    return { valid: false, error: 'Invalid file category' };
  }

  const extension = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedTypes.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate file size
 * @param {File} file 
 * @param {string} category - 'WORKLOAD', 'CERTIFICATE', or 'CONTRACT'
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateFileSize = (file, category) => {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  const maxSize = FILE_SIZE_LIMITS[category];
  if (!maxSize) {
    return { valid: false, error: 'Invalid file category' };
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB} MB`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate file (type and size)
 * @param {File} file 
 * @param {string} category 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateFile = (file, category) => {
  const typeValidation = validateFileType(file, category);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  const sizeValidation = validateFileSize(file, category);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true, error: null };
};

/**
 * Validate build name
 * @param {string} name 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateBuildName = (name) => {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Build name is required' };
  }

  if (name.length < 3) {
    return { valid: false, error: 'Build name must be at least 3 characters long' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Build name must not exceed 100 characters' };
  }

  // Allow alphanumeric, hyphens, underscores, and spaces
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      valid: false,
      error: 'Build name can only contain letters, numbers, spaces, hyphens, and underscores'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate user name
 * @param {string} name 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateUserName = (name) => {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Name is required' };
  }

  if (name.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Name must not exceed 100 characters' };
  }

  return { valid: true, error: null };
};

/**
 * Validate PEM format (public/private key or certificate)
 * @param {string} pem 
 * @param {string} type - 'PUBLIC KEY', 'PRIVATE KEY', 'CERTIFICATE', etc.
 * @returns {{valid: boolean, error: string|null}}
 */
export const validatePEM = (pem, type = 'KEY') => {
  if (!pem || !pem.trim()) {
    return { valid: false, error: `${type} is required` };
  }

  const beginMarker = `-----BEGIN`;
  const endMarker = `-----END`;

  if (!pem.includes(beginMarker) || !pem.includes(endMarker)) {
    return { valid: false, error: `Invalid PEM format for ${type}` };
  }

  return { valid: true, error: null };
};

/**
 * Validate hash format (hex string)
 * @param {string} hash 
 * @param {number} expectedLength - Expected length in characters (64 for SHA-256)
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateHash = (hash, expectedLength = 64) => {
  if (!hash) {
    return { valid: false, error: 'Hash is required' };
  }

  if (!/^[a-fA-F0-9]+$/.test(hash)) {
    return { valid: false, error: 'Hash must be a hexadecimal string' };
  }

  if (hash.length !== expectedLength) {
    return {
      valid: false,
      error: `Hash must be ${expectedLength} characters long (got ${hash.length})`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate base64 string
 * @param {string} str 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateBase64 = (str) => {
  if (!str) {
    return { valid: false, error: 'Base64 string is required' };
  }

  // Base64 regex pattern
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (!base64Regex.test(str)) {
    return { valid: false, error: 'Invalid base64 format' };
  }

  return { valid: true, error: null };
};

/**
 * Validate required field
 * @param {any} value 
 * @param {string} fieldName 
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && !value.trim()) {
    return { valid: false, error: `${fieldName} is required` };
  }

  return { valid: true, error: null };
};

/**
 * Validate form data
 * @param {Object} data - Form data object
 * @param {Object} rules - Validation rules object
 * @returns {{valid: boolean, errors: Object}}
 */
export const validateForm = (data, rules) => {
  const errors = {};
  let isValid = true;

  for (const [field, validators] of Object.entries(rules)) {
    for (const validator of validators) {
      const result = validator(data[field]);
      if (!result.valid) {
        errors[field] = result.error;
        isValid = false;
        break; // Stop at first error for this field
      }
    }
  }

  return { valid: isValid, errors };
};



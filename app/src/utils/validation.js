/**
 * Validation Utilities
 * Comprehensive validation functions for forms and user input
 */

/**
 * Email validation
 * RFC 5322 compliant email validation
 */
export const validateEmail = (email) => {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  return { valid: true, error: null };
};

/**
 * Password validation
 * Enforces strong password requirements
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 12,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true
  } = options;

  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return {
      valid: false,
      error: `Password must be at least ${minLength} characters`
    };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter'
    };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter'
    };
  }

  if (requireNumbers && !/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number'
    };
  }

  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one special character'
    };
  }

  return { valid: true, error: null };
};

/**
 * Password strength calculator
 * Returns strength score and label
 */
export const calculatePasswordStrength = (password) => {
  if (!password) {
    return { score: 0, label: 'None', color: 'gray' };
  }

  let score = 0;

  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  // Patterns (reduce score for common patterns)
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/^[0-9]+$/.test(password)) score -= 1; // Only numbers
  if (/^[a-zA-Z]+$/.test(password)) score -= 1; // Only letters

  score = Math.max(0, Math.min(7, score));

  const strengthMap = {
    0: { label: 'Very Weak', color: '#da1e28' },
    1: { label: 'Very Weak', color: '#da1e28' },
    2: { label: 'Weak', color: '#ff832b' },
    3: { label: 'Fair', color: '#f1c21b' },
    4: { label: 'Good', color: '#a7f0ba' },
    5: { label: 'Strong', color: '#24a148' },
    6: { label: 'Very Strong', color: '#198038' },
    7: { label: 'Excellent', color: '#0f5323' }
  };

  return { score, ...strengthMap[score] };
};

/**
 * Passphrase validation (for key encryption)
 * Less strict than password, but still secure
 */
export const validatePassphrase = (passphrase, minLength = 8) => {
  if (!passphrase) {
    return { valid: false, error: 'Passphrase is required' };
  }

  if (passphrase.length < minLength) {
    return {
      valid: false,
      error: `Passphrase must be at least ${minLength} characters`
    };
  }

  return { valid: true, error: null };
};

/**
 * RSA Public Key validation
 * Validates PEM format RSA public key
 */
export const validateRSAPublicKey = (key) => {
  if (!key) {
    return { valid: false, error: 'Public key is required' };
  }

  // Check PEM format
  const pemRegex = /^-----BEGIN (RSA )?PUBLIC KEY-----\n[\s\S]+\n-----END (RSA )?PUBLIC KEY-----$/;

  if (!pemRegex.test(key.trim())) {
    return {
      valid: false,
      error: 'Invalid PEM format. Key must start with "-----BEGIN PUBLIC KEY-----"'
    };
  }

  // Check key length (RSA-4096 should be ~800 characters)
  const keyContent = key.replace(/-----BEGIN (RSA )?PUBLIC KEY-----/, '')
    .replace(/-----END (RSA )?PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  if (keyContent.length < 500) {
    return {
      valid: false,
      error: 'Key appears too short. RSA-4096 keys should be ~800 characters'
    };
  }

  return { valid: true, error: null };
};

/**
 * File upload validation
 */
export const validateFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = []
  } = options;

  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`
    };
  }

  // Check MIME type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension .${extension} is not allowed`
      };
    }
  }

  return { valid: true, error: null };
};

/**
 * URL validation
 */
export const validateURL = (url, options = {}) => {
  const { requireHTTPS = false } = options;

  if (!url) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);

    if (requireHTTPS && urlObj.protocol !== 'https:') {
      return {
        valid: false,
        error: 'URL must use HTTPS protocol'
      };
    }

    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Date validation
 */
export const validateDate = (date, options = {}) => {
  const { minDate, maxDate, futureOnly = false, pastOnly = false } = options;

  if (!date) {
    return { valid: false, error: 'Date is required' };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  const now = new Date();

  if (futureOnly && dateObj <= now) {
    return { valid: false, error: 'Date must be in the future' };
  }

  if (pastOnly && dateObj >= now) {
    return { valid: false, error: 'Date must be in the past' };
  }

  if (minDate && dateObj < new Date(minDate)) {
    return {
      valid: false,
      error: `Date must be after ${new Date(minDate).toLocaleDateString()}`
    };
  }

  if (maxDate && dateObj > new Date(maxDate)) {
    return {
      valid: false,
      error: `Date must be before ${new Date(maxDate).toLocaleDateString()}`
    };
  }

  return { valid: true, error: null };
};

/**
 * Required field validation
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (Array.isArray(value) && value.length === 0) {
    return { valid: false, error: `${fieldName} must have at least one item` };
  }

  return { valid: true, error: null };
};

/**
 * String length validation
 */
export const validateLength = (value, options = {}) => {
  const { min, max, fieldName = 'Field' } = options;

  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const length = value.length;

  if (min !== undefined && length < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min} characters`
    };
  }

  if (max !== undefined && length > max) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${max} characters`
    };
  }

  return { valid: true, error: null };
};

/**
 * Number range validation
 */
export const validateNumber = (value, options = {}) => {
  const { min, max, integer = false, fieldName = 'Value' } = options;

  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  if (min !== undefined && num < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min}`
    };
  }

  if (max !== undefined && num > max) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${max}`
    };
  }

  return { valid: true, error: null };
};

/**
 * Token name validation (for API tokens)
 */
export const validateTokenName = (name) => {
  if (!name) {
    return { valid: false, error: 'Token name is required' };
  }

  if (name.length < 3) {
    return { valid: false, error: 'Token name must be at least 3 characters' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Token name must be at most 50 characters' };
  }

  // Allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      valid: false,
      error: 'Token name can only contain letters, numbers, spaces, hyphens, and underscores'
    };
  }

  return { valid: true, error: null };
};

/**
 * Build name validation
 */
export const validateBuildName = (name) => {
  if (!name) {
    return { valid: false, error: 'Build name is required' };
  }

  if (name.length < 3) {
    return { valid: false, error: 'Build name must be at least 3 characters' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Build name must be at most 100 characters' };
  }

  return { valid: true, error: null };
};

/**
 * Validate form object
 * Validates multiple fields at once
 */
export const validateForm = (formData, validationRules) => {
  const errors = {};
  let isValid = true;

  Object.keys(validationRules).forEach(field => {
    const rules = validationRules[field];
    const value = formData[field];

    for (const rule of rules) {
      const result = rule(value);
      if (!result.valid) {
        errors[field] = result.error;
        isValid = false;
        break; // Stop at first error for this field
      }
    }
  });

  return { isValid, errors };
};

export default {
  validateEmail,
  validatePassword,
  calculatePasswordStrength,
  validatePassphrase,
  validateRSAPublicKey,
  validateFile,
  validateURL,
  validateDate,
  validateRequired,
  validateLength,
  validateNumber,
  validateTokenName,
  validateBuildName,
  validateForm
};



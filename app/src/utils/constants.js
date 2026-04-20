// Build Status Constants (v2 workflow)
export const BUILD_STATUS = {
  CREATED: 'CREATED',
  SIGNING_KEY_REGISTERED: 'SIGNING_KEY_REGISTERED',
  WORKLOAD_SUBMITTED: 'WORKLOAD_SUBMITTED',
  ENVIRONMENT_STAGED: 'ENVIRONMENT_STAGED',
  ATTESTATION_KEY_REGISTERED: 'ATTESTATION_KEY_REGISTERED',
  FINALIZED: 'FINALIZED',
  CONTRACT_DOWNLOADED: 'CONTRACT_DOWNLOADED',
  CANCELLED: 'CANCELLED',
  // Deprecated v1 statuses (kept for backward compatibility with existing builds)
  AUDITOR_KEYS_REGISTERED: 'AUDITOR_KEYS_REGISTERED',
  CONTRACT_ASSEMBLED: 'CONTRACT_ASSEMBLED'
};

// Build Status Display Configuration
export const BUILD_STATUS_CONFIG = {
  [BUILD_STATUS.CREATED]: {
    label: 'Created',
    kind: 'gray',
    description: 'Build created, awaiting signing key registration'
  },
  [BUILD_STATUS.SIGNING_KEY_REGISTERED]: {
    label: 'Signing Key Registered',
    kind: 'purple',
    description: 'Signing key registered, awaiting workload submission'
  },
  [BUILD_STATUS.WORKLOAD_SUBMITTED]: {
    label: 'Workload Submitted',
    kind: 'blue',
    description: 'Workload submitted, awaiting environment configuration'
  },
  [BUILD_STATUS.ENVIRONMENT_STAGED]: {
    label: 'Environment Staged',
    kind: 'cyan',
    description: 'Environment staged, awaiting attestation key'
  },
  [BUILD_STATUS.ATTESTATION_KEY_REGISTERED]: {
    label: 'Attestation Key Registered',
    kind: 'teal',
    description: 'Attestation key registered, ready for finalization'
  },
  [BUILD_STATUS.FINALIZED]: {
    label: 'Finalized',
    kind: 'green',
    description: 'Contract finalized and ready for deployment'
  },
  [BUILD_STATUS.CONTRACT_DOWNLOADED]: {
    label: 'Downloaded',
    kind: 'teal',
    description: 'Contract downloaded and acknowledgment signed'
  },
  [BUILD_STATUS.CANCELLED]: {
    label: 'Cancelled',
    kind: 'red',
    description: 'Build cancelled by administrator'
  },
  // Deprecated v1 display config (for existing builds)
  [BUILD_STATUS.AUDITOR_KEYS_REGISTERED]: {
    label: 'Keys Registered (v1)',
    kind: 'teal',
    description: 'Auditor keys registered (legacy workflow)'
  },
  [BUILD_STATUS.CONTRACT_ASSEMBLED]: {
    label: 'Contract Assembled (v1)',
    kind: 'cyan',
    description: 'Contract assembled (legacy workflow)'
  }
};

// Persona/Role Constants
export const ROLES = {
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR',
  SOLUTION_PROVIDER: 'SOLUTION_PROVIDER',
  DATA_OWNER: 'DATA_OWNER',
  ENV_OPERATOR: 'ENV_OPERATOR',
  VIEWER: 'VIEWER'
};

// Role Display Names
export const ROLE_NAMES = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.AUDITOR]: 'Auditor',
  [ROLES.SOLUTION_PROVIDER]: 'Solution Provider',
  [ROLES.DATA_OWNER]: 'Data Owner',
  [ROLES.ENV_OPERATOR]: 'Environment Operator',
  [ROLES.VIEWER]: 'Viewer'
};

// Audit Event Types (v2 workflow)
export const AUDIT_EVENT_TYPES = {
  BUILD_CREATED: 'BUILD_CREATED',
  SIGNING_KEY_CREATED: 'SIGNING_KEY_CREATED',
  WORKLOAD_SUBMITTED: 'WORKLOAD_SUBMITTED',
  ENVIRONMENT_STAGED: 'ENVIRONMENT_STAGED',
  ATTESTATION_KEY_REGISTERED: 'ATTESTATION_KEY_REGISTERED',
  BUILD_FINALIZED: 'BUILD_FINALIZED',
  CONTRACT_DOWNLOADED: 'CONTRACT_DOWNLOADED',
  ATTESTATION_EVIDENCE_UPLOADED: 'ATTESTATION_EVIDENCE_UPLOADED',
  ATTESTATION_VERIFIED: 'ATTESTATION_VERIFIED',
  BUILD_CANCELLED: 'BUILD_CANCELLED',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_ASSIGNED: 'USER_ROLE_ASSIGNED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PUBLIC_KEY_REGISTERED: 'PUBLIC_KEY_REGISTERED',
  // Deprecated v1 event types
  AUDITOR_KEYS_REGISTERED: 'AUDITOR_KEYS_REGISTERED',
  CONTRACT_ASSEMBLED: 'CONTRACT_ASSEMBLED'
};

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  WORKLOAD: 50 * 1024 * 1024, // 50 MB
  CERTIFICATE: 10 * 1024, // 10 KB
  CONTRACT: 100 * 1024 * 1024 // 100 MB
};

// Allowed File Types
export const ALLOWED_FILE_TYPES = {
  WORKLOAD: ['.yaml', '.yml', '.tar', '.tar.gz', '.tgz'],
  CERTIFICATE: ['.pem', '.crt', '.cer'],
  CONTRACT: ['.yaml', '.yml']
};

// Notification Timeouts (in milliseconds)
export const NOTIFICATION_TIMEOUT = {
  SUCCESS: 5000,
  ERROR: 10000,
  WARNING: 7000,
  INFO: 5000
};

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
};

// Crypto Configuration
export const CRYPTO_CONFIG = {
  KEY_SIZE: 4096, // RSA key size
  SYMMETRIC_KEY_SIZE: 256, // AES key size in bits
  HASH_ALGORITHM: 'SHA-256',
  SIGNATURE_ALGORITHM: 'RSA-PSS',
  ENCRYPTION_ALGORITHM: 'AES-256-GCM'
};

// Key Expiry Configuration
export const KEY_EXPIRY = {
  DEFAULT_DAYS: 90,
  WARNING_DAYS: 14 // Show warning when key expires in 14 days
};

// Password Requirements
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  SPECIAL_CHARS: '@$!%*?&'
};

// Navigation Items
export const NAV_ITEMS = {
  ANALYTICS: 'ANALYTICS',
  BUILDS: 'BUILDS',
  USERS: 'USERS',
  SETTINGS: 'SETTINGS',
  SERVER_CONFIG: 'SERVER_CONFIG'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  SERVER_URL: 'server_url',
  THEME: 'theme',
  SIDEBAR_EXPANDED: 'sidebar_expanded'
};

// Default Server Configuration
export const DEFAULT_SERVER_CONFIG = {
  URL: 'https://localhost:8443',
  TIMEOUT: 30000
};

// Carbon Theme
export const THEME = {
  DARK: 'g100',
  LIGHT: 'white'
};

// Build Progress Steps (v2 workflow)
export const BUILD_PROGRESS_STEPS = [
  {
    label: 'Created',
    status: BUILD_STATUS.CREATED,
    role: ROLES.ADMIN
  },
  {
    label: 'Signing Key',
    status: BUILD_STATUS.SIGNING_KEY_REGISTERED,
    role: ROLES.AUDITOR
  },
  {
    label: 'Workload',
    status: BUILD_STATUS.WORKLOAD_SUBMITTED,
    role: ROLES.SOLUTION_PROVIDER
  },
  {
    label: 'Environment',
    status: BUILD_STATUS.ENVIRONMENT_STAGED,
    role: ROLES.DATA_OWNER
  },
  {
    label: 'Attestation Key',
    status: BUILD_STATUS.ATTESTATION_KEY_REGISTERED,
    role: ROLES.AUDITOR
  },
  {
    label: 'Finalized',
    status: BUILD_STATUS.FINALIZED,
    role: ROLES.AUDITOR
  }
];

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AUTH_FAILED: 'Authentication failed. Please check your credentials.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  SERVER_ERROR: 'Server error. Please try again later.',
  INVALID_INPUT: 'Invalid input. Please check your data and try again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit.',
  INVALID_FILE_TYPE: 'Invalid file type. Please select a valid file.',
  CRYPTO_ERROR: 'Cryptographic operation failed. Please try again.',
  KEY_NOT_FOUND: 'Private key not found. Please generate a new key pair.',
  SIGNATURE_INVALID: 'Signature verification failed.',
  CONTRACT_INVALID: 'Contract validation failed.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_CHANGED: 'Password changed successfully',
  KEY_REGISTERED: 'Public key registered successfully',
  BUILD_CREATED: 'Build created successfully',
  WORKLOAD_SUBMITTED: 'Workload submitted successfully',
  ENVIRONMENT_STAGED: 'Environment staged successfully',
  KEYS_REGISTERED: 'Attestation keys registered successfully',
  BUILD_FINALIZED: 'Build finalized successfully',
  CONTRACT_DOWNLOADED: 'Contract downloaded successfully',
  BUILD_CANCELLED: 'Build cancelled successfully',
  USER_CREATED: 'User created successfully',
  SETTINGS_SAVED: 'Settings saved successfully'
};

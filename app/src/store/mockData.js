// Constants for personas and build states
// These are used throughout the application for consistency

export const PERSONAS = {
  ADMIN: 'Admin',
  SOLUTION_PROVIDER: 'Solution Provider',
  DATA_OWNER: 'Data Owner',
  AUDITOR: 'Auditor',
  ENV_OPERATOR: 'Env Operator',
  VIEWER: 'Viewer'
};

export const BUILD_STATES = [
  'CREATED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'AUDITOR_KEYS_REGISTERED',
  'CONTRACT_ASSEMBLED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED'
];


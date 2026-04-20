// Constants for personas and build states
// These are used throughout the application for consistency

export const PERSONAS = {
  ADMIN: 'Admin',
  AUDITOR: 'Auditor',
  SOLUTION_PROVIDER: 'Solution Provider',
  DATA_OWNER: 'Data Owner',
  ENV_OPERATOR: 'Env Operator',
  VIEWER: 'Viewer'
};

export const BUILD_STATES = [
  'CREATED',
  'SIGNING_KEY_REGISTERED',
  'WORKLOAD_SUBMITTED',
  'ENVIRONMENT_STAGED',
  'ATTESTATION_KEY_REGISTERED',
  'FINALIZED',
  'CONTRACT_DOWNLOADED'
];

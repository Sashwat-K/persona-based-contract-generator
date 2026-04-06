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
  'FINALIZED'
];

export const initialBuilds = [
  {
    id: 'bld-001',
    name: 'Production v2.1',
    status: 'CREATED',
    createdAt: '2026-04-05T10:00:00Z',
    createdBy: 'System Admin',
    assignments: {
      SOLUTION_PROVIDER: 'Solution Provider',
      DATA_OWNER: 'Data Owner',
      AUDITOR: 'Auditor',
      ENV_OPERATOR: 'Environment Operator',
    }
  },
  {
    id: 'bld-002',
    name: 'Data Owner Example',
    status: 'WORKLOAD_SUBMITTED',
    createdAt: '2026-04-05T14:30:00Z',
    createdBy: 'System Admin',
    assignments: {
      SOLUTION_PROVIDER: 'Solution Provider',
      DATA_OWNER: 'Data Owner',
      AUDITOR: 'Auditor',
      ENV_OPERATOR: 'Environment Operator',
    }
  },
  {
    id: 'bld-003',
    name: 'Auditor Review Build',
    status: 'ENVIRONMENT_STAGED',
    createdAt: '2026-04-04T12:30:00Z',
    createdBy: 'System Admin',
    assignments: {
      SOLUTION_PROVIDER: 'Solution Provider 2',
      DATA_OWNER: 'Data Owner',
      AUDITOR: 'Auditor',
      ENV_OPERATOR: 'Environment Operator',
    }
  },
  {
    id: 'bld-004',
    name: 'Auditor Finalization',
    status: 'AUDITOR_KEYS_REGISTERED',
    createdAt: '2026-04-03T09:15:00Z',
    createdBy: 'System Admin',
    assignments: {
      SOLUTION_PROVIDER: 'Solution Provider',
      DATA_OWNER: 'Data Owner 2',
      AUDITOR: 'Auditor',
      ENV_OPERATOR: 'Environment Operator',
    }
  },
  {
    id: 'bld-005',
    name: 'Completed Contract',
    status: 'FINALIZED',
    createdAt: '2026-04-01T09:15:00Z',
    createdBy: 'System Admin',
    assignments: {
      SOLUTION_PROVIDER: 'Solution Provider',
      DATA_OWNER: 'Data Owner',
      AUDITOR: 'Auditor',
      ENV_OPERATOR: 'Environment Operator',
    }
  }
];

export const mockUsers = [
  {
    id: 'usr-001',
    name: 'System Admin',
    email: 'admin@hpcr.local',
    role: 'ADMIN',
    keyStatus: 'Active',
    keyExpiresAt: '2026-06-30',
    passwordExpired: false
  },
  {
    id: 'usr-002',
    name: 'Solution Provider',
    email: 'solution.provider@hpcr.local',
    role: 'SOLUTION_PROVIDER',
    keyStatus: 'Active',
    keyExpiresAt: '2026-05-15',
    passwordExpired: false
  },
  {
    id: 'usr-003',
    name: 'Data Owner',
    email: 'data.owner@hpcr.local',
    role: 'DATA_OWNER',
    keyStatus: 'Active',
    keyExpiresAt: '2026-05-20',
    passwordExpired: true
  },
  {
    id: 'usr-004',
    name: 'Auditor',
    email: 'auditor@hpcr.local',
    role: 'AUDITOR',
    keyStatus: 'Expired',
    keyExpiresAt: '2026-03-01',
    passwordExpired: false
  },
  {
    id: 'usr-005',
    name: 'Environment Operator',
    email: 'env.operator@hpcr.local',
    role: 'ENV_OPERATOR',
    keyStatus: 'Active',
    keyExpiresAt: '2026-06-01',
    passwordExpired: false
  },
  {
    id: 'usr-006',
    name: 'Viewer',
    email: 'viewer@hpcr.local',
    role: 'VIEWER',
    keyStatus: 'Active',
    keyExpiresAt: '2026-07-01',
    passwordExpired: false
  },
  {
    id: 'usr-007',
    name: 'Solution Provider 2',
    email: 'sp2@hpcr.local',
    role: 'SOLUTION_PROVIDER',
    keyStatus: 'Active',
    keyExpiresAt: '2026-05-25',
    passwordExpired: false
  },
  {
    id: 'usr-008',
    name: 'Data Owner 2',
    email: 'do2@hpcr.local',
    role: 'DATA_OWNER',
    keyStatus: 'Active',
    keyExpiresAt: '2026-06-10',
    passwordExpired: true
  },
];

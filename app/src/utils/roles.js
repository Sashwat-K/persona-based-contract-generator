export const ROLE_PRIORITY = Object.freeze([
  'ADMIN',
  'AUDITOR',
  'ENV_OPERATOR',
  'SOLUTION_PROVIDER',
  'DATA_OWNER',
  'VIEWER'
]);

export const ROLE_LABELS = Object.freeze({
  'ADMIN': 'Administrator',
  'SOLUTION_PROVIDER': 'Solution Provider',
  'DATA_OWNER': 'Data Owner',
  'AUDITOR': 'Auditor',
  'ENV_OPERATOR': 'Environment Operator',
  'VIEWER': 'Viewer'
});

export const getPrimaryRole = (roles = []) =>
  ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || 'VIEWER';

export const getRoleLabel = (role) => ROLE_LABELS[role] || role || 'Unknown';

export const getRoleLabels = (roles = []) => roles.map((role) => getRoleLabel(role));


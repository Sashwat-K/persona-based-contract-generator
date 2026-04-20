export const ROLE_PRIORITY = Object.freeze([
  'ADMIN',
  'AUDITOR',
  'SOLUTION_PROVIDER',
  'DATA_OWNER',
  'ENV_OPERATOR',
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

export const sortRolesByPriority = (roles = []) => {
  const order = ROLE_PRIORITY.reduce((acc, role, index) => {
    acc[role] = index;
    return acc;
  }, {});

  return [...roles].sort((a, b) => {
    const ai = Object.prototype.hasOwnProperty.call(order, a) ? order[a] : Number.MAX_SAFE_INTEGER;
    const bi = Object.prototype.hasOwnProperty.call(order, b) ? order[b] : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
};

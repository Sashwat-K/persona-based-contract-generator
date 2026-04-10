import apiClient from './apiClient';

const ROLE_ALIASES = {
  workload_owner: 'SOLUTION_PROVIDER',
  data_owner: 'DATA_OWNER',
  auditor: 'AUDITOR',
  env_operator: 'ENV_OPERATOR',
  solution_provider: 'SOLUTION_PROVIDER',
};

class RoleService {
  constructor() {
    this.roleCache = null;
  }

  normalizeRoleName(role) {
    if (!role) return role;
    const key = String(role).trim();
    const upper = key.toUpperCase();
    if (ROLE_ALIASES[key]) return ROLE_ALIASES[key];
    if (ROLE_ALIASES[key.toLowerCase()]) return ROLE_ALIASES[key.toLowerCase()];
    return upper;
  }

  async listRoles(forceRefresh = false) {
    if (this.roleCache && !forceRefresh) return this.roleCache;
    const response = await apiClient.get('/roles');
    this.roleCache = response.data?.roles || [];
    return this.roleCache;
  }

  async getRoleId(roleName) {
    const normalized = this.normalizeRoleName(roleName);
    const roles = await this.listRoles();
    const role = roles.find((r) => r.name === normalized);
    if (!role) throw new Error(`Role not found: ${normalized}`);
    return role.id;
  }
}

export default new RoleService();

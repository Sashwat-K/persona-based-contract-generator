import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';
import roleService from './roleService';

/**
 * Assignment Service - Build assignment management
 * Handles two-layer access control: RBAC + explicit build assignments
 */
class AssignmentService {
  /**
   * Create a build assignment
   * @param {string} buildId - Build ID
   * @param {string} userId - User ID to assign
   * @param {string} personaRole - Persona role (workload_owner, data_owner, auditor)
   * @returns {Promise<Object>}
   */
  async createAssignment(buildId, userId, personaRole) {
    const roleId = await roleService.getRoleId(personaRole);
    const response = await apiClient.post(`/builds/${buildId}/assignments`, {
      user_id: userId,
      role_id: roleId
    });

    return response.data;
  }

  /**
   * Get all assignments for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Array>}
   */
  async getBuildAssignments(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/assignments`);
    // Backend returns array directly (not wrapped in {assignments: []})
    return Array.isArray(response.data) ? response.data : (response.data.assignments || []);
  }

  /**
   * Get all assignments for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserAssignments(userId) {
    const response = await apiClient.get(`/users/${userId}/assignments`);
    return response.data.assignments || [];
  }

  /**
   * Get current user's assignments
   * @returns {Promise<Array>}
   */
  async getMyAssignments() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    return this.getUserAssignments(user.id);
  }

  /**
   * Delete a specific assignment
   * @param {string} buildId - Build ID
   * @param {string} userId - User ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<void>}
   */
  async deleteAssignment(buildId, userId, personaRole) {
    await apiClient.delete(`/builds/${buildId}/assignments`, {
      data: {
        user_id: userId,
        persona_role: personaRole
      }
    });
  }

  /**
   * Delete all assignments for a persona role in a build
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<void>}
   */
  async deleteBuildAssignments(buildId, personaRole) {
    await apiClient.delete(`/builds/${buildId}/assignments`, {
      data: { persona_role: personaRole }
    });
  }

  /**
   * Validate if user is assigned to a build for a specific role
   * @param {string} buildId - Build ID
   * @param {string} userId - User ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<boolean>}
   */
  async validateUserAssignment(buildId, userId, personaRole) {
    const normalizedRole = roleService.normalizeRoleName(personaRole);
    try {
      const assignments = await this.getBuildAssignments(buildId);
      return assignments.some(a =>
        a.user_id === userId && (a.role_name === normalizedRole || a.persona_role === normalizedRole)
      );
    } catch (error) {
      console.error('Failed to validate assignment:', error);
      return false;
    }
  }

  /**
   * Check if current user is assigned to a build for a specific role
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<boolean>}
   */
  async isAssignedToRole(buildId, personaRole) {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    return this.validateUserAssignment(buildId, user.id, personaRole);
  }

  /**
   * Check if current user can submit a section
   * Validates assignment and checks if section already submitted
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @param {Array} existingSections - Existing sections for the build
   * @returns {Promise<{canSubmit: boolean, reason: string}>}
   */
  async canSubmitSection(buildId, personaRole, existingSections = []) {
    const user = useAuthStore.getState().user;
    if (!user) {
      return { canSubmit: false, reason: 'User not authenticated' };
    }

    // Check assignment
    const isAssigned = await this.validateUserAssignment(buildId, user.id, personaRole);
    if (!isAssigned) {
      return {
        canSubmit: false,
        reason: 'You are not assigned to this build for this role'
      };
    }

    // Check if section already submitted
    const alreadySubmitted = existingSections.some(s => s.persona_role === personaRole);
    if (alreadySubmitted) {
      return {
        canSubmit: false,
        reason: 'Section already submitted for this role'
      };
    }

    return { canSubmit: true, reason: '' };
  }

  /**
   * Get assignment summary for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {total, byRole: {workload_owner: [], data_owner: [], auditor: []}}
   */
  async getAssignmentSummary(buildId) {
    const assignments = await this.getBuildAssignments(buildId);

    const byRole = {
      SOLUTION_PROVIDER: [],
      DATA_OWNER: [],
      AUDITOR: [],
      ENV_OPERATOR: []
    };

    assignments.forEach(assignment => {
      const roleName = assignment.role_name || assignment.persona_role;
      if (byRole[roleName]) {
        byRole[roleName].push(assignment);
      }
    });

    return {
      total: assignments.length,
      byRole,
      workloadOwnerCount: byRole.SOLUTION_PROVIDER.length,
      dataOwnerCount: byRole.DATA_OWNER.length,
      auditorCount: byRole.AUDITOR.length,
      envOperatorCount: byRole.ENV_OPERATOR.length
    };
  }

  /**
   * Check if all required roles are assigned
   * @param {string} buildId - Build ID
   * @returns {Promise<{complete: boolean, missing: Array<string>}>}
   */
  async checkAssignmentCompleteness(buildId) {
    const summary = await this.getAssignmentSummary(buildId);
    const missing = [];

    if (summary.workloadOwnerCount === 0) missing.push('SOLUTION_PROVIDER');
    if (summary.dataOwnerCount === 0) missing.push('DATA_OWNER');
    if (summary.auditorCount === 0) missing.push('AUDITOR');
    if (summary.envOperatorCount === 0) missing.push('ENV_OPERATOR');

    return {
      complete: missing.length === 0,
      missing
    };
  }

  /**
   * Get the registered public key of the AUDITOR assigned to a build.
   * DATA_OWNER needs this to wrap the symmetric key before submitting the env section.
   * @param {string} buildId
   * @returns {Promise<string>} PEM public key
   */
  async getAuditorPublicKey(buildId) {
    const assignments = await this.getBuildAssignments(buildId);
    const auditorAssignment = assignments.find(a => a.role_name === 'AUDITOR');
    if (!auditorAssignment) throw new Error('No Auditor is assigned to this build yet.');

    const response = await apiClient.get(`/users/${auditorAssignment.user_id}/public-key`);
    const pubKey = response.data?.public_key;
    if (!pubKey) throw new Error('Auditor has not registered a public key yet.');
    return pubKey;
  }
}

export default new AssignmentService();

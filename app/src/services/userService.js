import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';

/**
 * User Service - Admin user management operations
 * Handles user CRUD, role management, and public key operations
 */
class UserService {
  /**
   * List all users (admin only)
   * @returns {Promise<Array>}
   */
  async listUsers() {
    const response = await apiClient.get('/users');
    return response.data.users || [];
  }

  /**
   * Create a new user (admin only)
   * @param {string} name - User's full name
   * @param {string} email - User's email
   * @param {string} password - Initial password
   * @param {Array<string>} roles - Role names (e.g., ['admin', 'architect'])
   * @returns {Promise<Object>}
   */
  async createUser(name, email, password, roles) {
    const response = await apiClient.post('/users', {
      name,
      email,
      password,
      roles
    });

    return response.data.user;
  }

  /**
   * Update user roles (admin only)
   * @param {string} userId - User ID
   * @param {Array<string>} roles - New role names
   * @returns {Promise<Object>}
   */
  async updateUserRoles(userId, roles) {
    const response = await apiClient.patch(`/users/${userId}/roles`, {
      roles
    });

    return response.data;
  }

  /**
   * Update user profile details (admin only)
   * @param {string} userId - User ID
   * @param {string} name - User's full name
   * @param {string} email - User's email
   * @returns {Promise<Object>}
   */
  async updateUserProfile(userId, name, email) {
    const response = await apiClient.patch(`/users/${userId}`, {
      name,
      email
    });

    return response.data;
  }

  /**
   * Deactivate a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deactivateUser(userId) {
    await apiClient.delete(`/users/${userId}`);
  }

  /**
   * Reactivate a deactivated user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async reactivateUser(userId) {
    const response = await apiClient.patch(`/users/${userId}/reactivate`);
    return response.data;
  }

  /**
   * Admin reset password for a user (admin only)
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<Object>}
   */
  async adminResetPassword(userId, newPassword) {
    const response = await apiClient.patch(`/users/${userId}/reset-password`, {
      new_password: newPassword
    });
    return response.data;
  }

  /**
   * Get user by ID (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getUser(userId) {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  }

  /**
   * Register public key for a user (admin only)
   * @param {string} userId - User ID
   * @param {string} publicKey - PEM formatted public key
   * @returns {Promise<Object>}
   */
  async registerPublicKeyForUser(userId, publicKey) {
    const response = await apiClient.put(`/users/${userId}/public-key`, {
      public_key: publicKey
    });

    return response.data;
  }

  /**
   * Get user's public key (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getUserPublicKey(userId) {
    const response = await apiClient.get(`/users/${userId}/public-key`);
    return response.data;
  }

  /**
   * Change user's password (admin only)
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<Object>}
   */
  async changeUserPassword(userId, newPassword) {
    const response = await apiClient.patch(`/users/${userId}/password`, {
      new_password: newPassword
    });

    return response.data;
  }

  /**
   * Force password change on next login (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async forcePasswordChange(userId) {
    const response = await apiClient.post(`/rotation/force-password-change/${userId}`);
    return response.data;
  }

  /**
   * Force key rotation by revoking current public key (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async forceKeyRotation(userId) {
    const response = await apiClient.post(`/rotation/revoke-key/${userId}`);
    return response.data;
  }

  /**
   * List user's API tokens
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async listUserTokens(userId) {
    const response = await apiClient.get(`/users/${userId}/tokens`);
    return response.data.tokens || [];
  }

  /**
   * Create API token for user
   * @param {string} userId - User ID
   * @param {string} name - Token name/description
   * @param {number} expiresInDays - Token expiry in days
   * @returns {Promise<Object>}
   */
  async createToken(userId, name, expiresInDays) {
    const response = await apiClient.post(`/users/${userId}/tokens`, {
      name,
      expires_in_days: expiresInDays
    });

    return response.data;
  }

  /**
   * Revoke API token
   * @param {string} userId - User ID
   * @param {string} tokenId - Token ID
   * @returns {Promise<void>}
   */
  async revokeToken(userId, tokenId) {
    await apiClient.delete(`/users/${userId}/tokens/${tokenId}`);
  }

  /**
   * Get user's build assignments
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserAssignments(userId) {
    const response = await apiClient.get(`/users/${userId}/assignments`);
    return response.data.assignments || [];
  }

  /**
   * Check if current user is admin
   * @returns {boolean}
   */
  isAdmin() {
    return useAuthStore.getState().hasRole('admin');
  }

  /**
   * Check if current user is architect
   * @returns {boolean}
   */
  isArchitect() {
    return useAuthStore.getState().hasRole('architect');
  }

  /**
   * Check if current user has specific role
   * @param {string} roleName - Role name
   * @returns {boolean}
   */
  hasRole(roleName) {
    return useAuthStore.getState().hasRole(roleName);
  }
}

export default new UserService();


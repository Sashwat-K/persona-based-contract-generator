import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';

class AuthService {
  /**
   * Login with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{user, token}>}
   */
  async login(email, password) {
    const response = await apiClient.post('/auth/login', { email, password });
    const { token, user } = response.data;

    // Store auth in store
    useAuthStore.getState().setAuth(user, token);
    apiClient.setAuthToken(token);

    return { token, user };
  }

  /**
   * Logout current user
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      useAuthStore.getState().clearAuth();
      apiClient.clearAuthToken();
    }
  }

  /**
   * Change user password
   * @param {string} oldPassword 
   * @param {string} newPassword 
   */
  async changePassword(oldPassword, newPassword) {
    const user = useAuthStore.getState().user;
    const response = await apiClient.patch(`/users/${user.id}/password`, {
      old_password: oldPassword,
      new_password: newPassword
    });

    // Update must_change_password flag
    useAuthStore.getState().setMustChangePassword(false);

    return response.data;
  }

  /**
   * Register public key for current user
   * @param {string} publicKey - PEM formatted public key
   * @returns {Promise<{fingerprint, expires_at}>}
   */
  async registerPublicKey(publicKey) {
    const user = useAuthStore.getState().user;
    const response = await apiClient.put(`/users/${user.id}/public-key`, {
      public_key: publicKey
    });

    const { fingerprint, created_at, expires_at } = response.data;

    // Update auth store
    useAuthStore.getState().updatePublicKey(
      fingerprint,
      expires_at || null
    );

    return {
      fingerprint: fingerprint,
      createdAt: created_at || null,
      expiresAt: expires_at || null
    };
  }

  /**
   * Get public key for a user (or current user if userId is null)
   * @param {string} userId - Optional user ID
   */
  async getPublicKey(userId = null) {
    const targetId = userId || useAuthStore.getState().user.id;
    const response = await apiClient.get(`/users/${targetId}/public-key`);
    return response.data;
  }

  /**
   * Get public key for current logged in user
   */
  async getMyPublicKey() {
    const user = useAuthStore.getState().user;
    const response = await apiClient.get(`/users/${user.id}/public-key`);
    return response.data;
  }

  /**
   * Validate current session token
   * @returns {Promise<boolean>}
   */
  async validateSession() {
    try {
      // NOTE: backend doesn't seem to have a GET /users/{id} for self profile.
      // If we implement one, we use user.id
      const user = useAuthStore.getState().user;
      if (!user) return false;
      // const response = await apiClient.get(`/users/${user.id}`);
      // useAuthStore.getState().updateUser(response.data);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user info
   * @returns {Promise<User>}
   */
  async getCurrentUser() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("No user in state");
    // const response = await apiClient.get(`/users/${user.id}`);
    return user;
  }

  /**
   * Check public key expiry status
   * @returns {Promise<Object>} - {isExpired, daysUntilExpiry, expiresAt, fingerprint}
   */
  async checkKeyExpiry() {
    const user = useAuthStore.getState().user;
    if (!user || !user.public_key_expires_at) {
      return {
        isExpired: true,
        daysUntilExpiry: 0,
        expiresAt: null,
        fingerprint: null
      };
    }

    const expiresAt = new Date(user.public_key_expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    return {
      isExpired: daysUntilExpiry <= 0,
      daysUntilExpiry,
      expiresAt: user.public_key_expires_at,
      fingerprint: user.public_key_fingerprint
    };
  }

  /**
   * Get public key for a specific user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getPublicKey(userId) {
    const response = await apiClient.get(`/users/${userId}/public-key`);
    return response.data;
  }

  /**
   * Register public key for a specific user (admin only)
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
   * Force password change for a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async forcePasswordChange(userId) {
    const response = await apiClient.post(`/rotation/force-password-change/${userId}`);
    return response.data;
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string>} - New token
   */
  async refreshToken() {
    const response = await apiClient.post('/auth/refresh');
    const { token } = response.data;

    const user = useAuthStore.getState().user;
    useAuthStore.getState().setAuth(user, token);

    return token;
  }
}

export default new AuthService();



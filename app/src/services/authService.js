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
    const response = await apiClient.patch('/users/me/password', {
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
    const response = await apiClient.put('/users/me/public-key', {
      public_key: publicKey
    });
    
    const { public_key_fingerprint, public_key_expires_at } = response.data;
    
    // Update auth store
    useAuthStore.getState().updatePublicKey(
      public_key_fingerprint,
      public_key_expires_at
    );
    
    return {
      fingerprint: public_key_fingerprint,
      expiresAt: public_key_expires_at
    };
  }

  /**
   * Get current user's public key
   * @returns {Promise<{public_key, fingerprint, expires_at}>}
   */
  async getMyPublicKey() {
    // Get current user ID from auth store
    const { user } = useAuthStore.getState();
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    const response = await apiClient.get(`/users/${user.id}/public-key`);
    return response.data;
  }

  /**
   * Check if current session is valid
   * @returns {Promise<boolean>}
   */
  async validateSession() {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data;
      
      // Update user in store
      useAuthStore.getState().updateUser(user);
      
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
    const response = await apiClient.get('/users/me');
    return response.data;
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

// Made with Bob

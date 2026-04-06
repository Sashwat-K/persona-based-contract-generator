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
    const response = await apiClient.get('/users/me/public-key');
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
}

export default new AuthService();

// Made with Bob

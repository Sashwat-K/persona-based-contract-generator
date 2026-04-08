import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';

/**
 * Token Service - API token management
 * Handles creation, listing, and revocation of API tokens
 */
class TokenService {
  /**
   * List tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async listTokens(userId) {
    const response = await apiClient.get(`/users/${userId}/tokens`);
    const tokens = response.data.tokens || [];
    
    // Update store if it's current user's tokens
    const currentUser = useAuthStore.getState().user;
    if (currentUser && userId === currentUser.id) {
      useAuthStore.getState().setApiTokens(tokens);
    }
    
    return tokens;
  }

  /**
   * List current user's tokens
   * @returns {Promise<Array>}
   */
  async listMyTokens() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    
    return this.listTokens(user.id);
  }

  /**
   * Create a new API token
   * @param {string} userId - User ID
   * @param {string} name - Token name/description
   * @param {number} expiresInDays - Token expiry in days
   * @returns {Promise<Object>} - {token_id, token, name, expires_at}
   */
  async createToken(userId, name, expiresInDays) {
    const response = await apiClient.post(`/users/${userId}/tokens`, {
      name,
      expires_in_days: expiresInDays
    });
    
    const token = response.data;
    
    // Update store if it's current user's token
    const currentUser = useAuthStore.getState().user;
    if (currentUser && userId === currentUser.id) {
      useAuthStore.getState().addApiToken(token);
    }
    
    return token;
  }

  /**
   * Create token for current user
   * @param {string} name - Token name/description
   * @param {number} expiresInDays - Token expiry in days
   * @returns {Promise<Object>}
   */
  async createMyToken(name, expiresInDays) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    
    return this.createToken(user.id, name, expiresInDays);
  }

  /**
   * Revoke an API token
   * @param {string} userId - User ID
   * @param {string} tokenId - Token ID
   * @returns {Promise<void>}
   */
  async revokeToken(userId, tokenId) {
    await apiClient.delete(`/users/${userId}/tokens/${tokenId}`);
    
    // Update store if it's current user's token
    const currentUser = useAuthStore.getState().user;
    if (currentUser && userId === currentUser.id) {
      useAuthStore.getState().removeApiToken(tokenId);
    }
  }

  /**
   * Revoke current user's token
   * @param {string} tokenId - Token ID
   * @returns {Promise<void>}
   */
  async revokeMyToken(tokenId) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    
    return this.revokeToken(user.id, tokenId);
  }

  /**
   * Get token information
   * @param {string} tokenId - Token ID
   * @returns {Promise<Object>}
   */
  async getTokenInfo(tokenId) {
    const response = await apiClient.get(`/tokens/${tokenId}`);
    return response.data;
  }

  /**
   * Validate a token
   * @param {string} token - Token string
   * @returns {Promise<boolean>}
   */
  async validateToken(token) {
    try {
      const response = await apiClient.post('/tokens/validate', { token });
      return response.data.valid || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - {total, active, expired, expiringSoon}
   */
  async getTokenStatistics(userId) {
    const tokens = await this.listTokens(userId);
    const now = Date.now();
    const sevenDaysFromNow = now + (7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      total: tokens.length,
      active: 0,
      expired: 0,
      expiringSoon: 0,
      tokens: {
        active: [],
        expired: [],
        expiringSoon: []
      }
    };
    
    tokens.forEach(token => {
      const expiresAt = new Date(token.expires_at).getTime();
      
      if (expiresAt < now) {
        stats.expired++;
        stats.tokens.expired.push(token);
      } else if (expiresAt < sevenDaysFromNow) {
        stats.expiringSoon++;
        stats.tokens.expiringSoon.push(token);
        stats.active++;
        stats.tokens.active.push(token);
      } else {
        stats.active++;
        stats.tokens.active.push(token);
      }
    });
    
    return stats;
  }

  /**
   * Get current user's token statistics
   * @returns {Promise<Object>}
   */
  async getMyTokenStatistics() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    
    return this.getTokenStatistics(user.id);
  }

  /**
   * Bulk revoke tokens
   * @param {string} userId - User ID
   * @param {Array<string>} tokenIds - Array of token IDs
   * @returns {Promise<Object>} - {success: Array, failed: Array}
   */
  async bulkRevokeTokens(userId, tokenIds) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const tokenId of tokenIds) {
      try {
        await this.revokeToken(userId, tokenId);
        results.success.push(tokenId);
      } catch (error) {
        results.failed.push({
          tokenId,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Revoke all expired tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of tokens revoked
   */
  async revokeExpiredTokens(userId) {
    const stats = await this.getTokenStatistics(userId);
    const expiredTokenIds = stats.tokens.expired.map(t => t.token_id);
    
    if (expiredTokenIds.length === 0) {
      return 0;
    }
    
    const results = await this.bulkRevokeTokens(userId, expiredTokenIds);
    return results.success.length;
  }

  /**
   * Revoke all tokens for current user
   * @returns {Promise<number>}
   */
  async revokeAllMyTokens() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    
    const tokens = await this.listMyTokens();
    const tokenIds = tokens.map(t => t.token_id);
    
    if (tokenIds.length === 0) {
      return 0;
    }
    
    const results = await this.bulkRevokeTokens(user.id, tokenIds);
    return results.success.length;
  }

  /**
   * Generate token name suggestion
   * @param {string} purpose - Token purpose (e.g., 'ci', 'automation', 'testing')
   * @returns {string}
   */
  generateTokenName(purpose = 'general') {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${purpose}-token-${timestamp}`;
  }

  /**
   * Get recommended token expiry options
   * @returns {Array<Object>} - Array of {label, days} objects
   */
  getExpiryOptions() {
    return [
      { label: '7 days', days: 7, recommended: false },
      { label: '30 days', days: 30, recommended: true },
      { label: '60 days', days: 60, recommended: false },
      { label: '90 days', days: 90, recommended: false },
      { label: '180 days', days: 180, recommended: false },
      { label: '1 year', days: 365, recommended: false }
    ];
  }

  /**
   * Format token for display (mask middle part)
   * @param {string} token - Full token string
   * @returns {string} - Masked token
   */
  maskToken(token) {
    if (!token || token.length < 16) {
      return '****';
    }
    
    const start = token.substring(0, 8);
    const end = token.substring(token.length - 8);
    return `${start}...${end}`;
  }

  /**
   * Calculate days until token expiry
   * @param {string} expiresAt - ISO date string
   * @returns {number} - Days until expiry (negative if expired)
   */
  daysUntilExpiry(expiresAt) {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if token is expired
   * @param {string} expiresAt - ISO date string
   * @returns {boolean}
   */
  isTokenExpired(expiresAt) {
    return this.daysUntilExpiry(expiresAt) <= 0;
  }

  /**
   * Check if token is expiring soon (within 7 days)
   * @param {string} expiresAt - ISO date string
   * @returns {boolean}
   */
  isTokenExpiringSoon(expiresAt) {
    const days = this.daysUntilExpiry(expiresAt);
    return days > 0 && days <= 7;
  }

  /**
   * Get token status
   * @param {Object} token - Token object
   * @returns {Object} - {status: string, severity: string, message: string}
   */
  getTokenStatus(token) {
    const days = this.daysUntilExpiry(token.expires_at);
    
    if (days <= 0) {
      return {
        status: 'expired',
        severity: 'error',
        message: `Expired ${Math.abs(days)} days ago`
      };
    } else if (days <= 7) {
      return {
        status: 'expiring_soon',
        severity: 'warning',
        message: `Expires in ${days} days`
      };
    } else {
      return {
        status: 'active',
        severity: 'success',
        message: `Expires in ${days} days`
      };
    }
  }
}

export default new TokenService();

// Made with Bob
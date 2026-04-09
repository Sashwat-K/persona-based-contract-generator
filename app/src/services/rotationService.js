import apiClient from './apiClient';
import { useAuthStore } from '../store/authStore';

/**
 * Rotation Service - Credential rotation monitoring
 * Handles password and public key expiry monitoring and enforcement
 */
class RotationService {
  /**
   * Get expired credentials (admin only)
   * @returns {Promise<Object>} - {expired_passwords: Array, expired_keys: Array}
   */
  async getExpiredCredentials() {
    const response = await apiClient.get('/rotation/expired');
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
   * Revoke expired public key (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async revokeExpiredKey(userId) {
    const response = await apiClient.post(`/rotation/revoke-key/${userId}`);
    return response.data;
  }

  /**
   * Check current user's credential status
   * @returns {Promise<Object>} - {passwordExpiry, keyExpiry, warnings}
   */
  async checkMyCredentialStatus() {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    const status = {
      passwordExpiry: null,
      keyExpiry: null,
      warnings: []
    };

    // Check password expiry
    if (user.password_changed_at) {
      const passwordChangedAt = new Date(user.password_changed_at);
      const passwordAge = Date.now() - passwordChangedAt.getTime();
      const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = 90 - daysOld;

      if (daysOld >= 90) {
        status.warnings.push({
          type: 'password',
          severity: 'error',
          message: 'Your password has expired. Please change it immediately.',
          daysOverdue: daysOld - 90
        });
      } else if (daysOld >= 83) {
        status.warnings.push({
          type: 'password',
          severity: 'warning',
          message: `Your password will expire in ${daysUntilExpiry} days.`,
          daysUntilExpiry
        });
      }

      status.passwordExpiry = {
        changedAt: user.password_changed_at,
        daysOld,
        daysUntilExpiry,
        isExpired: daysOld >= 90
      };
    }

    // Check key expiry
    if (user.public_key_expires_at) {
      const expiresAt = new Date(user.public_key_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        status.warnings.push({
          type: 'key',
          severity: 'error',
          message: 'Your public key has expired. Please register a new key.',
          daysOverdue: Math.abs(daysUntilExpiry)
        });
      } else if (daysUntilExpiry <= 7) {
        status.warnings.push({
          type: 'key',
          severity: 'warning',
          message: `Your public key will expire in ${daysUntilExpiry} days.`,
          daysUntilExpiry
        });
      }

      status.keyExpiry = {
        expiresAt: user.public_key_expires_at,
        daysUntilExpiry,
        isExpired: daysUntilExpiry <= 0,
        fingerprint: user.public_key_fingerprint
      };
    }

    return status;
  }

  /**
   * Get expiry warnings for current user
   * @returns {Promise<Array>} - Array of warning objects
   */
  async getExpiryWarnings() {
    const status = await this.checkMyCredentialStatus();
    return status?.warnings || [];
  }

  /**
   * Check if current user has expired credentials
   * @returns {Promise<boolean>}
   */
  async hasExpiredCredentials() {
    const status = await this.checkMyCredentialStatus();
    if (!status) return false;

    return status.warnings.some(w => w.severity === 'error');
  }

  /**
   * Get credential expiry summary for all users (admin only)
   * @returns {Promise<Object>} - Summary statistics
   */
  async getExpiryDashboard() {
    const expiredData = await this.getExpiredCredentials();

    const summary = {
      totalExpiredPasswords: expiredData.expired_passwords?.length || 0,
      totalExpiredKeys: expiredData.expired_keys?.length || 0,
      totalAffectedUsers: new Set([
        ...(expiredData.expired_passwords?.map(u => u.user_id) || []),
        ...(expiredData.expired_keys?.map(u => u.user_id) || [])
      ]).size,
      expiredPasswords: expiredData.expired_passwords || [],
      expiredKeys: expiredData.expired_keys || []
    };

    return summary;
  }

  /**
   * Get users with credentials expiring soon (admin only)
   * @param {number} days - Number of days threshold (default: 7)
   * @returns {Promise<Array>}
   */
  async getUsersExpiringSoon(days = 7) {
    const expiredData = await this.getExpiredCredentials();
    const threshold = Date.now() + (days * 24 * 60 * 60 * 1000);

    const expiringSoon = [];

    // Check passwords
    if (expiredData.expired_passwords) {
      expiredData.expired_passwords.forEach(user => {
        const changedAt = new Date(user.password_changed_at);
        const expiryDate = new Date(changedAt.getTime() + (90 * 24 * 60 * 60 * 1000));

        if (expiryDate.getTime() <= threshold) {
          expiringSoon.push({
            userId: user.user_id,
            userName: user.name,
            email: user.email,
            type: 'password',
            expiresAt: expiryDate.toISOString(),
            daysUntilExpiry: Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24))
          });
        }
      });
    }

    // Check keys
    if (expiredData.expired_keys) {
      expiredData.expired_keys.forEach(user => {
        const expiresAt = new Date(user.public_key_expires_at);

        if (expiresAt.getTime() <= threshold) {
          expiringSoon.push({
            userId: user.user_id,
            userName: user.name,
            email: user.email,
            type: 'key',
            expiresAt: user.public_key_expires_at,
            daysUntilExpiry: Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)),
            fingerprint: user.public_key_fingerprint
          });
        }
      });
    }

    return expiringSoon;
  }

  /**
   * Bulk force password change for multiple users (admin only)
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Object>} - {success: Array, failed: Array}
   */
  async bulkForcePasswordChange(userIds) {
    const results = {
      success: [],
      failed: []
    };

    for (const userId of userIds) {
      try {
        await this.forcePasswordChange(userId);
        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          userId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Bulk revoke expired keys for multiple users (admin only)
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Object>} - {success: Array, failed: Array}
   */
  async bulkRevokeKeys(userIds) {
    const results = {
      success: [],
      failed: []
    };

    for (const userId of userIds) {
      try {
        await this.revokeExpiredKey(userId);
        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          userId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Calculate password strength
   * @param {string} password - Password to check
   * @returns {Object} - {score: number, feedback: Array<string>}
   */
  calculatePasswordStrength(password) {
    const feedback = [];
    let score = 0;

    // Length check
    if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('Password should be at least 8 characters long');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add uppercase letters');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add lowercase letters');
    }

    // Number check
    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add numbers');
    }

    // Special character check
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Add special characters');
    }

    // Common patterns check
    const commonPatterns = ['password', '123456', 'qwerty', 'admin'];
    if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
      score -= 2;
      feedback.push('Avoid common patterns');
    }

    return {
      score: Math.max(0, Math.min(5, score)),
      strength: score >= 4 ? 'strong' : score >= 2 ? 'medium' : 'weak',
      feedback
    };
  }

  /**
   * Get rotation policy information
   * @returns {Object} - Policy details
   */
  getRotationPolicy() {
    return {
      passwordExpiry: {
        days: 90,
        warningDays: 7,
        description: 'Passwords must be changed every 90 days'
      },
      publicKeyExpiry: {
        days: 90,
        warningDays: 7,
        description: 'Public keys must be rotated every 90 days'
      },
      enforcement: {
        blockExpiredPassword: true,
        blockExpiredKey: true,
        description: 'Users with expired credentials cannot perform operations'
      }
    };
  }
}

export default new RotationService();


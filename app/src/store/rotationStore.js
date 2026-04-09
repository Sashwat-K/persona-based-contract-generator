import { create } from 'zustand';

/**
 * Rotation Store - Credential rotation monitoring state
 * Manages expired credentials, warnings, and rotation status
 */
export const useRotationStore = create((set, get) => ({
  // State
  expiredCredentials: {
    expired_passwords: [],
    expired_keys: []
  },

  myCredentialStatus: null,

  loading: false,
  error: null,

  // Dashboard data
  dashboard: {
    totalExpiredPasswords: 0,
    totalExpiredKeys: 0,
    totalAffectedUsers: 0,
    lastUpdated: null
  },

  // Expiring soon (within 7 days)
  expiringSoon: [],

  // Actions
  setExpiredCredentials: (data) => set({
    expiredCredentials: data,
    dashboard: {
      totalExpiredPasswords: data.expired_passwords?.length || 0,
      totalExpiredKeys: data.expired_keys?.length || 0,
      totalAffectedUsers: new Set([
        ...(data.expired_passwords?.map(u => u.user_id) || []),
        ...(data.expired_keys?.map(u => u.user_id) || [])
      ]).size,
      lastUpdated: new Date().toISOString()
    },
    error: null
  }),

  setMyStatus: (status) => set({ myCredentialStatus: status }),

  setExpiringSoon: (users) => set({ expiringSoon: users }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  // Update after action
  removeExpiredPassword: (userId) => set((state) => ({
    expiredCredentials: {
      ...state.expiredCredentials,
      expired_passwords: state.expiredCredentials.expired_passwords.filter(
        u => u.user_id !== userId
      )
    },
    dashboard: {
      ...state.dashboard,
      totalExpiredPasswords: Math.max(0, state.dashboard.totalExpiredPasswords - 1)
    }
  })),

  removeExpiredKey: (userId) => set((state) => ({
    expiredCredentials: {
      ...state.expiredCredentials,
      expired_keys: state.expiredCredentials.expired_keys.filter(
        u => u.user_id !== userId
      )
    },
    dashboard: {
      ...state.dashboard,
      totalExpiredKeys: Math.max(0, state.dashboard.totalExpiredKeys - 1)
    }
  })),

  // Computed
  hasExpiredCredentials: () => {
    const state = get();
    return state.dashboard.totalExpiredPasswords > 0 ||
      state.dashboard.totalExpiredKeys > 0;
  },

  getExpiredPasswordUsers: () => {
    const state = get();
    return state.expiredCredentials.expired_passwords || [];
  },

  getExpiredKeyUsers: () => {
    const state = get();
    return state.expiredCredentials.expired_keys || [];
  },

  getUsersWithBothExpired: () => {
    const state = get();
    const passwordUserIds = new Set(
      state.expiredCredentials.expired_passwords?.map(u => u.user_id) || []
    );
    const keyUserIds = new Set(
      state.expiredCredentials.expired_keys?.map(u => u.user_id) || []
    );

    const bothExpired = [];
    passwordUserIds.forEach(userId => {
      if (keyUserIds.has(userId)) {
        const passwordUser = state.expiredCredentials.expired_passwords.find(
          u => u.user_id === userId
        );
        const keyUser = state.expiredCredentials.expired_keys.find(
          u => u.user_id === userId
        );

        bothExpired.push({
          user_id: userId,
          name: passwordUser?.name || keyUser?.name,
          email: passwordUser?.email || keyUser?.email,
          password_changed_at: passwordUser?.password_changed_at,
          public_key_expires_at: keyUser?.public_key_expires_at
        });
      }
    });

    return bothExpired;
  },

  getMyWarnings: () => {
    const state = get();
    return state.myCredentialStatus?.warnings || [];
  },

  hasMyWarnings: () => {
    const state = get();
    return (state.myCredentialStatus?.warnings?.length || 0) > 0;
  },

  hasMyErrors: () => {
    const state = get();
    return state.myCredentialStatus?.warnings?.some(w => w.severity === 'error') || false;
  },

  getExpiringSoonCount: () => {
    const state = get();
    return state.expiringSoon.length;
  },

  getExpiringSoonByType: () => {
    const state = get();
    const byType = {
      password: [],
      key: []
    };

    state.expiringSoon.forEach(item => {
      if (item.type === 'password') {
        byType.password.push(item);
      } else if (item.type === 'key') {
        byType.key.push(item);
      }
    });

    return byType;
  },

  getDashboardSummary: () => {
    const state = get();
    return {
      ...state.dashboard,
      hasIssues: state.hasExpiredCredentials(),
      expiringSoonCount: state.expiringSoon.length,
      criticalUsers: state.getUsersWithBothExpired().length
    };
  },

  // Get users sorted by urgency
  getUsersByUrgency: () => {
    const state = get();
    const users = [];

    // Add users with both expired
    const bothExpired = state.getUsersWithBothExpired();
    bothExpired.forEach(user => {
      users.push({
        ...user,
        urgency: 'critical',
        issues: ['password', 'key']
      });
    });

    // Add users with only password expired
    const passwordUserIds = new Set(bothExpired.map(u => u.user_id));
    state.expiredCredentials.expired_passwords?.forEach(user => {
      if (!passwordUserIds.has(user.user_id)) {
        users.push({
          ...user,
          urgency: 'high',
          issues: ['password']
        });
      }
    });

    // Add users with only key expired
    const keyUserIds = new Set(bothExpired.map(u => u.user_id));
    state.expiredCredentials.expired_keys?.forEach(user => {
      if (!keyUserIds.has(user.user_id)) {
        users.push({
          ...user,
          urgency: 'high',
          issues: ['key']
        });
      }
    });

    // Add users expiring soon
    state.expiringSoon.forEach(item => {
      const existingUser = users.find(u => u.user_id === item.userId);
      if (!existingUser) {
        users.push({
          user_id: item.userId,
          name: item.userName,
          email: item.email,
          urgency: 'medium',
          issues: [item.type],
          expiresAt: item.expiresAt,
          daysUntilExpiry: item.daysUntilExpiry
        });
      }
    });

    return users;
  },

  // Statistics
  getRotationStatistics: () => {
    const state = get();
    const usersByUrgency = state.getUsersByUrgency();

    return {
      total: usersByUrgency.length,
      critical: usersByUrgency.filter(u => u.urgency === 'critical').length,
      high: usersByUrgency.filter(u => u.urgency === 'high').length,
      medium: usersByUrgency.filter(u => u.urgency === 'medium').length,
      byIssueType: {
        password: usersByUrgency.filter(u => u.issues.includes('password')).length,
        key: usersByUrgency.filter(u => u.issues.includes('key')).length,
        both: usersByUrgency.filter(u => u.issues.length > 1).length
      }
    };
  }
}));


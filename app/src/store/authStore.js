import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SETUP_PENDING_NONE = Object.freeze([]);
const SETUP_PENDING_PASSWORD = Object.freeze(['password_change']);
const SETUP_PENDING_PUBLIC_KEY = Object.freeze(['public_key_registration']);
const SETUP_PENDING_BOTH = Object.freeze(['password_change', 'public_key_registration']);

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      roles: [],
      isAuthenticated: false,
      mustChangePassword: false,
      publicKeyExpiry: null,
      publicKeyFingerprint: null,
      requiresSetup: false,
      setupPending: [],

      // NEW: API Tokens
      apiTokens: [],

      // NEW: Credential Expiry Warnings
      keyExpiryWarning: false,
      passwordExpiryWarning: false,
      lastPasswordChange: null,

      // NEW: Session Management
      sessionExpiresAt: null,

      // Actions
      setAuth: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        roles: user.roles || [],
        mustChangePassword: user.must_change_password || false,
        publicKeyExpiry: user.public_key_expires_at,
        publicKeyFingerprint: user.public_key_fingerprint,
        requiresSetup: user.requires_setup || false,
        setupPending: user.setup_pending || [],
        lastPasswordChange: user.password_changed_at,
        sessionExpiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }),

      clearAuth: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        roles: [],
        mustChangePassword: false,
        publicKeyExpiry: null,
        publicKeyFingerprint: null,
        requiresSetup: false,
        setupPending: [],
        apiTokens: [],
        keyExpiryWarning: false,
        passwordExpiryWarning: false,
        lastPasswordChange: null,
        sessionExpiresAt: null
      }),

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),

      updatePublicKey: (fingerprint, expiresAt) => set((state) => {
        const setupPending = (state.setupPending || []).filter(s => s !== 'public_key_registration');
        return {
          user: state.user ? {
            ...state.user,
            public_key_fingerprint: fingerprint,
            public_key_expires_at: expiresAt
          } : null,
          publicKeyExpiry: expiresAt,
          publicKeyFingerprint: fingerprint,
          setupPending,
          requiresSetup: setupPending.length > 0
        };
      }),

      setMustChangePassword: (value) => set((state) => {
        const setupPending = value
          ? Array.from(new Set([...(state.setupPending || []), 'password_change']))
          : (state.setupPending || []).filter(s => s !== 'password_change');
        return {
          mustChangePassword: value,
          user: state.user ? { ...state.user, must_change_password: value } : state.user,
          setupPending,
          requiresSetup: setupPending.length > 0
        };
      }),

      setSetupState: ({ requiresSetup, setupPending }) => {
        const pending = setupPending || [];
        set((state) => ({
          requiresSetup: requiresSetup ?? (pending.length > 0),
          setupPending: pending,
          user: state.user ? {
            ...state.user,
            requires_setup: requiresSetup ?? (pending.length > 0),
            setup_pending: pending
          } : state.user
        }));
      },

      // NEW: API Token Actions
      setApiTokens: (tokens) => set({ apiTokens: tokens }),

      addApiToken: (token) => set((state) => ({
        apiTokens: [token, ...state.apiTokens]
      })),

      removeApiToken: (tokenId) => set((state) => ({
        apiTokens: state.apiTokens.filter(t => t.token_id !== tokenId)
      })),

      updateApiToken: (tokenId, updates) => set((state) => ({
        apiTokens: state.apiTokens.map(t =>
          t.token_id === tokenId ? { ...t, ...updates } : t
        )
      })),

      // NEW: Expiry Warning Actions
      setKeyExpiryWarning: (value) => set({ keyExpiryWarning: value }),

      setPasswordExpiryWarning: (value) => set({ passwordExpiryWarning: value }),

      checkExpiryWarnings: () => {
        const state = get();
        let keyWarning = false;
        let passwordWarning = false;

        // Check key expiry
        if (state.publicKeyExpiry) {
          const daysUntilExpiry = state.daysUntilKeyExpiry();
          keyWarning = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
        }

        // Check password expiry
        if (state.lastPasswordChange) {
          const passwordAge = Date.now() - new Date(state.lastPasswordChange).getTime();
          const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
          passwordWarning = daysOld >= 83 && daysOld < 90;
        }

        set({ keyExpiryWarning: keyWarning, passwordExpiryWarning: passwordWarning });
      },

      // Computed
      hasRole: (roleName) => {
        const state = get();
        return state.roles.some(r => (typeof r === 'string' ? r === roleName : r.name === roleName));
      },

      isKeyExpired: () => {
        const state = get();
        const expiry = state.publicKeyExpiry || state.user?.public_key_expires_at;
        if (!expiry) return true;
        return new Date(expiry) < new Date();
      },

      daysUntilKeyExpiry: () => {
        const state = get();
        if (!state.publicKeyExpiry) return 0;
        const expiry = new Date(state.publicKeyExpiry);
        const now = new Date();
        const diff = expiry - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
      },

      // NEW: Password Expiry Computed
      isPasswordExpired: () => {
        const state = get();
        if (!state.lastPasswordChange) return false;
        const passwordAge = Date.now() - new Date(state.lastPasswordChange).getTime();
        const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
        return daysOld >= 90;
      },

      daysUntilPasswordExpiry: () => {
        const state = get();
        if (!state.lastPasswordChange) return 0;
        const passwordAge = Date.now() - new Date(state.lastPasswordChange).getTime();
        const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
        return Math.max(0, 90 - daysOld);
      },

      // NEW: Session Computed
      isSessionExpired: () => {
        const state = get();
        if (!state.sessionExpiresAt) return false;
        return Date.now() >= state.sessionExpiresAt;
      },

      getSetupPending: () => {
        const state = get();
        if (state.setupPending?.length) return state.setupPending;
        const needsPasswordChange = !!(state.mustChangePassword || state.user?.must_change_password);
        const hasFingerprint = !!(state.publicKeyFingerprint || state.user?.public_key_fingerprint);
        const keyExpired = state.isKeyExpired();
        const needsPublicKey = !hasFingerprint || keyExpired;

        if (needsPasswordChange && needsPublicKey) return SETUP_PENDING_BOTH;
        if (needsPasswordChange) return SETUP_PENDING_PASSWORD;
        if (needsPublicKey) return SETUP_PENDING_PUBLIC_KEY;
        return SETUP_PENDING_NONE;
      },

      isSetupRequired: () => {
        const state = get();
        if (state.setupPending?.length > 0) return true;
        if (state.requiresSetup && state.setupPending?.length === 0) return false;
        return state.getSetupPending().length > 0;
      },

      // NEW: Get active API tokens count
      getActiveTokensCount: () => {
        const state = get();
        const now = Date.now();
        return state.apiTokens.filter(t =>
          new Date(t.expires_at).getTime() > now
        ).length;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        publicKeyExpiry: state.publicKeyExpiry,
        publicKeyFingerprint: state.publicKeyFingerprint,
        lastPasswordChange: state.lastPasswordChange,
      })
    }
  )
);

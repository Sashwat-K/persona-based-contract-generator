import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        apiTokens: [],
        keyExpiryWarning: false,
        passwordExpiryWarning: false,
        lastPasswordChange: null,
        sessionExpiresAt: null
      }),
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      
      updatePublicKey: (fingerprint, expiresAt) => set((state) => ({
        user: state.user ? { 
          ...state.user, 
          public_key_fingerprint: fingerprint,
          public_key_expires_at: expiresAt
        } : null,
        publicKeyExpiry: expiresAt,
        publicKeyFingerprint: fingerprint
      })),
      
      setMustChangePassword: (value) => set({ mustChangePassword: value }),
      
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
        return state.roles.some(r => r.name === roleName);
      },
      
      isKeyExpired: () => {
        const state = get();
        if (!state.publicKeyExpiry) return true;
        return new Date(state.publicKeyExpiry) < new Date();
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
        user: state.user
      })
    }
  )
);

// Made with Bob

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
      
      // Actions
      setAuth: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true,
        roles: user.roles || [],
        mustChangePassword: user.must_change_password || false,
        publicKeyExpiry: user.public_key_expires_at,
        publicKeyFingerprint: user.public_key_fingerprint
      }),
      
      clearAuth: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false,
        roles: [],
        mustChangePassword: false,
        publicKeyExpiry: null,
        publicKeyFingerprint: null
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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useConfigStore = create(
  persist(
    (set, get) => ({
      // State
      serverUrl: 'https://localhost:8443',
      isServerConfigured: false,
      lastConnectionTest: null,
      connectionStatus: 'unknown', // 'unknown' | 'connected' | 'failed'
      
      // Actions
      setServerUrl: (url) => set({ 
        serverUrl: url,
        isServerConfigured: true 
      }),
      
      setConnectionStatus: (status, timestamp = new Date().toISOString()) => set({
        connectionStatus: status,
        lastConnectionTest: timestamp
      }),
      
      resetServerConfig: () => set({
        serverUrl: 'https://localhost:8443',
        isServerConfigured: false,
        lastConnectionTest: null,
        connectionStatus: 'unknown'
      }),
      
      // Computed
      isConnected: () => {
        const state = get();
        return state.connectionStatus === 'connected';
      },
      
      needsConfiguration: () => {
        const state = get();
        return !state.isServerConfigured || state.connectionStatus === 'failed';
      }
    }),
    {
      name: 'server-config-storage',
      partialize: (state) => ({ 
        serverUrl: state.serverUrl,
        isServerConfigured: state.isServerConfigured
      })
    }
  )
);

// Made with Bob

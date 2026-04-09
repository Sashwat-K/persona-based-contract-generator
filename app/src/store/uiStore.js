import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  // State
  notifications: [],
  modals: {},
  sideNavExpanded: true,
  theme: 'g100', // Carbon dark theme

  // Notification Actions
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...notification
    }]
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] }),

  // Modal Actions
  openModal: (modalId, data = null) => set((state) => ({
    modals: {
      ...state.modals,
      [modalId]: { open: true, data }
    }
  })),

  closeModal: (modalId) => set((state) => ({
    modals: {
      ...state.modals,
      [modalId]: { open: false, data: null }
    }
  })),

  closeAllModals: () => set({ modals: {} }),

  // UI State Actions
  toggleSideNav: () => set((state) => ({
    sideNavExpanded: !state.sideNavExpanded
  })),

  setSideNavExpanded: (expanded) => set({ sideNavExpanded: expanded }),

  setTheme: (theme) => set({ theme }),

  // Computed
  isModalOpen: (modalId) => {
    const state = get();
    return state.modals[modalId]?.open || false;
  },

  getModalData: (modalId) => {
    const state = get();
    return state.modals[modalId]?.data || null;
  },

  hasNotifications: () => {
    const state = get();
    return state.notifications.length > 0;
  }
}));

// Helper functions for common notification types
export const showSuccessNotification = (title, subtitle) => {
  useUIStore.getState().addNotification({
    kind: 'success',
    title,
    subtitle,
    timeout: 5000
  });
};

export const showErrorNotification = (title, subtitle) => {
  useUIStore.getState().addNotification({
    kind: 'error',
    title,
    subtitle,
    timeout: 10000
  });
};

export const showWarningNotification = (title, subtitle) => {
  useUIStore.getState().addNotification({
    kind: 'warning',
    title,
    subtitle,
    timeout: 7000
  });
};

export const showInfoNotification = (title, subtitle) => {
  useUIStore.getState().addNotification({
    kind: 'info',
    title,
    subtitle,
    timeout: 5000
  });
};



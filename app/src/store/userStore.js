import { create } from 'zustand';

/**
 * User Store - User management state (Admin)
 * Manages user list, filters, and selection for admin operations
 */
export const useUserStore = create((set, get) => ({
  // State
  users: [],
  selectedUser: null,
  loading: false,
  error: null,

  // Filters
  filters: {
    search: '',
    role: null,
    status: 'all', // 'all', 'active', 'expired_password', 'expired_key'
  },

  // Pagination
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0
  },

  // Actions
  setUsers: (users) => set({ users, error: null }),

  addUser: (user) => set((state) => ({
    users: [user, ...state.users],
    pagination: {
      ...state.pagination,
      total: state.pagination.total + 1
    }
  })),

  updateUser: (userId, updates) => set((state) => ({
    users: state.users.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    ),
    selectedUser: state.selectedUser?.id === userId
      ? { ...state.selectedUser, ...updates }
      : state.selectedUser
  })),

  removeUser: (userId) => set((state) => ({
    users: state.users.filter(u => u.id !== userId),
    selectedUser: state.selectedUser?.id === userId ? null : state.selectedUser,
    pagination: {
      ...state.pagination,
      total: Math.max(0, state.pagination.total - 1)
    }
  })),

  selectUser: (userId) => set((state) => ({
    selectedUser: state.users.find(u => u.id === userId) || null
  })),

  clearSelectedUser: () => set({ selectedUser: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  // Filter Actions
  setSearchFilter: (search) => set((state) => ({
    filters: { ...state.filters, search }
  })),

  setRoleFilter: (role) => set((state) => ({
    filters: { ...state.filters, role }
  })),

  setStatusFilter: (status) => set((state) => ({
    filters: { ...state.filters, status }
  })),

  clearFilters: () => set({
    filters: {
      search: '',
      role: null,
      status: 'all'
    }
  }),

  // Pagination Actions
  setPage: (page) => set((state) => ({
    pagination: { ...state.pagination, page }
  })),

  setPageSize: (pageSize) => set((state) => ({
    pagination: { ...state.pagination, pageSize, page: 1 }
  })),

  setTotal: (total) => set((state) => ({
    pagination: { ...state.pagination, total }
  })),

  // Computed
  getUserById: (userId) => {
    const state = get();
    return state.users.find(u => u.id === userId);
  },

  getUsersByRole: (roleName) => {
    const state = get();
    return state.users.filter(u =>
      u.roles?.some(r => r.name === roleName)
    );
  },

  getFilteredUsers: () => {
    const state = get();
    let filtered = [...state.users];

    // Apply search filter
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search)
      );
    }

    // Apply role filter
    if (state.filters.role) {
      filtered = filtered.filter(u =>
        u.roles?.some(r => r.name === state.filters.role)
      );
    }

    // Apply status filter
    if (state.filters.status !== 'all') {
      const now = Date.now();

      if (state.filters.status === 'expired_password') {
        filtered = filtered.filter(u => {
          if (!u.password_changed_at) return false;
          const passwordAge = now - new Date(u.password_changed_at).getTime();
          const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
          return daysOld >= 90;
        });
      } else if (state.filters.status === 'expired_key') {
        filtered = filtered.filter(u => {
          if (!u.public_key_expires_at) return false;
          return new Date(u.public_key_expires_at).getTime() < now;
        });
      } else if (state.filters.status === 'active') {
        filtered = filtered.filter(u => {
          const passwordOk = !u.password_changed_at ||
            (now - new Date(u.password_changed_at).getTime()) < (90 * 24 * 60 * 60 * 1000);
          const keyOk = !u.public_key_expires_at ||
            new Date(u.public_key_expires_at).getTime() > now;
          return passwordOk && keyOk;
        });
      }
    }

    return filtered;
  },

  getPaginatedUsers: () => {
    const state = get();
    const filtered = state.getFilteredUsers();
    const start = (state.pagination.page - 1) * state.pagination.pageSize;
    const end = start + state.pagination.pageSize;

    return {
      users: filtered.slice(start, end),
      total: filtered.length,
      page: state.pagination.page,
      pageSize: state.pagination.pageSize,
      totalPages: Math.ceil(filtered.length / state.pagination.pageSize)
    };
  },

  getUserStatistics: () => {
    const state = get();
    const now = Date.now();

    const stats = {
      total: state.users.length,
      byRole: {},
      expiredPasswords: 0,
      expiredKeys: 0,
      active: 0
    };

    state.users.forEach(user => {
      // Count by role
      user.roles?.forEach(role => {
        stats.byRole[role.name] = (stats.byRole[role.name] || 0) + 1;
      });

      // Check password expiry
      if (user.password_changed_at) {
        const passwordAge = now - new Date(user.password_changed_at).getTime();
        const daysOld = Math.floor(passwordAge / (1000 * 60 * 60 * 24));
        if (daysOld >= 90) {
          stats.expiredPasswords++;
        }
      }

      // Check key expiry
      if (user.public_key_expires_at) {
        if (new Date(user.public_key_expires_at).getTime() < now) {
          stats.expiredKeys++;
        }
      }

      // Check if active (no expired credentials)
      const passwordOk = !user.password_changed_at ||
        (now - new Date(user.password_changed_at).getTime()) < (90 * 24 * 60 * 60 * 1000);
      const keyOk = !user.public_key_expires_at ||
        new Date(user.public_key_expires_at).getTime() > now;

      if (passwordOk && keyOk) {
        stats.active++;
      }
    });

    return stats;
  }
}));


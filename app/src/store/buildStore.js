import { create } from 'zustand';

export const useBuildStore = create((set, get) => ({
  // State
  builds: [],
  selectedBuild: null,
  loading: false,
  error: null,
  
  // Actions
  setBuilds: (builds) => set({ builds, error: null }),
  
  addBuild: (build) => set((state) => ({
    builds: [build, ...state.builds]
  })),
  
  updateBuild: (buildId, updates) => set((state) => ({
    builds: state.builds.map(b => 
      b.id === buildId ? { ...b, ...updates } : b
    ),
    selectedBuild: state.selectedBuild?.id === buildId 
      ? { ...state.selectedBuild, ...updates }
      : state.selectedBuild
  })),
  
  removeBuild: (buildId) => set((state) => ({
    builds: state.builds.filter(b => b.id !== buildId),
    selectedBuild: state.selectedBuild?.id === buildId ? null : state.selectedBuild
  })),
  
  selectBuild: (buildId) => set((state) => ({
    selectedBuild: state.builds.find(b => b.id === buildId) || null
  })),
  
  clearSelectedBuild: () => set({ selectedBuild: null }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  clearError: () => set({ error: null }),
  
  // Update build status
  updateBuildStatus: (buildId, status) => set((state) => ({
    builds: state.builds.map(b => 
      b.id === buildId ? { ...b, status } : b
    ),
    selectedBuild: state.selectedBuild?.id === buildId 
      ? { ...state.selectedBuild, status }
      : state.selectedBuild
  })),
  
  // Computed
  getBuildById: (buildId) => {
    const state = get();
    return state.builds.find(b => b.id === buildId);
  },
  
  getBuildsByStatus: (status) => {
    const state = get();
    return state.builds.filter(b => b.status === status);
  },
  
  getMyBuilds: (userId) => {
    const state = get();
    return state.builds.filter(b => 
      b.created_by === userId || 
      b.assignments?.some(a => a.user_id === userId)
    );
  }
}));

// Made with Bob

import { create } from 'zustand';

export const useBuildStore = create((set, get) => ({
  // State
  builds: [],
  selectedBuild: null,
  loading: false,
  error: null,

  // NEW: Assignments per build
  assignments: {}, // { buildId: [assignments] }

  // NEW: Sections per build
  sections: {}, // { buildId: [sections] }

  // NEW: Audit events per build
  auditEvents: {}, // { buildId: [events] }

  // NEW: Export data per build
  exportData: {}, // { buildId: exportData }

  // NEW: Verification results per build
  verificationResults: {}, // { buildId: verificationResult }

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

  // NEW: Assignment Actions
  setAssignments: (buildId, assignments) => set((state) => ({
    assignments: {
      ...state.assignments,
      [buildId]: assignments
    }
  })),

  addAssignment: (buildId, assignment) => set((state) => ({
    assignments: {
      ...state.assignments,
      [buildId]: [...(state.assignments[buildId] || []), assignment]
    }
  })),

  removeAssignment: (buildId, userId, personaRole) => set((state) => ({
    assignments: {
      ...state.assignments,
      [buildId]: (state.assignments[buildId] || []).filter(a =>
        !(a.user_id === userId && a.persona_role === personaRole)
      )
    }
  })),

  // NEW: Section Actions
  setSections: (buildId, sections) => set((state) => ({
    sections: {
      ...state.sections,
      [buildId]: sections
    }
  })),

  addSection: (buildId, section) => set((state) => ({
    sections: {
      ...state.sections,
      [buildId]: [...(state.sections[buildId] || []), section]
    }
  })),

  // NEW: Audit Event Actions
  setAuditEvents: (buildId, events) => set((state) => ({
    auditEvents: {
      ...state.auditEvents,
      [buildId]: events
    }
  })),

  addAuditEvent: (buildId, event) => set((state) => ({
    auditEvents: {
      ...state.auditEvents,
      [buildId]: [...(state.auditEvents[buildId] || []), event]
    }
  })),

  // NEW: Export Data Actions
  setExportData: (buildId, data) => set((state) => ({
    exportData: {
      ...state.exportData,
      [buildId]: data
    }
  })),

  clearExportData: (buildId) => set((state) => {
    const newExportData = { ...state.exportData };
    delete newExportData[buildId];
    return { exportData: newExportData };
  }),

  // NEW: Verification Result Actions
  setVerificationResult: (buildId, result) => set((state) => ({
    verificationResults: {
      ...state.verificationResults,
      [buildId]: result
    }
  })),

  clearVerificationResult: (buildId) => set((state) => {
    const newResults = { ...state.verificationResults };
    delete newResults[buildId];
    return { verificationResults: newResults };
  }),

  // NEW: Clear all data for a build
  clearBuildData: (buildId) => set((state) => {
    const newAssignments = { ...state.assignments };
    const newSections = { ...state.sections };
    const newAuditEvents = { ...state.auditEvents };
    const newExportData = { ...state.exportData };
    const newVerificationResults = { ...state.verificationResults };

    delete newAssignments[buildId];
    delete newSections[buildId];
    delete newAuditEvents[buildId];
    delete newExportData[buildId];
    delete newVerificationResults[buildId];

    return {
      assignments: newAssignments,
      sections: newSections,
      auditEvents: newAuditEvents,
      exportData: newExportData,
      verificationResults: newVerificationResults
    };
  }),

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
      (state.assignments[b.id] || []).some(a => a.user_id === userId)
    );
  },

  // NEW: Get assignments for a build
  getBuildAssignments: (buildId) => {
    const state = get();
    return state.assignments[buildId] || [];
  },

  // NEW: Get sections for a build
  getBuildSections: (buildId) => {
    const state = get();
    return state.sections[buildId] || [];
  },

  // NEW: Get audit events for a build
  getBuildAuditEvents: (buildId) => {
    const state = get();
    return state.auditEvents[buildId] || [];
  },

  // NEW: Get export data for a build
  getBuildExportData: (buildId) => {
    const state = get();
    return state.exportData[buildId] || null;
  },

  // NEW: Get verification result for a build
  getBuildVerificationResult: (buildId) => {
    const state = get();
    return state.verificationResults[buildId] || null;
  },

  // NEW: Check if build has all sections
  isBuildComplete: (buildId) => {
    const state = get();
    const sections = state.sections[buildId] || [];
    const hasWorkload = sections.some(s => s.persona_role === 'workload_owner');
    const hasEnvironment = sections.some(s => s.persona_role === 'data_owner');
    const hasAttestation = sections.some(s => s.persona_role === 'auditor');
    return hasWorkload && hasEnvironment && hasAttestation;
  },

  // NEW: Get build completion percentage
  getBuildCompletionPercentage: (buildId) => {
    const state = get();
    const sections = state.sections[buildId] || [];
    const sectionCount = sections.length;
    return Math.round((sectionCount / 3) * 100); // 3 required sections
  },

  // NEW: Check if user is assigned to build
  isUserAssignedToBuild: (buildId, userId) => {
    const state = get();
    const assignments = state.assignments[buildId] || [];
    return assignments.some(a => a.user_id === userId);
  },

  // NEW: Get user's role in build
  getUserRoleInBuild: (buildId, userId) => {
    const state = get();
    const assignments = state.assignments[buildId] || [];
    const userAssignments = assignments.filter(a => a.user_id === userId);
    return userAssignments.map(a => a.persona_role);
  }
}));



import apiClient from './apiClient';
import { useBuildStore } from '../store/buildStore';
import signatureMiddleware from './signatureMiddleware';
import assignmentService from './assignmentService';
import sectionService from './sectionService';
import exportService from './exportService';
import verificationService from './verificationService';

class BuildService {
  /**
   * Get all builds
   * @returns {Promise<Array>}
   */
  async getBuilds() {
    const response = await apiClient.get('/builds');
    const builds = response.data.builds || [];

    // Update store
    useBuildStore.getState().setBuilds(builds);

    return builds;
  }

  /**
   * Get a specific build by ID
   * @param {string} buildId 
   * @returns {Promise<Object>}
   */
  async getBuild(buildId) {
    const response = await apiClient.get(`/builds/${buildId}`);
    const build = response.data;

    // Update store
    useBuildStore.getState().updateBuild(buildId, build);

    return build;
  }

  /**
   * Create a new build
   * @param {string} name - Build name
   * @param {Object} assignments - Role to user ID mapping
   * @param {string} signature - Admin's signature
   * @returns {Promise<Object>}
   */
  async createBuild(name) {
    const response = await apiClient.post('/builds', { name });

    const build = response.data;

    // Add to store
    useBuildStore.getState().addBuild(build);

    return build;
  }

  /**
   * Cancel a build (Admin only)
   * @param {string} buildId 
   * @returns {Promise<void>}
   */
  async cancelBuild(buildId) {
    await apiClient.post(`/builds/${buildId}/cancel`);
    useBuildStore.getState().updateBuildStatus(buildId, 'CANCELLED');
  }

  /**
   * Get build assignments (delegates to assignmentService)
   * @param {string} buildId
   * @returns {Promise<Array>}
   */
  async getAssignments(buildId) {
    return await assignmentService.getBuildAssignments(buildId);
  }

  /**
   * Create build assignment
   * @param {string} buildId - Build ID
   * @param {string} userId - User ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<Object>}
   */
  async createAssignment(buildId, userId, personaRole) {
    return await assignmentService.createAssignment(buildId, userId, personaRole);
  }

  /**
   * Delete build assignment
   * @param {string} buildId - Build ID
   * @param {string} userId - User ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<void>}
   */
  async deleteAssignment(buildId, userId, personaRole) {
    return await assignmentService.deleteAssignment(buildId, userId, personaRole);
  }

  /**
   * Submit workload section (Solution Provider)
   * @param {string} buildId 
   * @param {Object} data - {encrypted_payload, encryption_certificate, section_hash, signature}
   * @returns {Promise<Object>}
   */
  async submitWorkload(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/sections`, {
      ...data,
      persona_role: 'SOLUTION_PROVIDER'
    });

    // Update build status
    useBuildStore.getState().updateBuildStatus(buildId, 'WORKLOAD_SUBMITTED');

    return response.data;
  }

  /**
   * Submit environment section (Data Owner)
   * @param {string} buildId 
   * @param {Object} data - {encrypted_payload, wrapped_symmetric_key, section_hash, signature}
   * @returns {Promise<Object>}
   */
  async submitEnvironment(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/sections`, {
      ...data,
      persona_role: 'DATA_OWNER'
    });

    // Update build status
    useBuildStore.getState().updateBuildStatus(buildId, 'ENVIRONMENT_STAGED');

    return response.data;
  }

  /**
   * Register attestation keys (Auditor)
   * @param {string} buildId 
   * @param {Object} data - {attestation_public_key, signing_certificate}
   * @returns {Promise<Object>}
   */
  async registerAttestationKeys(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/attestation`, data);

    // Update build status
    useBuildStore.getState().updateBuildStatus(buildId, 'AUDITOR_KEYS_REGISTERED');

    return response.data;
  }

  /**
   * Finalize build with contract (Auditor)
   * @param {string} buildId 
   * @param {Object} data - {contract_yaml, contract_hash, signature}
   * @returns {Promise<Object>}
   */
  async finalizeBuild(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/finalize`, data);

    // Update build status
    useBuildStore.getState().updateBuildStatus(buildId, 'FINALIZED');

    return response.data;
  }

  /**
   * Get build sections (delegates to sectionService)
   * @param {string} buildId
   * @returns {Promise<Array>}
   */
  async getSections(buildId) {
    return await sectionService.getSections(buildId);
  }

  /**
   * Submit section (delegates to sectionService)
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @param {string} plaintext - Section content
   * @param {string} certContent - HPCR certificate
   * @returns {Promise<Object>}
   */
  async submitSection(buildId, personaRole, plaintext, certContent) {
    return await sectionService.submitSection(buildId, personaRole, plaintext, certContent);
  }

  /**
   * Get audit events for a build
   * @param {string} buildId 
   * @returns {Promise<Array>}
   */
  async getAuditEvents(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/audit`);
    return response.data.audit_events || response.data.events || [];
  }

  /**
   * Verify audit chain (delegates to verificationService)
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async verifyAuditChain(buildId) {
    return await verificationService.verifyAuditChain(buildId);
  }

  /**
   * Verify contract integrity (delegates to verificationService)
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async verifyContractIntegrity(buildId) {
    return await verificationService.verifyContractIntegrity(buildId);
  }

  /**
   * Perform complete verification
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async performCompleteVerification(buildId) {
    return await verificationService.performCompleteVerification(buildId);
  }

  /**
   * Export build data (delegates to exportService)
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async exportBuild(buildId) {
    return await exportService.exportContract(buildId);
  }

  /**
   * Download finalized contract (delegates to exportService)
   * @param {string} buildId
   * @returns {Promise<{contract_yaml, contract_hash}>}
   */
  async downloadContract(buildId) {
    return await exportService.getUserData(buildId);
  }

  /**
   * Acknowledge contract download (delegates to exportService)
   * @param {string} buildId
   * @param {string} contractHash - Hash of contract
   * @returns {Promise<Object>}
   */
  async acknowledgeDownload(buildId, contractHash) {
    return await exportService.acknowledgeDownload(buildId, contractHash);
  }

  /**
   * Export and save contract locally
   * @param {string} buildId - Build ID
   * @param {string} filename - Optional filename
   * @returns {Promise<Object>}
   */
  async exportAndSave(buildId, filename = null) {
    return await exportService.exportAndSave(buildId, filename);
  }

  /**
   * Transition build status with signature
   * @param {string} buildId - Build ID
   * @param {string} newStatus - New status
   * @returns {Promise<Object>}
   */
  async transitionStatus(buildId, newStatus) {
    const { hash, signature } = await signatureMiddleware.signBuildAction(
      buildId,
      'status_transition',
      { newStatus }
    );

    const response = await apiClient.patch(`/builds/${buildId}/status`, {
      status: newStatus,
      signature: signature
    });

    useBuildStore.getState().updateBuildStatus(buildId, newStatus);

    return response.data;
  }

  /**
   * Get build audit trail with actor key fingerprints
   * @param {string} buildId - Build ID
   * @returns {Promise<Array>}
   */
  async getAuditTrail(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/audit`);
    // Backend returns {audit_events: [...]}
    return response.data.audit_events || response.data.events || [];
  }

  /**
   * Get build statistics
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>}
   */
  async getBuildStatistics(buildId) {
    const [build, assignments, sections, auditEvents] = await Promise.all([
      this.getBuild(buildId),
      this.getAssignments(buildId),
      this.getSections(buildId),
      this.getAuditEvents(buildId)
    ]);

    return {
      buildId,
      name: build.name,
      status: build.status,
      createdAt: build.created_at,
      assignmentCount: assignments.length,
      sectionCount: sections.length,
      auditEventCount: auditEvents.length,
      isComplete: sections.length === 3, // workload, environment, attestation
      assignments: {
        SOLUTION_PROVIDER: assignments.filter(a => a.role_name === 'SOLUTION_PROVIDER').length,
        DATA_OWNER: assignments.filter(a => a.role_name === 'DATA_OWNER').length,
        AUDITOR: assignments.filter(a => a.role_name === 'AUDITOR').length
      },
      sections: {
        SOLUTION_PROVIDER: sections.some(s => s.persona_role === 'SOLUTION_PROVIDER'),
        DATA_OWNER: sections.some(s => s.persona_role === 'DATA_OWNER'),
        AUDITOR: sections.some(s => s.persona_role === 'AUDITOR')
      }
    };
  }

  /**
   * Check if build is ready for finalization
   * @param {string} buildId - Build ID
   * @returns {Promise<{ready: boolean, missing: Array<string>}>}
   */
  async checkFinalizationReadiness(buildId) {
    const sections = await this.getSections(buildId);
    const missing = [];

    const hasWorkload = sections.some(s => s.persona_role === 'SOLUTION_PROVIDER');
    const hasEnvironment = sections.some(s => s.persona_role === 'DATA_OWNER');
    const hasAttestation = sections.some(s => s.persona_role === 'AUDITOR');

    if (!hasWorkload) missing.push('SOLUTION_PROVIDER section');
    if (!hasEnvironment) missing.push('DATA_OWNER section');
    if (!hasAttestation) missing.push('AUDITOR section');

    return {
      ready: missing.length === 0,
      missing
    };
  }
}

export default new BuildService();

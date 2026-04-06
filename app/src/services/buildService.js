import apiClient from './apiClient';
import { useBuildStore } from '../store/buildStore';

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
  async createBuild(name, assignments, signature) {
    const response = await apiClient.post('/builds', {
      name,
      assignments,
      signature
    });
    
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
    await apiClient.delete(`/builds/${buildId}`);
    
    // Remove from store
    useBuildStore.getState().removeBuild(buildId);
  }

  /**
   * Get build assignments
   * @param {string} buildId 
   * @returns {Promise<Array>}
   */
  async getAssignments(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/assignments`);
    return response.data.assignments || [];
  }

  /**
   * Submit workload section (Solution Provider)
   * @param {string} buildId 
   * @param {Object} data - {encrypted_payload, encryption_certificate, section_hash, signature}
   * @returns {Promise<Object>}
   */
  async submitWorkload(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/workload`, data);
    
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
    const response = await apiClient.post(`/builds/${buildId}/environment`, data);
    
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
   * Get build sections
   * @param {string} buildId 
   * @returns {Promise<Array>}
   */
  async getSections(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/sections`);
    return response.data.sections || [];
  }

  /**
   * Get audit events for a build
   * @param {string} buildId 
   * @returns {Promise<Array>}
   */
  async getAuditEvents(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/audit`);
    return response.data.events || [];
  }

  /**
   * Verify audit chain for a build
   * @param {string} buildId 
   * @returns {Promise<Object>}
   */
  async verifyAuditChain(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/verify`);
    return response.data;
  }

  /**
   * Export build data
   * @param {string} buildId 
   * @returns {Promise<Object>}
   */
  async exportBuild(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/export`);
    return response.data;
  }

  /**
   * Download finalized contract (Env Operator)
   * @param {string} buildId 
   * @returns {Promise<{contract_yaml, contract_hash}>}
   */
  async downloadContract(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/userdata`);
    return response.data;
  }

  /**
   * Acknowledge contract download (Env Operator)
   * @param {string} buildId 
   * @param {string} signature - Signature of contract hash
   * @returns {Promise<Object>}
   */
  async acknowledgeDownload(buildId, signature) {
    const response = await apiClient.post(`/builds/${buildId}/acknowledge`, {
      signature
    });
    return response.data;
  }
}

export default new BuildService();

// Made with Bob

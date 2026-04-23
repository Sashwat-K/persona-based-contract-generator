import apiClient from './apiClient';
import { useBuildStore } from '../store/buildStore';
import signatureMiddleware from './signatureMiddleware';
import assignmentService from './assignmentService';
import sectionService from './sectionService';
import exportService from './exportService';
import verificationService from './verificationService';

const WORKLOAD_TEMPLATE_FALLBACK = `workload:
  compose:
    archive: ""
  type: compose
`;

const ENV_TEMPLATE_FALLBACK = `env:
  type: env
  logging:
    logRouter:
      hostname: ""
      iamApiKey: ""
      port: 443
signingKey: <signing key or certificate>
`;

const readBrowserFileAsText = async (file) => {
  if (!file) return '';
  if (typeof file.text === 'function') {
    return await file.text();
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(typeof event?.target?.result === 'string' ? event.target.result : '');
    reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
    reader.readAsText(file);
  });
};

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
   * Register signing key (v2)
   * @param {string} buildId
   * @param {{mode?: string, public_key?: string, passphrase?: string}} data
   * @returns {Promise<Object>}
   */
  async registerSigningKey(buildId, data = {}) {
    const payload = {
      mode: data.mode || 'generate',
      ...(data.passphrase ? { passphrase: data.passphrase } : {}),
      ...(data.public_key ? { public_key: data.public_key } : {})
    };
    try {
      const response = await apiClient.post(`/builds/${buildId}/keys/signing`, payload);
      return response.data;
    } catch (error) {
      const message = String(error?.message || error?.data?.error?.message || '').toLowerCase();
      const passphraseRejected = message.includes('unknown field "passphrase"');
      if (data.passphrase && passphraseRejected) {
        const fallbackPayload = {
          mode: data.mode || 'generate',
          ...(data.public_key ? { public_key: data.public_key } : {})
        };
        const fallbackResponse = await apiClient.post(`/builds/${buildId}/keys/signing`, fallbackPayload);
        return {
          ...fallbackResponse.data,
          passphrase_ignored: true
        };
      }
      throw error;
    }
  }

  /**
   * Register attestation key (v2)
   * @param {string} buildId
   * @param {{mode?: string, public_key?: string, passphrase?: string, encryption_cert_pem?: string}} data
   * @returns {Promise<Object>}
   */
  async registerAttestationKey(buildId, data = {}) {
    const payload = {
      mode: data.mode || 'generate',
      ...(data.passphrase ? { passphrase: data.passphrase } : {}),
      ...(data.public_key ? { public_key: data.public_key } : {}),
      ...(data.encryption_cert_pem ? { encryption_cert_pem: data.encryption_cert_pem } : {})
    };
    try {
      const response = await apiClient.post(`/builds/${buildId}/keys/attestation`, payload);
      return response.data;
    } catch (error) {
      const message = String(error?.message || error?.data?.error?.message || '').toLowerCase();
      const passphraseRejected = message.includes('unknown field "passphrase"');
      if (data.passphrase && passphraseRejected) {
        const fallbackPayload = {
          mode: data.mode || 'generate',
          ...(data.public_key ? { public_key: data.public_key } : {})
        };
        const fallbackResponse = await apiClient.post(`/builds/${buildId}/keys/attestation`, fallbackPayload);
        return {
          ...fallbackResponse.data,
          passphrase_ignored: true
        };
      }
      throw error;
    }
  }

  /**
   * Get latest signing public key (v2)
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async getSigningPublicKey(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/keys/signing/public`);
    return response.data;
  }

  /**
   * Submit workload section (v2 backend-native encryption)
   * @param {string} buildId
   * @param {{plaintext: string, certificate_pem: string}} data
   * @returns {Promise<Object>}
   */
  async submitWorkloadV2(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/v2/sections/workload`, {
      plaintext: data.plaintext,
      certificate_pem: data.certificate_pem
    });
    useBuildStore.getState().updateBuildStatus(buildId, 'WORKLOAD_SUBMITTED');
    return response.data;
  }

  /**
   * Get contract template content generated by backend contract-go
   * @param {'workload'|'env'} templateType
   * @returns {Promise<{template_type: string, content: string}>}
   */
  async getContractTemplate(templateType = 'workload') {
    try {
      const response = await apiClient.post('/v2/contract-template', {
        type: templateType
      });
      return response.data;
    } catch (error) {
      const status =
        error?.status ??
        error?.response?.status ??
        error?.original?.response?.status;
      // Backward-compatible fallback when the running backend has not been
      // restarted with the new /v2/contract-template route yet.
      if (status === 404) {
        const normalizedType = String(templateType || 'workload').toLowerCase();
        return {
          template_type: normalizedType,
          content: normalizedType === 'env' ? ENV_TEMPLATE_FALLBACK : WORKLOAD_TEMPLATE_FALLBACK
        };
      }
      throw error;
    }
  }

  /**
   * Backward-compatible wrapper for old call sites.
   * @param {string} _buildId
   * @param {'workload'|'env'} templateType
   * @returns {Promise<{template_type: string, content: string}>}
   */
  async getWorkloadTemplate(_buildId, templateType = 'workload') {
    return this.getContractTemplate(templateType);
  }

  /**
   * Submit environment section (v2 backend-native encryption)
   * @param {string} buildId
   * @param {{plaintext: string, certificate_pem: string}} data
   * @returns {Promise<Object>}
   */
  async submitEnvironmentV2(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/v2/sections/environment`, {
      plaintext: data.plaintext,
      certificate_pem: data.certificate_pem
    });
    useBuildStore.getState().updateBuildStatus(buildId, 'ENVIRONMENT_STAGED');
    return response.data;
  }

  /**
   * Finalize contract (v2 backend-native finalization)
   * Backend automatically finds the latest signing and attestation keys.
   * Attestation public key is already encrypted during registration.
   * @param {string} buildId
   * @param {{signing_key_passphrase: string}} data
   * @returns {Promise<Object>}
   */
  async finalizeBuildV2(buildId, data) {
    const response = await apiClient.post(`/builds/${buildId}/v2/finalize`, {
      signing_key_passphrase: data.signing_key_passphrase
    });
    useBuildStore.getState().updateBuildStatus(buildId, 'FINALIZED');
    return response.data;
  }

  /**
   * Get attestation verification status for a build.
   * @param {string} buildId
   * @returns {Promise<Object>}
   */
  async getAttestationStatus(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/attestation/status`);
    return response.data;
  }

  /**
   * Upload attestation evidence files (records + signature).
   * Uses JSON payload to keep request-signature verification compatible.
   * @param {string} buildId
   * @param {{recordsFile: File, signatureFile: File, metadata?: Object}} payload
   * @returns {Promise<Object>}
   */
  async uploadAttestationEvidence(buildId, payload = {}) {
    const recordsFile = payload.recordsFile || null;
    const signatureFile = payload.signatureFile || null;

    if (!recordsFile || !signatureFile) {
      throw new Error('Both records and signature files are required.');
    }

    const [recordsContent, signatureContent] = await Promise.all([
      readBrowserFileAsText(recordsFile),
      readBrowserFileAsText(signatureFile)
    ]);

    try {
      const response = await apiClient.post(`/builds/${buildId}/attestation/evidence`, {
        records_file_name: recordsFile.name || 'attestation-records.txt',
        records_content: recordsContent,
        signature_file_name: signatureFile.name || 'attestation-signature.sig',
        signature_content: signatureContent,
        metadata: payload.metadata || {}
      });

      return response.data;
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes("content-type isn't multipart/form-data")) {
        throw new Error('Backend restart required: attestation upload endpoint is still running old multipart-only code.');
      }
      throw error;
    }
  }

  /**
   * Verify attestation evidence by evidence ID.
   * @param {string} buildId
   * @param {string} evidenceId
   * @param {string} attestationKeyPassphrase
   * @returns {Promise<Object>}
   */
  async verifyAttestationEvidence(buildId, evidenceId, attestationKeyPassphrase = '') {
    if (!evidenceId) {
      throw new Error('Evidence ID is required for verification.');
    }
    const response = await apiClient.post(`/builds/${buildId}/attestation/evidence/${evidenceId}/verify`, {
      attestation_key_passphrase: attestationKeyPassphrase || ''
    });
    return response.data;
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
    const signing = await this.registerSigningKey(buildId, {
      mode: data?.signing_mode || 'generate',
      public_key: data?.signing_public_key
    });
    const attestation = await this.registerAttestationKey(buildId, {
      mode: data?.attestation_mode || 'generate',
      passphrase: data?.attestation_passphrase,
      public_key: data?.attestation_public_key
    });

    const build = await this.getBuild(buildId);
    return {
      status: build?.status || 'ATTESTATION_KEY_REGISTERED',
      signing_key_id: signing?.signing_key_id || null,
      attestation_key_id: attestation?.attestation_key_id || null,
      signing_public_key: signing?.public_key || '',
      attestation_public_key: attestation?.public_key || ''
    };
  }

  /**
   * Finalize build with contract (Auditor)
   * @param {string} buildId 
   * @param {Object} data - {contract_yaml, contract_hash, signature}
   * @returns {Promise<Object>}
   */
  async finalizeBuild(buildId, data) {
    if (data?.signing_key_id) {
      return this.finalizeBuildV2(buildId, data);
    }
    const response = await apiClient.post(`/builds/${buildId}/finalize`, data);
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

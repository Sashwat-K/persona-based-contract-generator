import apiClient from './apiClient';
import cryptoService from './cryptoService';
import assignmentService from './assignmentService';
import { useAuthStore } from '../store/authStore';
import roleService from './roleService';

/**
 * Section Service - Section submission with encryption and signatures
 * Handles workload, environment, and attestation sections
 */
class SectionService {
  /**
   * Submit a section for a build
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role (workload_owner, data_owner, auditor)
   * @param {string} plaintext - Section content in plaintext
   * @param {string} certContent - HPCR encryption certificate content
   * @returns {Promise<Object>}
   */
  async submitSection(buildId, personaRole, plaintext, certContent) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    const normalizedRole = roleService.normalizeRoleName(personaRole);
    const roleId = await roleService.getRoleId(normalizedRole);

    // Get existing sections to validate
    const existingSections = await this.getSections(buildId);

    // Validate assignment and check if section already submitted
    const validation = await assignmentService.canSubmitSection(
      buildId,
      normalizedRole,
      existingSections
    );

    if (!validation.canSubmit) {
      throw new Error(validation.reason);
    }

    // Encrypt section with HPCR certificate
    const encryptedPayload = await cryptoService.encryptSection(plaintext, certContent);

    // Compute hash of encrypted payload
    const sectionHash = await cryptoService.hash(encryptedPayload);

    // Get private key
    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found. Please register your public key first.');
    }

    // Sign the hash
    const signature = await cryptoService.sign(sectionHash, privateKey);

    // Submit to backend
    const response = await apiClient.post(`/builds/${buildId}/sections`, {
      persona_role: normalizedRole,
      role_id: roleId,
      encrypted_payload: encryptedPayload,
      section_hash: sectionHash,
      signature: signature
    });

    return response.data;
  }

  /**
   * Submit a section using an already-encrypted payload (skips re-encryption).
   * Use this when encryption was performed externally (e.g. via contract-cli streaming).
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @param {string} encryptedPayload - Already-encrypted payload (hyper-protect-basic.xxx.yyy)
   * @returns {Promise<Object>}
   */
  async submitEncryptedSection(buildId, personaRole, encryptedPayload, wrappedSymmetricKey = null) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');
    const normalizedRole = roleService.normalizeRoleName(personaRole);
    const roleId = await roleService.getRoleId(normalizedRole);

    // Validate assignment
    const existingSections = await this.getSections(buildId);
    const validation = await assignmentService.canSubmitSection(buildId, normalizedRole, existingSections);
    if (!validation.canSubmit) throw new Error(validation.reason);

    // Hash the encrypted payload
    const sectionHash = await cryptoService.hash(encryptedPayload);

    // Sign the hash
    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) throw new Error('Private key not found. Please register your public key first.');
    const signature = await cryptoService.sign(sectionHash, privateKey);

    const body = {
      persona_role: normalizedRole,
      role_id: roleId,
      encrypted_payload: encryptedPayload,
      section_hash: sectionHash,
      signature: signature,
    };
    if (wrappedSymmetricKey) body.encrypted_symmetric_key = wrappedSymmetricKey;

    const response = await apiClient.post(`/builds/${buildId}/sections`, body);
    return response.data;
  }

  /**
   * Get all sections for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Array>}
   */
  async getSections(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/sections`);
    return response.data.sections || [];
  }

  /**
   * Get section for a specific persona role
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<Object|null>}
   */
  async getSection(buildId, personaRole) {
    const sections = await this.getSections(buildId);
    const normalizedRole = roleService.normalizeRoleName(personaRole);
    return sections.find(s => s.persona_role === normalizedRole) || null;
  }

  /**
   * Get current user's section (if they submitted one)
   * @param {string} buildId - Build ID
   * @returns {Promise<Object|null>}
   */
  async getMySection(buildId) {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    const sections = await this.getSections(buildId);
    return sections.find(s => s.submitted_by === user.id) || null;
  }

  /**
   * Prepare section for submission (encrypt only, don't submit)
   * Useful for preview or validation
   * @param {string} plaintext - Section content
   * @param {string} certContent - HPCR encryption certificate
   * @returns {Promise<string>} - Encrypted payload
   */
  async prepareSection(plaintext, certContent) {
    return await cryptoService.encryptSection(plaintext, certContent);
  }

  /**
   * Compute hash of section content
   * @param {string} content - Content to hash
   * @returns {Promise<string>} - SHA-256 hash
   */
  async computeSectionHash(content) {
    return await cryptoService.hash(content);
  }

  /**
   * Sign section hash
   * @param {string} sectionHash - Hash to sign
   * @returns {Promise<string>} - Signature
   */
  async signSectionHash(sectionHash) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found');
    }

    return await cryptoService.sign(sectionHash, privateKey);
  }

  /**
   * Validate section signature
   * @param {Object} section - Section object with hash, signature, and submitter info
   * @param {string} publicKey - Public key to verify with
   * @returns {Promise<boolean>}
   */
  async validateSectionSignature(section, publicKey) {
    if (!section.section_hash || !section.signature) {
      return false;
    }

    return await cryptoService.verify(
      section.section_hash,
      section.signature,
      publicKey
    );
  }

  /**
   * Check section submission status for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {workload: bool, environment: bool, attestation: bool, complete: bool}
   */
  async getSectionStatus(buildId) {
    const sections = await this.getSections(buildId);

    const status = {
      SOLUTION_PROVIDER: false,
      DATA_OWNER: false,
      AUDITOR: false,
      complete: false,
      sections: []
    };

    sections.forEach(section => {
      status[section.persona_role] = true;
      status.sections.push({
        role: section.persona_role,
        submittedBy: section.submitted_by,
        submittedAt: section.submitted_at,
        hash: section.section_hash
      });
    });

    status.complete = status.SOLUTION_PROVIDER && status.DATA_OWNER && status.AUDITOR;

    return status;
  }

  /**
   * Check if current user can submit for a specific role
   * @param {string} buildId - Build ID
   * @param {string} personaRole - Persona role
   * @returns {Promise<{canSubmit: boolean, reason: string}>}
   */
  async canSubmit(buildId, personaRole) {
    const sections = await this.getSections(buildId);
    return await assignmentService.canSubmitSection(buildId, personaRole, sections);
  }

  /**
   * Validate section content before submission
   * @param {string} plaintext - Section content
   * @param {string} personaRole - Persona role
   * @returns {Object} - {valid: boolean, errors: Array<string>}
   */
  validateSectionContent(plaintext, personaRole) {
    const errors = [];

    if (!plaintext || plaintext.trim().length === 0) {
      errors.push('Section content cannot be empty');
    }

    if (plaintext.length > 1024 * 1024) { // 1MB limit
      errors.push('Section content exceeds 1MB limit');
    }

    // Role-specific validation
    const normalizedRole = roleService.normalizeRoleName(personaRole);
    if (normalizedRole === 'SOLUTION_PROVIDER') {
      // Validate workload section structure
      if (!plaintext.includes('workload:')) {
        errors.push('Workload section must contain "workload:" key');
      }
    } else if (normalizedRole === 'DATA_OWNER') {
      // Validate environment section structure
      if (!plaintext.includes('env:')) {
        errors.push('Environment section must contain "env:" key');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new SectionService();

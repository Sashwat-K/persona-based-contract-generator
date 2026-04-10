import apiClient from './apiClient';
import cryptoService from './cryptoService';
import { useAuthStore } from '../store/authStore';

/**
 * Export Service - Contract export and download management
 * Handles contract export, userdata retrieval, and download acknowledgment
 */
class ExportService {
  /**
   * Decode contract YAML when backend returns base64, or return as-is when already raw YAML.
   * Supports mixed deployments during migration.
   * @param {string} contractYaml
   * @returns {string}
   */
  decodeContractYaml(contractYaml) {
    if (typeof contractYaml !== 'string') return '';

    const value = contractYaml.trim();
    if (!value) return '';

    // Raw YAML fast-path
    if (value.includes('\n') || value.includes('workload:') || value.includes('env:')) {
      return contractYaml;
    }

    // Likely base64 payload
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Regex.test(value) || (value.length % 4 !== 0)) {
      return contractYaml;
    }

    try {
      return atob(value);
    } catch (_) {
      return contractYaml;
    }
  }

  /**
   * Export build data (complete contract with all sections)
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {contract_yaml, contract_hash, sections, metadata}
   */
  async exportContract(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/export`);
    return response.data;
  }

  /**
   * Get userdata (finalized contract for environment operator)
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {contract_yaml, contract_hash}
   */
  async getUserData(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/userdata`);
    return response.data;
  }

  /**
   * Acknowledge contract download with signature
   * @param {string} buildId - Build ID
   * @param {string} contractHash - Hash of downloaded contract
   * @returns {Promise<Object>}
   */
  async acknowledgeDownload(buildId, contractHash) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    // Get private key
    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found. Please register your public key first.');
    }

    // Sign the contract hash
    const signature = await cryptoService.sign(contractHash, privateKey);

    // Submit acknowledgment
    const response = await apiClient.post(`/builds/${buildId}/acknowledge-download`, {
      contract_hash: contractHash,
      signature: signature
    });

    return response.data;
  }

  /**
   * Save contract to local filesystem
   * @param {string} buildId - Build ID
   * @param {string} contractYaml - Contract YAML content
   * @param {string} filename - Optional custom filename
   * @returns {Promise<Object>} - {success: boolean, path: string}
   */
  async saveContractLocally(buildId, contractYaml, filename = null) {
    const defaultFilename = filename || `contract-${buildId}-${Date.now()}.yaml`;

    try {
      const resultPath = await window.electron.file.saveFile(defaultFilename, contractYaml);
      if (!resultPath) {
        throw new Error('Save cancelled');
      }

      return {
        success: true,
        path: resultPath,
        filename: defaultFilename
      };
    } catch (error) {
      console.error('Failed to save contract:', error);
      throw new Error(`Failed to save contract: ${error.message}`);
    }
  }

  /**
   * Load contract from local filesystem
   * @returns {Promise<Object>} - {content: string, path: string}
   */
  async loadLocalContract() {
    try {
      const selected = await window.electron.file.selectFile({
        filters: [
          { name: 'YAML Files', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (!selected) {
        throw new Error('No file selected');
      }
      const content = await window.electron.file.readFile(selected.path);

      return {
        content,
        path: selected.path,
        filename: selected.name
      };
    } catch (error) {
      console.error('Failed to load contract:', error);
      throw new Error(`Failed to load contract: ${error.message}`);
    }
  }

  /**
   * Generate download signature for contract hash
   * @param {string} contractHash - Hash of contract
   * @returns {Promise<string>} - Signature
   */
  async generateDownloadSignature(contractHash) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found');
    }

    return await cryptoService.sign(contractHash, privateKey);
  }

  /**
   * Verify contract hash matches content
   * @param {string} contractYaml - Contract YAML content
   * @param {string} expectedHash - Expected hash
   * @returns {Promise<boolean>}
   */
  async verifyContractHash(contractYaml, expectedHash) {
    const actualHash = await cryptoService.hash(contractYaml);
    return actualHash === expectedHash;
  }

  /**
   * Export and save contract in one operation
   * @param {string} buildId - Build ID
   * @param {string} filename - Optional custom filename
   * @returns {Promise<Object>} - {success: boolean, path: string, hash: string}
   */
  async exportAndSave(buildId, filename = null) {
    // Export contract
    const exportData = await this.exportContract(buildId);

    // Save to filesystem
    const decodedYaml = this.decodeContractYaml(exportData.contract_yaml);
    const saveResult = await this.saveContractLocally(
      buildId,
      decodedYaml,
      filename
    );

    // Acknowledge download
    await this.acknowledgeDownload(buildId, exportData.contract_hash);

    return {
      success: true,
      path: saveResult.path,
      filename: saveResult.filename,
      hash: exportData.contract_hash
    };
  }

  /**
   * Get export history for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Array>} - Array of export/download events
   */
  async getExportHistory(buildId) {
    // This would come from audit events
    const response = await apiClient.get(`/builds/${buildId}/audit`);
    const events = response.data.audit_events || response.data.events || [];

    // Filter for export-related events
    return events.filter(e =>
      e.event_type === 'contract_exported' ||
      e.event_type === 'contract_downloaded'
    );
  }

  /**
   * Validate contract structure
   * @param {string} contractYaml - Contract YAML content
   * @returns {Object} - {valid: boolean, errors: Array<string>}
   */
  validateContractStructure(contractYaml) {
    const errors = [];

    if (!contractYaml || contractYaml.trim().length === 0) {
      errors.push('Contract content is empty');
      return { valid: false, errors };
    }

    // Check for required sections
    const requiredSections = ['workload:', 'env:', 'attestation:'];
    requiredSections.forEach(section => {
      if (!contractYaml.includes(section)) {
        errors.push(`Missing required section: ${section}`);
      }
    });

    // Check for hyper-protect-basic encryption format
    if (!contractYaml.includes('hyper-protect-basic')) {
      errors.push('Contract does not contain encrypted sections');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse contract metadata
   * @param {string} contractYaml - Contract YAML content
   * @returns {Object} - Parsed metadata
   */
  parseContractMetadata(contractYaml) {
    const metadata = {
      hasWorkload: contractYaml.includes('workload:'),
      hasEnvironment: contractYaml.includes('env:'),
      hasAttestation: contractYaml.includes('attestation:'),
      isEncrypted: contractYaml.includes('hyper-protect-basic'),
      size: contractYaml.length,
      lines: contractYaml.split('\n').length
    };

    return metadata;
  }

  /**
   * Create contract backup
   * @param {string} buildId - Build ID
   * @param {string} contractYaml - Contract YAML content
   * @returns {Promise<Object>}
   */
  async createBackup(buildId, contractYaml) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `contract-${buildId}-backup-${timestamp}.yaml`;

    return await this.saveContractLocally(buildId, contractYaml, backupFilename);
  }
}

export default new ExportService();

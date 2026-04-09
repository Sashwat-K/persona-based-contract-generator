import apiClient from './apiClient';
import cryptoService from './cryptoService';
import { useAuthStore } from '../store/authStore';

/**
 * Export Service - Contract export and download management
 * Handles contract export, userdata retrieval, and download acknowledgment
 */
class ExportService {
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
      downloaded_at: new Date().toISOString(),
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
      const result = await window.electron.fs.saveFile({
        filename: defaultFilename,
        content: contractYaml,
        filters: [
          { name: 'YAML Files', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      return {
        success: true,
        path: result.filePath,
        filename: result.filename
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
      const result = await window.electron.fs.readFile({
        filters: [
          { name: 'YAML Files', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      return {
        content: result.content,
        path: result.filePath,
        filename: result.filename
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
    const saveResult = await this.saveContractLocally(
      buildId,
      exportData.contract_yaml,
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
    const events = response.data.events || [];

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


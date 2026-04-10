import apiClient from './apiClient';
import cryptoService from './cryptoService';

/**
 * Verification Service - Audit chain and contract verification
 * Handles hash chain verification, signature validation, and contract integrity checks
 */
class VerificationService {
  /**
   * Verify audit chain for a build (backend verification)
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {valid: boolean, genesis_hash: string, total_events: number, errors: Array}
   */
  async verifyAuditChain(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/verify`);
    return response.data;
  }

  /**
   * Verify contract integrity (backend verification)
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - {valid: boolean, contract_hash: string, section_hashes: Object}
   */
  async verifyContractIntegrity(buildId) {
    const response = await apiClient.get(`/builds/${buildId}/verify-contract`);
    const data = response.data || {};
    const valid = typeof data.valid === 'boolean'
      ? data.valid
      : !!data.is_valid;

    const errors = Array.isArray(data.errors)
      ? data.errors
      : (valid ? [] : (data.details ? [data.details] : []));

    return {
      ...data,
      valid,
      errors,
      details: data.details || ''
    };
  }

  /**
   * Verify a signature locally
   * @param {string} hash - Hash that was signed
   * @param {string} signature - Signature to verify
   * @param {string} publicKey - Public key in PEM format
   * @returns {Promise<boolean>}
   */
  async verifySignature(hash, signature, publicKey) {
    return await cryptoService.verify(hash, signature, publicKey);
  }

  /**
   * Verify local contract hash
   * @param {string} contractYaml - Contract YAML content
   * @param {string} expectedHash - Expected hash
   * @returns {Promise<boolean>}
   */
  async verifyLocalContract(contractYaml, expectedHash) {
    const actualHash = await cryptoService.hash(contractYaml);
    return actualHash === expectedHash;
  }

  /**
   * Verify hash chain locally (client-side verification)
   * @param {Array} auditEvents - Array of audit events
   * @param {string} genesisHash - Genesis hash for the build
   * @returns {Promise<Object>} - {valid: boolean, errors: Array, totalEvents: number, verifiedEvents: number}
   */
  async verifyHashChain(auditEvents, genesisHash) {
    if (!auditEvents || auditEvents.length === 0) {
      return {
        valid: true,
        errors: [],
        totalEvents: 0,
        verifiedEvents: 0
      };
    }

    const errors = [];
    let previousHash = genesisHash;

    for (let i = 0; i < auditEvents.length; i++) {
      const event = auditEvents[i];

      // Verify previous hash link
      if (event.previous_event_hash !== previousHash) {
        errors.push({
          sequence: event.sequence_no,
          error: 'Hash chain broken',
          expected: previousHash,
          actual: event.previous_event_hash,
          eventType: event.event_type
        });
      }

      // Verify event hash
      const eventData = JSON.stringify(event.event_data);
      const computedHash = await cryptoService.hash(
        eventData + event.previous_event_hash
      );

      if (computedHash !== event.event_hash) {
        errors.push({
          sequence: event.sequence_no,
          error: 'Event hash mismatch',
          expected: computedHash,
          actual: event.event_hash,
          eventType: event.event_type
        });
      }

      previousHash = event.event_hash;
    }

    return {
      valid: errors.length === 0,
      errors,
      totalEvents: auditEvents.length,
      verifiedEvents: auditEvents.length - errors.length
    };
  }

  /**
   * Validate actor signatures for all audit events
   * @param {Array} auditEvents - Array of audit events
   * @returns {Promise<Array>} - Array of validation results
   */
  async validateActorSignatures(auditEvents) {
    const results = [];

    for (const event of auditEvents) {
      if (!event.signature || !event.actor_public_key) {
        results.push({
          sequence: event.sequence_no,
          eventType: event.event_type,
          valid: false,
          error: 'Missing signature or public key',
          actorFingerprint: event.actor_key_fingerprint || 'unknown'
        });
        continue;
      }

      try {
        const isValid = await this.verifySignature(
          event.event_hash,
          event.signature,
          event.actor_public_key
        );

        results.push({
          sequence: event.sequence_no,
          eventType: event.event_type,
          valid: isValid,
          actorFingerprint: event.actor_key_fingerprint,
          timestamp: event.created_at
        });
      } catch (error) {
        results.push({
          sequence: event.sequence_no,
          eventType: event.event_type,
          valid: false,
          error: error.message,
          actorFingerprint: event.actor_key_fingerprint || 'unknown'
        });
      }
    }

    return results;
  }

  /**
   * Compute genesis hash for a build
   * @param {string} buildId - Build ID
   * @returns {Promise<string>} - Genesis hash
   */
  async computeGenesisHash(buildId) {
    return await cryptoService.hash(`IBM_CC:${buildId}`);
  }

  /**
   * Perform complete verification of a build
   * @param {string} buildId - Build ID
   * @returns {Promise<Object>} - Complete verification report
   */
  async performCompleteVerification(buildId) {
    const report = {
      buildId,
      timestamp: new Date().toISOString(),
      auditChain: null,
      contractIntegrity: null,
      hashChain: null,
      signatures: null,
      overall: {
        valid: false,
        errors: []
      }
    };

    try {
      // 1. Verify audit chain (backend)
      report.auditChain = await this.verifyAuditChain(buildId);

      // 2. Verify contract integrity (backend)
      report.contractIntegrity = await this.verifyContractIntegrity(buildId);

      // 3. Get audit events for local verification
      const auditResponse = await apiClient.get(`/builds/${buildId}/audit`);
      const auditEvents = auditResponse.data.events || [];

      // 4. Compute genesis hash
      const genesisHash = await this.computeGenesisHash(buildId);

      // 5. Verify hash chain locally
      report.hashChain = await this.verifyHashChain(auditEvents, genesisHash);

      // 6. Validate actor signatures
      report.signatures = await this.validateActorSignatures(auditEvents);

      // 7. Determine overall validity
      const allValid =
        report.auditChain.valid &&
        report.contractIntegrity.valid &&
        report.hashChain.valid &&
        report.signatures.every(s => s.valid);

      report.overall.valid = allValid;

      if (!allValid) {
        if (!report.auditChain.valid) {
          report.overall.errors.push('Audit chain verification failed');
        }
        if (!report.contractIntegrity.valid) {
          report.overall.errors.push('Contract integrity verification failed');
        }
        if (!report.hashChain.valid) {
          report.overall.errors.push(`Hash chain verification failed: ${report.hashChain.errors.length} errors`);
        }
        const invalidSignatures = report.signatures.filter(s => !s.valid);
        if (invalidSignatures.length > 0) {
          report.overall.errors.push(`${invalidSignatures.length} invalid signatures`);
        }
      }

    } catch (error) {
      report.overall.valid = false;
      report.overall.errors.push(`Verification failed: ${error.message}`);
    }

    return report;
  }

  /**
   * Verify section hash
   * @param {string} encryptedPayload - Encrypted section content
   * @param {string} expectedHash - Expected hash
   * @returns {Promise<boolean>}
   */
  async verifySectionHash(encryptedPayload, expectedHash) {
    const actualHash = await cryptoService.hash(encryptedPayload);
    return actualHash === expectedHash;
  }

  /**
   * Verify section signature
   * @param {Object} section - Section object
   * @param {string} publicKey - Submitter's public key
   * @returns {Promise<boolean>}
   */
  async verifySectionSignature(section, publicKey) {
    if (!section.section_hash || !section.signature) {
      return false;
    }

    return await this.verifySignature(
      section.section_hash,
      section.signature,
      publicKey
    );
  }

  /**
   * Generate verification report summary
   * @param {Object} verificationReport - Complete verification report
   * @returns {Object} - Summary with statistics
   */
  generateReportSummary(verificationReport) {
    const summary = {
      buildId: verificationReport.buildId,
      timestamp: verificationReport.timestamp,
      overallValid: verificationReport.overall.valid,
      checks: {
        auditChain: verificationReport.auditChain?.valid || false,
        contractIntegrity: verificationReport.contractIntegrity?.valid || false,
        hashChain: verificationReport.hashChain?.valid || false,
        signatures: verificationReport.signatures?.every(s => s.valid) || false
      },
      statistics: {
        totalEvents: verificationReport.hashChain?.totalEvents || 0,
        verifiedEvents: verificationReport.hashChain?.verifiedEvents || 0,
        totalSignatures: verificationReport.signatures?.length || 0,
        validSignatures: verificationReport.signatures?.filter(s => s.valid).length || 0,
        errors: verificationReport.overall.errors.length
      },
      errors: verificationReport.overall.errors
    };

    return summary;
  }

  /**
   * Export verification report
   * @param {Object} verificationReport - Complete verification report
   * @param {string} format - Export format ('json' or 'text')
   * @returns {string} - Formatted report
   */
  exportVerificationReport(verificationReport, format = 'json') {
    if (format === 'json') {
      return JSON.stringify(verificationReport, null, 2);
    }

    // Text format
    const summary = this.generateReportSummary(verificationReport);
    let text = `Verification Report for Build ${summary.buildId}\n`;
    text += `Generated: ${summary.timestamp}\n`;
    text += `\n`;
    text += `Overall Status: ${summary.overallValid ? 'VALID ' : 'INVALID '}\n`;
    text += `\n`;
    text += `Checks:\n`;
    text += `  Audit Chain: ${summary.checks.auditChain ? 'PASS ' : 'FAIL '}\n`;
    text += `  Contract Integrity: ${summary.checks.contractIntegrity ? 'PASS ' : 'FAIL '}\n`;
    text += `  Hash Chain: ${summary.checks.hashChain ? 'PASS ' : 'FAIL '}\n`;
    text += `  Signatures: ${summary.checks.signatures ? 'PASS ' : 'FAIL '}\n`;
    text += `\n`;
    text += `Statistics:\n`;
    text += `  Total Events: ${summary.statistics.totalEvents}\n`;
    text += `  Verified Events: ${summary.statistics.verifiedEvents}\n`;
    text += `  Total Signatures: ${summary.statistics.totalSignatures}\n`;
    text += `  Valid Signatures: ${summary.statistics.validSignatures}\n`;
    text += `  Errors: ${summary.statistics.errors}\n`;

    if (summary.errors.length > 0) {
      text += `\n`;
      text += `Errors:\n`;
      summary.errors.forEach((error, i) => {
        text += `  ${i + 1}. ${error}\n`;
      });
    }

    return text;
  }
}

export default new VerificationService();

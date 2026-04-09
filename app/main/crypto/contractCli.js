const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ContractCliBridge {
  constructor() {
    // Path to contract-cli binary (should be bundled with the app)
    // For now, assume it's in PATH or will be configured
    this.cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';
  }

  /**
   * Encrypt a string section using contract-cli encrypt-string.
   * Used for workload, env, and attestation public key.
   * @param {string} plainText - Content to encrypt
   * @param {string} encryptionCertPath - Path to HPCR encryption certificate
   * @returns {Promise<string>} - Encrypted string (hyper-protect-basic.xxx.yyy)
   */
  async encryptSection(plainText, encryptionCertPath) {
    return new Promise((resolve, reject) => {
      const process = spawn(this.cliPath, [
        'encrypt-string',
        '--in', '-',
        '--cert', encryptionCertPath
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`contract-cli encrypt-string failed: ${stderr}`));
        } else {
          resolve(stdout.trim()); // hyper-protect-basic.xxx.yyy
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn contract-cli: ${error.message}`));
      });

      process.stdin.write(plainText);
      process.stdin.end();
    });
  }

  /**
   * Encrypt a file using contract-cli.
   * @param {string} inputPath - Path to input file
   * @param {string} encryptionCertPath - Path to HPCR encryption certificate
   * @returns {Promise<string>} - Encrypted content
   */
  async encryptFile(inputPath, encryptionCertPath) {
    const content = await fs.readFile(inputPath, 'utf8');
    return this.encryptSection(content, encryptionCertPath);
  }

  /**
   * Assemble final contract YAML from encrypted sections.
   * @param {Object} sections - Contract sections
   * @param {string} sections.encryptedWorkload - Encrypted workload
   * @param {string} sections.encryptedEnv - Encrypted environment
   * @param {string} sections.envWorkloadSignature - Signature
   * @param {string} sections.encryptedAttestationKey - Encrypted attestation key
   * @returns {string} - Complete YAML contract
   */
  assembleContract({
    encryptedWorkload,
    encryptedEnv,
    envWorkloadSignature,
    encryptedAttestationKey
  }) {
    return `env: ${encryptedEnv}
workload: ${encryptedWorkload}
envWorkloadSignature: ${envWorkloadSignature}
attestationPublicKey: ${encryptedAttestationKey}
`;
  }

  /**
   * Save encryption certificate to a temporary file.
   * @param {string} certContent - Certificate content
   * @returns {Promise<string>} - Path to temporary file
   */
  async saveCertToTempFile(certContent) {
    const tempDir = os.tmpdir();
    const certPath = path.join(tempDir, `hpcr-cert-${Date.now()}.pem`);
    await fs.writeFile(certPath, certContent, 'utf8');
    return certPath;
  }

  /**
   * Clean up temporary certificate file.
   * @param {string} certPath - Path to certificate file
   */
  async cleanupTempFile(certPath) {
    try {
      await fs.unlink(certPath);
    } catch (error) {
      // Ignore errors during cleanup
      console.warn('Failed to cleanup temp file:', error.message);
    }
  }
}

module.exports = new ContractCliBridge();



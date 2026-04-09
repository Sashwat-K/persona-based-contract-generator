/**
 * Crypto Service - Bridge to Electron main process crypto operations
 * All cryptographic operations are performed in the main process for security
 */

class CryptoService {
  /**
   * Generate RSA-4096 key pair for user identity
   * @returns {Promise<{publicKey: string, privateKey: string}>}
   */
  async generateIdentityKeyPair() {
    return window.electron.crypto.generateIdentityKeyPair();
  }

  /**
   * Generate RSA-4096 key pair for attestation
   * @returns {Promise<{publicKey: string, privateKey: string}>}
   */
  async generateAttestationKeyPair() {
    return window.electron.crypto.generateAttestationKeyPair();
  }

  /**
   * Generate AES-256 symmetric key
   * @returns {Promise<string>} - Base64 encoded key
   */
  async generateSymmetricKey() {
    return window.electron.crypto.generateSymmetricKey();
  }

  /**
   * Compute SHA-256 fingerprint of a public key
   * @param {string} publicKeyPem - Public key in PEM format
   * @returns {Promise<string>} - Fingerprint in format XX:XX:XX:...
   */
  async computeFingerprint(publicKeyPem) {
    return window.electron.crypto.computeFingerprint(publicKeyPem);
  }

  /**
   * Encrypt data with AES-256-GCM
   * @param {string} data - Data to encrypt
   * @param {string} keyBase64 - Symmetric key in base64
   * @returns {Promise<{iv, authTag, encrypted}>} - All in base64
   */
  async encryptWithSymmetricKey(data, keyBase64) {
    return window.electron.crypto.encryptWithSymmetricKey(data, keyBase64);
  }

  /**
   * Decrypt data with AES-256-GCM
   * @param {Object} encrypted - {iv, authTag, encrypted} in base64
   * @param {string} keyBase64 - Symmetric key in base64
   * @returns {Promise<string>} - Decrypted plaintext
   */
  async decryptWithSymmetricKey(encrypted, keyBase64) {
    return window.electron.crypto.decryptWithSymmetricKey(encrypted, keyBase64);
  }

  /**
   * Wrap symmetric key with RSA-OAEP
   * @param {string} symmetricKeyBase64 - Symmetric key in base64
   * @param {string} recipientPublicKey - Recipient's RSA public key (PEM)
   * @returns {Promise<string>} - Wrapped key in base64
   */
  async wrapSymmetricKey(symmetricKeyBase64, recipientPublicKey) {
    return window.electron.crypto.wrapSymmetricKey(symmetricKeyBase64, recipientPublicKey);
  }

  /**
   * Unwrap symmetric key with RSA-OAEP
   * @param {string} wrappedKeyBase64 - Wrapped key in base64
   * @param {string} privateKey - Own RSA private key (PEM)
   * @returns {Promise<string>} - Unwrapped symmetric key in base64
   */
  async unwrapSymmetricKey(wrappedKeyBase64, privateKey) {
    return window.electron.crypto.unwrapSymmetricKey(wrappedKeyBase64, privateKey);
  }

  /**
   * Compute SHA-256 hash
   * @param {string} data - Data to hash
   * @returns {Promise<string>} - Hash in hex format
   */
  async hash(data) {
    return window.electron.crypto.hash(data);
  }

  /**
   * Compute SHA-256 hash of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - Hash in hex format
   */
  async hashFile(filePath) {
    return window.electron.crypto.hashFile(filePath);
  }

  /**
   * Sign a hash with RSA-PSS
   * @param {string} hash - Hash to sign (hex string)
   * @param {string} privateKey - RSA private key (PEM)
   * @returns {Promise<string>} - Signature in base64
   */
  async sign(hash, privateKey) {
    return window.electron.crypto.sign(hash, privateKey);
  }

  /**
   * Verify a signature with RSA-PSS
   * @param {string} hash - Hash that was signed (hex string)
   * @param {string} signature - Signature in base64
   * @param {string} publicKey - RSA public key (PEM)
   * @returns {Promise<boolean>} - True if signature is valid
   */
  async verify(hash, signature, publicKey) {
    return window.electron.crypto.verify(hash, signature, publicKey);
  }

  /**
   * Store private key securely
   * @param {string} userId - User ID
   * @param {string} privateKey - Private key in PEM format
   * @returns {Promise<{success: boolean}>}
   */
  async storePrivateKey(userId, privateKey) {
    return window.electron.crypto.storePrivateKey(userId, privateKey);
  }

  /**
   * Retrieve private key
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} - Private key in PEM format or null
   */
  async getPrivateKey(userId) {
    return window.electron.crypto.getPrivateKey(userId);
  }

  /**
   * Delete private key
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean}>}
   */
  async deletePrivateKey(userId) {
    return window.electron.crypto.deletePrivateKey(userId);
  }

  /**
   * Check if private key exists
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async hasPrivateKey(userId) {
    return window.electron.crypto.hasPrivateKey(userId);
  }

  /**
   * Encrypt section with contract-cli
   * @param {string} plainText - Content to encrypt
   * @param {string} certContent - HPCR encryption certificate content
   * @returns {Promise<string>} - Encrypted string (hyper-protect-basic.xxx.yyy)
   */
  async encryptSection(plainText, certContent) {
    return window.electron.contractCli.encryptSection(plainText, certContent);
  }

  /**
   * Assemble final YAML contract
   * @param {Object} sections - Contract sections
   * @returns {Promise<string>} - Complete YAML contract
   */
  async assembleContract(sections) {
    return window.electron.contractCli.assembleContract(sections);
  }
}

export default new CryptoService();



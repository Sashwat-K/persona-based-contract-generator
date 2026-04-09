const crypto = require('crypto');
const fs = require('fs').promises;

class Signer {
  /**
   * Compute SHA256 hash of file contents.
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - Hash in hex format
   */
  async hashFile(filePath) {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compute SHA256 hash of buffer/string.
   * @param {string|Buffer} data - Data to hash
   * @returns {string} - Hash in hex format
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign a hash using RSA-PSS with SHA-256.
   * @param {string} hash - Hash to sign (hex string)
   * @param {string} privateKeyPem - RSA private key in PEM format
   * @returns {string} - Signature in base64
   */
  sign(hash, privateKeyPem) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(hash);
    
    return sign.sign(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
      },
      'base64'
    );
  }

  /**
   * Verify a signature against a hash and public key.
   * @param {string} hash - Hash that was signed (hex string)
   * @param {string} signature - Signature in base64
   * @param {string} publicKeyPem - RSA public key in PEM format
   * @returns {boolean} - True if signature is valid
   */
  verify(hash, signature, publicKeyPem) {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(hash);
    
    return verify.verify(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
      },
      signature,
      'base64'
    );
  }
}

module.exports = new Signer();



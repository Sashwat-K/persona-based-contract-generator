const crypto = require('crypto');
const { promisify } = require('util');

const generateKeyPair = promisify(crypto.generateKeyPair);

class KeyManager {
  /**
   * Generate RSA 4096-bit key pair for user identity (signing + key wrapping).
   */
  async generateIdentityKeyPair() {
    const { publicKey, privateKey } = await generateKeyPair('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  }

  /**
   * Generate RSA 4096-bit key pair for attestation.
   */
  async generateAttestationKeyPair() {
    return this.generateIdentityKeyPair();
  }

  /**
   * Generate AES-256 symmetric key for environment staging.
   */
  generateSymmetricKey() {
    return crypto.randomBytes(32); // 256 bits
  }

  /**
   * Compute SHA-256 fingerprint of a public key.
   */
  computeFingerprint(publicKeyPem) {
    return crypto
      .createHash('sha256')
      .update(publicKeyPem)
      .digest('hex')
      .toUpperCase()
      .match(/.{1,2}/g)
      .join(':');
  }
}

module.exports = new KeyManager();

// Made with Bob

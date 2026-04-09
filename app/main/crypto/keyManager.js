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
   * Must match backend implementation: hash the DER-encoded bytes, not the PEM string.
   */
  computeFingerprint(publicKeyPem) {
    // Extract the base64 content from PEM (remove headers and newlines)
    const pemContent = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');

    // Decode base64 to get DER bytes
    const derBytes = Buffer.from(pemContent, 'base64');

    // Compute SHA-256 hash of DER bytes
    const hash = crypto.createHash('sha256').update(derBytes).digest('hex');

    // Format as XX:XX:XX:... (uppercase with colons)
    return hash
      .toUpperCase()
      .match(/.{1,2}/g)
      .join(':');
  }
}

module.exports = new KeyManager();



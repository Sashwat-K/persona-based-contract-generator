const crypto = require('crypto');

class Encryptor {
  /**
   * AES-256-GCM encrypt data with given symmetric key.
   * @param {string|Buffer} data - Data to encrypt
   * @param {Buffer} key - 256-bit symmetric key
   * @returns {Object} - {iv, authTag, encrypted} all in base64
   */
  encryptWithSymmetricKey(data, key) {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Return all components in base64
    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encrypted: encrypted.toString('base64')
    };
  }

  /**
   * AES-256-GCM decrypt data with given symmetric key.
   * @param {Object} encryptedData - {iv, authTag, encrypted} in base64
   * @param {Buffer} key - 256-bit symmetric key
   * @returns {string} - Decrypted plaintext
   */
  decryptWithSymmetricKey(encryptedData, key) {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  /**
   * RSA-OAEP wrap symmetric key with recipient's public key.
   * @param {Buffer} symmetricKey - AES key to wrap
   * @param {string} recipientPublicKeyPem - Recipient's RSA public key
   * @returns {string} - Wrapped key in base64
   */
  wrapSymmetricKey(symmetricKey, recipientPublicKeyPem) {
    const wrapped = crypto.publicEncrypt(
      {
        key: recipientPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      symmetricKey
    );

    return wrapped.toString('base64');
  }

  /**
   * RSA-OAEP unwrap symmetric key with own private key.
   * @param {string} wrappedKeyBase64 - Wrapped key in base64
   * @param {string} privateKeyPem - Own RSA private key
   * @returns {Buffer} - Unwrapped symmetric key
   */
  unwrapSymmetricKey(wrappedKeyBase64, privateKeyPem) {
    const wrappedKey = Buffer.from(wrappedKeyBase64, 'base64');

    return crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      wrappedKey
    );
  }
}

module.exports = new Encryptor();



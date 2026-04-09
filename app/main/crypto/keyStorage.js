const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class KeyStorage {
  constructor() {
    this.storageDir = path.join(app.getPath('userData'), 'keys');
    this.ensureStorageDir();
  }

  /**
   * Ensure the storage directory exists.
   */
  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create key storage directory:', error);
    }
  }

  /**
   * Encrypt data using a derived key from user's system.
   * This is a basic encryption - in production, consider using OS keychain.
   * @param {string} data - Data to encrypt
   * @returns {Object} - {encrypted, iv, authTag}
   */
  encryptData(data) {
    // Derive a key from machine ID (basic approach)
    // In production, use OS keychain (keytar library)
    const machineKey = crypto.createHash('sha256')
      .update(app.getPath('userData'))
      .digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', machineKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  /**
   * Decrypt data using a derived key from user's system.
   * @param {Object} encryptedData - {encrypted, iv, authTag}
   * @returns {string} - Decrypted data
   */
  decryptData(encryptedData) {
    const machineKey = crypto.createHash('sha256')
      .update(app.getPath('userData'))
      .digest();

    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', machineKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  /**
   * Store private key securely.
   * @param {string} userId - User ID
   * @param {string} privateKeyPem - Private key in PEM format
   */
  async storePrivateKey(userId, privateKeyPem) {
    await this.ensureStorageDir();

    const encrypted = this.encryptData(privateKeyPem);
    const keyPath = path.join(this.storageDir, `${userId}-identity.key`);

    await fs.writeFile(keyPath, JSON.stringify(encrypted), 'utf8');
  }

  /**
   * Retrieve private key.
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} - Private key in PEM format or null
   */
  async getPrivateKey(userId) {
    try {
      const keyPath = path.join(this.storageDir, `${userId}-identity.key`);
      const encryptedData = await fs.readFile(keyPath, 'utf8');
      const parsed = JSON.parse(encryptedData);

      return this.decryptData(parsed);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Key doesn't exist
      }
      throw error;
    }
  }

  /**
   * Delete private key.
   * @param {string} userId - User ID
   */
  async deletePrivateKey(userId) {
    try {
      const keyPath = path.join(this.storageDir, `${userId}-identity.key`);
      await fs.unlink(keyPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if private key exists.
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async hasPrivateKey(userId) {
    try {
      const keyPath = path.join(this.storageDir, `${userId}-identity.key`);
      await fs.access(keyPath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new KeyStorage();



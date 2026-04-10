import cryptoService from './cryptoService';
import { useAuthStore } from '../store/authStore';

/**
 * Signature Middleware - Automatic request signing for API calls
 * Implements RSA-4096 PSS signing for all mutating requests
 */
class SignatureMiddleware {
  isSignatureExempt(method, url) {
    const m = (method || '').toUpperCase();
    const path = (url || '').split('?')[0];

    if (m === 'POST' && path === '/auth/logout') return true;
    if (m === 'PATCH' && /^\/users\/[^/]+\/password\/?$/.test(path)) return true;
    if (m === 'PUT' && /^\/users\/[^/]+\/public-key\/?$/.test(path)) return true;
    return false;
  }

  /**
   * Sign a request before sending to backend
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @returns {Promise<Object>} - Signature headers
   */
  async signRequest(method, url, data) {
    const user = useAuthStore.getState().user;
    const upperMethod = (method || '').toUpperCase();
    if (!user) return {};

    // Only sign mutating requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod)) {
      return {};
    }

    // Setup/auth endpoints that backend exempts from signature checks.
    if (this.isSignatureExempt(upperMethod, url)) {
      return {};
    }

    // Get private key
    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Local signing key not found. Open Account Settings and register your public key again.');
    }

    // Normalize payload data so object and equivalent JSON-string payloads hash identically.
    let normalizedData = data ?? null;
    if (typeof normalizedData === 'string') {
      const trimmed = normalizedData.trim();
      if (trimmed.length === 0) {
        normalizedData = null;
      } else {
        try {
          normalizedData = JSON.parse(trimmed);
        } catch {
          // Keep raw string when it's not JSON.
        }
      }
    }

    // Compute request hash
    const timestamp = Date.now();
    const path = (url || '').split('?')[0];
    const payload = JSON.stringify({
      method: upperMethod,
      path,
      data: normalizedData,
      timestamp
    });

    const hash = await cryptoService.hash(payload);

    // Sign hash
    const signature = await cryptoService.sign(hash, privateKey);

    // Return signature headers
    return {
      'X-Signature': signature,
      'X-Signature-Hash': hash,
      'X-Timestamp': timestamp.toString(),
      'X-Key-Fingerprint': user.public_key_fingerprint || user.publicKeyFingerprint || ''
    };
  }

  /**
   * Sign a build action (state transition, finalization, etc.)
   * @param {string} buildId - Build ID
   * @param {string} action - Action type
   * @param {Object} data - Action data
   * @returns {Promise<Object>} - {hash, signature}
   */
  async signBuildAction(buildId, action, data) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found. Please register your public key first.');
    }

    const payload = JSON.stringify({
      buildId,
      action,
      data,
      timestamp: Date.now()
    });

    const hash = await cryptoService.hash(payload);
    const signature = await cryptoService.sign(hash, privateKey);

    return { hash, signature };
  }

  /**
   * Sign data with current user's private key
   * @param {string} data - Data to sign
   * @returns {Promise<Object>} - {hash, signature}
   */
  async signData(data) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('User not authenticated');

    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('Private key not found. Please register your public key first.');
    }

    const hash = await cryptoService.hash(data);
    const signature = await cryptoService.sign(hash, privateKey);

    return { hash, signature };
  }

  /**
   * Verify a signature
   * @param {string} hash - Hash that was signed
   * @param {string} signature - Signature to verify
   * @param {string} publicKey - Public key to verify with
   * @returns {Promise<boolean>} - True if valid
   */
  async verifySignature(hash, signature, publicKey) {
    return await cryptoService.verify(hash, signature, publicKey);
  }

  /**
   * Check if user has a private key registered
   * @returns {Promise<boolean>}
   */
  async hasPrivateKey() {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    return await cryptoService.hasPrivateKey(user.id);
  }
}

export default new SignatureMiddleware();

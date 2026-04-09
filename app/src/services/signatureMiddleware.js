import cryptoService from './cryptoService';
import { useAuthStore } from '../store/authStore';

/**
 * Signature Middleware - Automatic request signing for API calls
 * Implements RSA-4096 PSS signing for all mutating requests
 */
class SignatureMiddleware {
  /**
   * Sign a request before sending to backend
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @returns {Promise<Object>} - Signature headers
   */
  async signRequest(method, url, data) {
    const user = useAuthStore.getState().user;
    if (!user) return {};

    // Only sign mutating requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      return {};
    }

    // Get private key
    const privateKey = await cryptoService.getPrivateKey(user.id);
    if (!privateKey) {
      console.warn('Private key not found, request will not be signed');
      return {};
    }

    // Compute request hash
    const timestamp = Date.now();
    const payload = JSON.stringify({
      method: method.toUpperCase(),
      url,
      data: data || null,
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
      'X-Key-Fingerprint': user.public_key_fingerprint || ''
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


import axios from 'axios';
import { useConfigStore } from '../store/configStore';
import { useAuthStore } from '../store/authStore';
import signatureMiddleware from './signatureMiddleware';

/**
 * Enhanced ApiClient with retry logic, error handling, and request cancellation
 * Features:
 * - Automatic retry with exponential backoff
 * - Request cancellation support
 * - Standardized error responses
 * - Network timeout handling
 */

class ApiClient {
  forceLogout(reason = 'unauthorized') {
    // Clear store + axios auth header
    useAuthStore.getState().clearAuth();
    this.clearAuthToken();

    // Clear legacy localStorage keys used by App shell bootstrap
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_roles');
    localStorage.removeItem('user_email');

    // Notify UI shell to switch to login view immediately.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:forced-logout', { detail: { reason } }));
    }
  }

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Track pending requests for cancellation
    this.pendingRequests = new Map();

    // Initialize with stored server URL
    const serverUrl = useConfigStore.getState().serverUrl;
    this.setBaseURL(serverUrl);

    // Request interceptor for auth token and signatures
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token (skip for login endpoint)
        const token = useAuthStore.getState().token;
        if (token && !config.url?.endsWith('/auth/login')) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add signature headers for mutating requests
        try {
          const signatureHeaders = await signatureMiddleware.signRequest(
            config.method,
            config.url,
            config.data
          );
          Object.assign(config.headers, signatureHeaders);
        } catch (error) {
          console.error('Failed to sign request:', error);
          return Promise.reject(this.normalizeError(error, error.message || 'Failed to sign request.'));
        }
        
        // Add request ID for tracking
        config.requestId = `${config.method}-${config.url}-${Date.now()}`;
        
        // Log request for debugging
        console.log(`[API Request] ${config.method.toUpperCase()} ${config.baseURL}${config.url}`, {
          headers: config.headers,
          data: config.data
        });
        
        return config;
      },
      (error) => Promise.reject(this.normalizeError(error))
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Remove from pending requests
        if (response.config.requestId) {
          this.pendingRequests.delete(response.config.requestId);
        }
        
        // Log response for debugging
        console.log(`[API Response] ${response.config.method.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data
        });
        
        return response;
      },
      async (error) => {
        // Remove from pending requests
        if (error.config?.requestId) {
          this.pendingRequests.delete(error.config.requestId);
        }

        // Log error for debugging (400s are often expected, use warn)
        const logFn = error.response?.status === 400 ? console.warn : console.error;
        logFn(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          data: error.response?.data
        });

        // Handle 401 Unauthorized (skip for login endpoint — let it surface naturally)
        if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
          this.forceLogout('401');
          return Promise.reject(this.normalizeError(error, 'Authentication failed. Please login again.'));
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
          const errCode = error.response?.data?.error?.code;
          if (errCode === 'ACCOUNT_SETUP_REQUIRED') {
            const pending = error.response?.data?.error?.details?.setup_pending || [];
            const stepLabels = pending.map((s) =>
              s === 'password_change' ? 'change password' :
              s === 'public_key_registration' ? 'register public key' :
              s
            );
            const pendingText = stepLabels.length ? ` Pending: ${stepLabels.join(' and ')}.` : '';
            return Promise.reject(this.normalizeError(error, `Account setup required.${pendingText} Open Account Settings to continue.`));
          }
          const backendForbiddenMessage =
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            'You do not have permission to perform this action.';
          return Promise.reject(this.normalizeError(error, backendForbiddenMessage));
        }

        // Handle 429 Rate Limit
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          return Promise.reject(this.normalizeError(error, `Rate limit exceeded. Please try again in ${retryAfter} seconds.`));
        }

        // Handle network errors
        if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
          return Promise.reject(this.normalizeError(error, 'Network error. Please check your connection.'));
        }

        // Handle timeout
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
          return Promise.reject(this.normalizeError(error, 'Request timeout. Please try again.'));
        }

        // Retry logic for specific errors
        if (this.shouldRetry(error) && !error.config?._retry) {
          return this.retryRequest(error);
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Normalize error responses to a consistent format
   */
  normalizeError(error, customMessage = null) {
    // Backend nest is {"error": {"message": "..."}} or {"message": "..."}
    const backendMsg = error.response?.data?.error?.message || error.response?.data?.message;
    const normalized = {
      message: customMessage || backendMsg || error.message || 'An unexpected error occurred',
      status: error.response?.status,
      code: error.code,
      data: error.response?.data,
      isNetworkError: !error.response,
      isTimeout: error.code === 'ECONNABORTED',
      original: error
    };

    return normalized;
  }

  /**
   * Determine if request should be retried
   */
  shouldRetry(error) {
    const method = (error.config?.method || '').toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (isMutating) {
      return false;
    }

    // Don't retry client errors (4xx) except 429
    if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
      return false;
    }

    // Retry network errors and 5xx errors
    return !error.response || error.response?.status >= 500;
  }

  /**
   * Retry request with exponential backoff
   */
  async retryRequest(error, maxRetries = 3) {
    const config = error.config;
    config._retry = (config._retry || 0) + 1;

    if (config._retry > maxRetries) {
      return Promise.reject(this.normalizeError(error, 'Maximum retry attempts exceeded'));
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, config._retry - 1) * 1000;
    
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.client.request(config);
  }

  /**
   * Cancel a specific request by ID
   */
  cancelRequest(requestId) {
    const controller = this.pendingRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
  }

  setBaseURL(url) {
    this.client.defaults.baseURL = url;
  }

  getBaseURL() {
    return this.client.defaults.baseURL;
  }

  setAuthToken(token) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * Enhanced request methods with cancellation support
   */
  async get(url, config = {}) {
    const controller = new AbortController();
    const requestConfig = { ...config, signal: controller.signal };
    
    try {
      const response = await this.client.get(url, requestConfig);
      return response;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw this.normalizeError(error, 'Request cancelled');
      }
      throw error;
    }
  }

  async post(url, data, config = {}) {
    const controller = new AbortController();
    const requestConfig = { ...config, signal: controller.signal };
    
    try {
      const response = await this.client.post(url, data, requestConfig);
      return response;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw this.normalizeError(error, 'Request cancelled');
      }
      throw error;
    }
  }

  async put(url, data, config = {}) {
    const controller = new AbortController();
    const requestConfig = { ...config, signal: controller.signal };
    
    try {
      const response = await this.client.put(url, data, requestConfig);
      return response;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw this.normalizeError(error, 'Request cancelled');
      }
      throw error;
    }
  }

  async patch(url, data, config = {}) {
    const controller = new AbortController();
    const requestConfig = { ...config, signal: controller.signal };
    
    try {
      const response = await this.client.patch(url, data, requestConfig);
      return response;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw this.normalizeError(error, 'Request cancelled');
      }
      throw error;
    }
  }

  async delete(url, config = {}) {
    const controller = new AbortController();
    const requestConfig = { ...config, signal: controller.signal };
    
    try {
      const response = await this.client.delete(url, requestConfig);
      return response;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw this.normalizeError(error, 'Request cancelled');
      }
      throw error;
    }
  }
}

export default new ApiClient();

import axios from 'axios';
import { useConfigStore } from '../store/configStore';
import { useAuthStore } from '../store/authStore';

class ApiClient {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Initialize with stored server URL
    const serverUrl = useConfigStore.getState().serverUrl;
    this.setBaseURL(serverUrl);

    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear auth
          useAuthStore.getState().clearAuth();
        }
        return Promise.reject(error);
      }
    );
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

  async get(url, config) {
    return this.client.get(url, config);
  }

  async post(url, data, config) {
    return this.client.post(url, data, config);
  }

  async put(url, data, config) {
    return this.client.put(url, data, config);
  }

  async patch(url, data, config) {
    return this.client.patch(url, data, config);
  }

  async delete(url, config) {
    return this.client.delete(url, config);
  }
}

export default new ApiClient();

// Made with Bob

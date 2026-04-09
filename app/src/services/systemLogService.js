import apiClient from './apiClient';

/**
 * System Logs Service
 * For fetching global administrative audit logs.
 */
class SystemLogService {
  /**
   * Fetch paginated system logs 
   * @param {number} limit - pagination limit
   * @param {number} offset - pagination offset
   * @returns {Promise<Array>} List of system log objects
   */
  async getSystemLogs(limit = 100, offset = 0) {
    const response = await apiClient.get(`/system-logs?limit=${limit}&offset=${offset}`);
    return response.data || [];
  }
}

export default new SystemLogService();

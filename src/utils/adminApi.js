import { secureAdminCheck, secureStorage, secureErrorHandler, validateUserData } from '@/utils/security';
import { API_BASE_URL } from '@/config/api';

const getAuthHeaders = () => {
  try {
    const userData = secureStorage.get('user');
    if (!userData) {
      throw new Error('Not authenticated');
    }

    if (!validateUserData(userData)) {
      throw new Error('Invalid user data');
    }

    if (!secureAdminCheck(userData)) {
      throw new Error('Admin privileges required');
    }

    const token = btoa(JSON.stringify({
      id: userData.id,
      login: userData.login,
      timestamp: Date.now()
    }));
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Requested-With': 'XMLHttpRequest'
    };
  } catch (error) {
    throw new Error(secureErrorHandler(error, 'Auth Headers'));
  }
};

const secureApiCall = async (endpoint, options = {}) => {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        secureStorage.clear();
        window.location.href = '/?manji=admin';
        throw new Error('Authentication expired');
      }
      if (response.status === 403) {
        throw new Error('Access denied');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return response;
  } catch (error) {
    throw new Error(secureErrorHandler(error, `API Call: ${endpoint}`));
  }
};

export const adminApi = {
  async getBulkAdminData() {
    return await secureApiCall('/api/admin-data');
  },

  async saveBulkChanges(changes) {
    return await secureApiCall('/api/admin/bulk-save', {
      method: 'POST',
      body: JSON.stringify({ changes })
    });
  },

  async getStats() {
    return await secureApiCall('/api/admin/stats');
  },

  async getSessions() {
    return await secureApiCall('/api/admin/sessions');
  },

  async deleteSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    return await secureApiCall(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    });
  },

  async downloadSessions() {
    try {
      const headers = getAuthHeaders();
      delete headers['Content-Type']; // Remove content-type for file downloads
      
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/download`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          secureStorage.clear();
          window.location.href = '/?manji=admin';
          throw new Error('Authentication expired');
        }
        if (response.status === 403) {
          throw new Error('Access denied');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      throw new Error(secureErrorHandler(error, 'Download Sessions'));
    }
  },

  async getSessionFiles(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    return await secureApiCall(`/api/admin/sessions/${encodeURIComponent(sessionId)}/files`);
  },

  async downloadSessionFile(sessionId, filename) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename');
    }
    
    try {
      const headers = getAuthHeaders();
      delete headers['Content-Type']; // Remove content-type for file downloads
      
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(filename)}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          secureStorage.clear();
          window.location.href = '/?manji=admin';
          throw new Error('Authentication expired');
        }
        if (response.status === 403) {
          throw new Error('Access denied');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      throw new Error(secureErrorHandler(error, `Download Session File: ${sessionId}/${filename}`));
    }
  },

  async downloadSessionArchive(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    
    try {
      const headers = getAuthHeaders();
      delete headers['Content-Type']; // Remove content-type for file downloads
      
      const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${encodeURIComponent(sessionId)}/download`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          secureStorage.clear();
          window.location.href = '/?manji=admin';
          throw new Error('Authentication expired');
        }
        if (response.status === 403) {
          throw new Error('Access denied');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      throw new Error(secureErrorHandler(error, `Download Session Archive: ${sessionId}`));
    }
  },

  async getPlugins() {
    return await secureApiCall('/api/admin/plugins');
  },

  async updatePluginStatus(pluginId, status) {
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error('Invalid plugin ID');
    }
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      throw new Error('Invalid status');
    }
    
    return await secureApiCall(`/api/admin/plugins/${encodeURIComponent(pluginId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async deletePlugin(pluginId) {
    if (!pluginId || typeof pluginId !== 'string') {
      throw new Error('Invalid plugin ID');
    }
    return await secureApiCall(`/api/admin/plugins/${encodeURIComponent(pluginId)}`, {
      method: 'DELETE'
    });
  },

  async downloadPlugins() {
    return await secureApiCall('/api/admin/plugins/download');
  },

  async getSupportData() {
    return await secureApiCall('/api/admin/support');
  },

  async updateSupportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid support data');
    }
    
    return await secureApiCall('/api/admin/support', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getFAQs() {
    return await secureApiCall('/api/admin/faqs');
  },

  async addFAQ(faqData) {
    if (!faqData || typeof faqData !== 'object') {
      throw new Error('Invalid FAQ data');
    }
    if (!faqData.question || !faqData.answer || !faqData.category) {
      throw new Error('Missing required FAQ fields');
    }
    
    return await secureApiCall('/api/admin/faqs', {
      method: 'POST',
      body: JSON.stringify(faqData)
    });
  },

  async updateFAQ(id, faqData) {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new Error('Invalid FAQ ID');
    }
    if (!faqData || typeof faqData !== 'object') {
      throw new Error('Invalid FAQ data');
    }
    
    return await secureApiCall(`/api/admin/faqs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(faqData)
    });
  },

  async deleteFAQ(id) {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new Error('Invalid FAQ ID');
    }
    return await secureApiCall(`/api/admin/faqs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async downloadFAQs() {
    return await secureApiCall('/api/admin/faqs/download');
  }
};

export default adminApi;
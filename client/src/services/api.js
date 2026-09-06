// client/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  timeout: 30000
});

// Request interceptor
apiClient.interceptors.request.use(
  config => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now()
    };
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor with retry logic
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    
    // Retry logic for network errors
    if (!config._retry && (error.code === 'ECONNABORTED' || !error.response)) {
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;
      
      if (config._retryCount <= 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * config._retryCount));
        return apiClient(config);
      }
    }
    
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          error.message = 'AUTHENTICATION_FAILED';
          break;
        case 404:
          error.message = 'RESOURCE_NOT_FOUND';
          break;
        case 409:
          error.message = 'CONFLICT_DETECTED';
          break;
        case 429:
          error.message = 'RATE_LIMIT_EXCEEDED';
          break;
        case 500:
          error.message = 'SERVER_ERROR';
          break;
        default:
          error.message = data?.error || 'REQUEST_FAILED';
      }
    } else if (error.request) {
      // No response received
      error.message = 'NETWORK_ERROR';
    }
    
    return Promise.reject(error);
  }
);

export const api = {
  getNotes: async () => {
    const response = await apiClient.get('/notes');
    return response.data;
  },

  getNote: async (id) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    const response = await apiClient.get(`/note?id=${id}`);
    return response.data;
  },

  createNote: async (noteData) => {
    if (!noteData.title || !noteData.content) {
      throw new Error('TITLE_AND_CONTENT_REQUIRED');
    }
    const response = await apiClient.post('/notes', noteData);
    return response.data;
  },

  updateNote: async (id, noteData) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    if (!noteData.title || !noteData.content) {
      throw new Error('TITLE_AND_CONTENT_REQUIRED');
    }
    const response = await apiClient.put(`/note?id=${id}`, noteData);
    return response.data;
  },

  deleteNote: async (id, password) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    const url = `/note?id=${id}${password ? `&password=${encodeURIComponent(password)}` : ''}`;
    const response = await apiClient.delete(url);
    return response.data;
  },

  verifyPassword: async (id, password) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    if (!password) throw new Error('PASSWORD_REQUIRED');
    
    try {
      // First, try to get the note to check if it has a password
      const note = await api.getNote(id);
      
      // If note doesn't have a password, return true
      if (!note.password || note.password === null || note.password === '') {
        return true;
      }
      
      // Try to update with the password - this will fail if password is wrong
      await apiClient.put(`/note?id=${id}`, {
        title: note.title,
        content: note.content,
        currentPassword: password
      });
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('INVALID_PASSWORD');
      }
      throw error;
    }
  }
};
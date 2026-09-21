// client/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
});

// Request interceptor — cache buster on GETs
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    if (method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — retry GETs, normalize error messages
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    const method = (config?.method || 'get').toLowerCase();
    if (
      method === 'get' &&
      config &&
      !config._retry &&
      (error.code === 'ECONNABORTED' || !error.response)
    ) {
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 3) {
        await new Promise((r) => setTimeout(r, 800 * config._retryCount));
        return apiClient(config);
      }
    }

    if (error.response) {
      const { status, data } = error.response;
      error.status = status;
      error.serverData = data;
      switch (status) {
        case 401:
          error.message = data?.error || 'AUTHENTICATION_FAILED';
          break;
        case 404:
          error.message = data?.error || 'RESOURCE_NOT_FOUND';
          break;
        case 409:
          error.message = data?.error || 'CONFLICT_DETECTED';
          if (data && data.serverNote) {
            error.conflict = true;
            error.serverNote = data.serverNote;
            error.serverVersion = data.serverVersion;
          }
          break;
        case 410:
          error.message = data?.error || 'GONE';
          break;
        case 429:
          error.message = data?.error || 'RATE_LIMIT_EXCEEDED';
          error.retryAfter = data?.retryAfter;
          break;
        case 500:
          error.message = 'SERVER_ERROR';
          break;
        default:
          error.message = data?.error || 'REQUEST_FAILED';
      }
    } else if (error.request) {
      error.message = 'NETWORK_ERROR';
    }

    return Promise.reject(error);
  }
);

export const api = {
  // ---------- Notes list ----------
  getNotes: async ({ q, sort, limit, cursor } = {}) => {
    const params = {};
    if (q) params.q = q;
    if (sort) params.sort = sort;
    if (limit) params.limit = limit;
    if (cursor) params.cursor = cursor;
    const response = await apiClient.get('/notes', { params });
    return response.data;
  },

  // ---------- Single note ----------
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
    // Password now goes in the body — no more leaking via query string / logs.
    const response = await apiClient.delete(`/note?id=${id}`, {
      data: { password },
    });
    return response.data;
  },

  verifyPassword: async (id, password) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    if (!password) throw new Error('PASSWORD_REQUIRED');
    try {
      const res = await apiClient.post(`/note?id=${id}`, { password });
      return res.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('INVALID_PASSWORD');
      }
      throw error;
    }
  },

  // ---------- Versions ----------
  getVersions: async (id) => {
    if (!id) throw new Error('NOTE_ID_REQUIRED');
    const response = await apiClient.get(`/note/versions?id=${id}`);
    return response.data;
  },

  restoreVersion: async (id, versionId, currentPassword) => {
    if (!id || !versionId) throw new Error('IDS_REQUIRED');
    const response = await apiClient.post(`/note/restore?id=${id}`, {
      versionId,
      currentPassword,
    });
    return response.data;
  },

  // ---------- Share links ----------
  createShareLink: async (id, currentPassword, expiresInDays = 7) => {
    if (!id || !currentPassword) throw new Error('MISSING_ARGS');
    const response = await apiClient.post(`/note/share?id=${id}`, {
      currentPassword,
      expiresInDays,
    });
    return response.data;
  },

  revokeShareLink: async (id, currentPassword) => {
    if (!id || !currentPassword) throw new Error('MISSING_ARGS');
    const response = await apiClient.delete(`/note/share?id=${id}`, {
      data: { currentPassword },
    });
    return response.data;
  },

  getSharedNote: async (token) => {
    if (!token) throw new Error('TOKEN_REQUIRED');
    const response = await apiClient.get(`/share`, { params: { token } });
    return response.data;
  },
};
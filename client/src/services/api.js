import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  getNotes: async () => {
    const response = await apiClient.get('/notes');
    return response.data;
  },

  getNote: async (id) => {
    const response = await apiClient.get(`/note?id=${id}`);
    return response.data;
  },

  createNote: async (noteData) => {
    const response = await apiClient.post('/notes', noteData);
    return response.data;
  },

  updateNote: async (id, noteData) => {
    const response = await apiClient.put(`/note?id=${id}`, noteData);
    return response.data;
  },

  deleteNote: async (id, password) => {
    const response = await apiClient.delete(`/note?id=${id}${password ? `&password=${password}` : ''}`);
    return response.data;
  },
};
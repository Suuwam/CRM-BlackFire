import axios from 'axios';

// Update API_URL to match your backend host (e.g. http://192.168.x.x:5000/api or production domain)
export const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  apply: (data) => api.post('/auth/apply', data),
  verify: (data) => api.post('/auth/verify', data),
};

export const tasksApi = {
  list: (project) => api.get('/tasks', { params: { project } }),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  move: (id, column) => api.patch(`/tasks/${id}/move`, { column }),
  delete: (id) => api.delete(`/tasks/${id}`),
};

export const clientsApi = {
  list: () => api.get('/clients'),
};

export const activityApi = {
  list: (days = 50) => api.get('/activity', { params: { days } }),
};

export default api;

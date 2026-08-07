import axios from 'axios';

function getBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const href = window.location.href || '';
    const origin = window.location.origin || '';
    if (href.startsWith('capacitor://') || href.startsWith('file://') || origin.startsWith('capacitor://') || origin.startsWith('file://') || (origin.includes('localhost') && window.Capacitor)) {
      return 'https://crm-blackfire.vercel.app/api';
    }
  }
  return '/api';
}

const api = axios.create({ baseURL: getBaseUrl() });

api.interceptors.request.use(config => {
  try {
    const raw = sessionStorage.getItem('crm_session_user') || localStorage.getItem('crm_session_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?._id) config.headers['x-session-user'] = user._id;
    }
  } catch {}
  return config;
});

export const fetcher = url => api.get(url).then(res => res.data);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  apply: (data) => api.post('/auth/apply', data),
  verify: (data) => api.post('/auth/apply/verify', data),
  me: () => api.get('/auth/me'),
};

export const activityApi = {
  list: (days = 50) => api.get('/activity', { params: { days } }),
};

export const emailApi = {
  send: (data) => api.post('/email/send', data),
  bulk: (data) => api.post('/email/bulk', data),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  listApplications: () => api.get('/users/applications'),
  approveApplication: (id) => api.post(`/users/applications/${id}/approve`),
  approveAllApplications: () => api.post('/users/applications/approve-all'),
  rejectApplication: (id) => api.post(`/users/applications/${id}/reject`),
};

export const clientsApi = {
  list: () => api.get('/clients'),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  uploadPhoto: (id, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.patch(`/clients/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  delete: (id) => api.delete(`/clients/${id}`),
};

export const eventsApi = {
  list: (params) => api.get('/events', { params }),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  uploadImage: (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.patch(`/events/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  delete: (id) => api.delete(`/events/${id}`),
};

export const templatesApi = {
  list: () => api.get('/templates'),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

export const referencesApi = {
  list: () => api.get('/references'),
  create: (data) => api.post('/references', data),
  update: (id, data) => api.put(`/references/${id}`, data),
  delete: (id) => api.delete(`/references/${id}`),
  scrape: (url) => api.post('/references/scrape', { url }),
};

export const tasksApi = {
  list: (project) => api.get('/tasks', { params: { project } }),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  uploadImage: (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.patch(`/tasks/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  move: (id, column) => api.patch(`/tasks/${id}/move`, { column }),
  delete: (id) => api.delete(`/tasks/${id}`),
};

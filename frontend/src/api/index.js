import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const fetcher = url => api.get(url).then(res => res.data);

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

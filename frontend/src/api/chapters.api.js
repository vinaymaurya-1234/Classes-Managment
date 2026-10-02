import { api } from './client'

export const getChapters = (token, className = '') => {
  const query = className ? `?className=${encodeURIComponent(className)}` : ''
  return api.get(`/api/chapters${query}`, token)
}

export const createChapter = (payload, token) => api.post('/api/chapters', payload, token)
export const updateChapter = (id, payload, token) => api.put(`/api/chapters/${id}`, payload, token)
export const deleteChapter = (id, token) => api.delete(`/api/chapters/${id}`, token)

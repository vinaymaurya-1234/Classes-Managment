import { api } from './client'

export const getChapters = () => api.get('/api/chapters')
export const createChapter = payload => api.post('/api/chapters', payload)
export const updateChapter = (id, payload) => api.put(`/api/chapters/${id}`, payload)
export const deleteChapter = id => api.delete(`/api/chapters/${id}`)

const configuredUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim()
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BASE_URL = ((configuredUrl && !/localhost|127\\.0\\.1/i.test(configuredUrl)) ? configuredUrl : `http://${host}:5000`).replace(/\\/$/, '')
const CHAT_URL = `${BASE_URL}/api/chat`

const request = async (path, token, options = {}) => {
  const response = await fetch(`${CHAT_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Chat request failed')
  return data
}

export const getChatContactsApi = token => request('/contacts', token)
export const getDirectMessagesApi = (token, userId) => request(`/${userId}`, token)
export const sendDirectMessageApi = (token, userId, payload) => request(`/${userId}`, token, { method: 'POST', body: JSON.stringify(payload) })
export const editDirectMessageApi = (token, messageId, text) => request(`/message/${messageId}`, token, { method: 'PATCH', body: JSON.stringify({ text }) })
export const deleteDirectMessageApi = (token, messageId) => request(`/message/${messageId}`, token, { method: 'DELETE' })

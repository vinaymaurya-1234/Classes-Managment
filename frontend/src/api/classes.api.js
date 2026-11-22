const configuredUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim()
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BASE_URL = ((configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl)) ? configuredUrl : `http://${host}:5000`).replace(/\/$/, '')
const CLASSES_URL = `${BASE_URL}/api/classes`

const request = async (path, token, options = {}) => {
  const response = await fetch(`${CLASSES_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Class structure request failed')
  return data
}

export const listClassDivisionsApi = token => request('', token)
export const saveClassStructureApi = (token, standards) => request('/structure', token, { method: 'PUT', body: JSON.stringify({ standards }) })

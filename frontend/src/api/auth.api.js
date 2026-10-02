const configuredUrl = (import.meta.env.VITE_API_URL || '').trim()
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BASE_URL = ((configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl))
  ? configuredUrl
  : `http://${host}:5000`).replace(/\/$/, '')
const AUTH_URL = `${BASE_URL}/api/auth`

const request = async (path, options = {}) => {
  const response = await fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const loginApi = (email, password) =>
  request('/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const getMeApi = token =>
  request('/me', { headers: { Authorization: `Bearer ${token}` } })

export const updateProfileApi = (token, payload) =>
  request('/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

export const changePasswordApi = (token, payload) =>
  request('/password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

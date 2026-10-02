const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'classleaf_auth_token'

async function request(path, options = {}) {
  let response

  const token = localStorage.getItem(TOKEN_KEY)
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch (error) {
    throw new Error('Unable to connect to the backend. Make sure the API server is running.')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`)
  }

  return response.status === 204 ? null : payload
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: path => request(path, { method: 'DELETE' }),
}

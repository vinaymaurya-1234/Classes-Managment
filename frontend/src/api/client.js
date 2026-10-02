const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function request(path, options = {}, token = '') {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  get: (path, token) => request(path, {}, token),
  post: (path, body, token) => request(path, { method: 'POST', body: JSON.stringify(body) }, token),
  put: (path, body, token) => request(path, { method: 'PUT', body: JSON.stringify(body) }, token),
  delete: (path, token) => request(path, { method: 'DELETE' }, token),
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.status === 204 ? null : response.json()
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, { method:'POST', body:JSON.stringify(body) }),
  put: (path, body) => request(path, { method:'PUT', body:JSON.stringify(body) }),
  delete: path => request(path, { method:'DELETE' }),
}

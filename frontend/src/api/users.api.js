const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const USERS_URL = `${BASE_URL}/api/users`

const request = async (path = '', options = {}) => {
  const response = await fetch(`${USERS_URL}${path}`, {
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

export const listUsersApi = (token, role) =>
  request(`?role=${encodeURIComponent(role)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

export const createUserApi = (token, payload) =>
  request('', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

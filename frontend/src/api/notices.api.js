const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const NOTICES_URL = `${BASE_URL}/api/notices`

const request = async (path = '', token, options = {}) => {
  const response = await fetch(`${NOTICES_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Notice request failed')
  return data
}

export const listNoticesApi = token => request('', token)

export const createNoticeApi = (token, payload) =>
  request('', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

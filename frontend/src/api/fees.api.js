const configuredUrl = (import.meta.env.VITE_API_URL || '').trim()
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BASE_URL = ((configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl))
  ? configuredUrl
  : `http://${host}:5000`).replace(/\/$/, '')
const FEES_URL = `${BASE_URL}/api/fees`

const request = async (path = '', token, options = {}) => {
  const response = await fetch(`${FEES_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Fee request failed')
  return data
}

export const listStudentFeesApi = (token, academicYear = '') =>
  request(`/students${academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : ''}`, token)

export const saveStudentFeeApi = (token, studentId, payload) =>
  request(`/students/${encodeURIComponent(studentId)}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

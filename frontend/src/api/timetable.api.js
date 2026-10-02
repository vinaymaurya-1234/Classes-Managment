const configuredUrl = (import.meta.env.VITE_API_URL || '').trim()
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const BASE_URL = ((configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl))
  ? configuredUrl
  : `http://${host}:5000`).replace(/\/$/, '')
const TIMETABLE_URL = `${BASE_URL}/api/timetable`

const request = async (path, token, options = {}) => {
  const response = await fetch(`${TIMETABLE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Timetable request failed')
  return data
}
export const getTimetableApi = (token, date) => request(`?date=${encodeURIComponent(date)}`, token)
export const getTimetableRangeApi = (token, from, to) => request(`/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, token)
export const getTimetableTeachersApi = token => request('/teachers', token)
export const createTimetableEntryApi = (token, payload) => request('', token, { method: 'POST', body: JSON.stringify(payload) })
export const updateTimetableEntryApi = (token, id, payload) => request(`/${encodeURIComponent(id)}`, token, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteTimetableEntryApi = (token, id) => request(`/${encodeURIComponent(id)}`, token, { method: 'DELETE' })

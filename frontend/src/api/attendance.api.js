const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const ATTENDANCE_URL = `${BASE_URL}/api/attendance`

const request = async (path, token, options = {}) => {
  const response = await fetch(`${ATTENDANCE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Attendance request failed')
  return data
}

export const getTodayAttendanceSessionApi = token =>
  request('/today', token)

export const createTodayAttendanceSessionApi = token =>
  request('/today', token, { method: 'POST' })

export const getTodayAttendanceSummaryApi = token =>
  request('/today/summary', token)

export const markAttendanceApi = (token, accessToken) =>
  request('/mark', token, {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  })

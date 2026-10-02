const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const getTeacherClasses = async (token, className = '') => {
  const query = className ? `?className=${encodeURIComponent(className)}` : ''
  const response = await fetch(`${API_BASE_URL}/api/teacher/classes${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || `Request failed: ${response.status}`)
  return payload
}

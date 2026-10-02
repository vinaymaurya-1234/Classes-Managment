import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, QrCode, RefreshCw, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  createTodayAttendanceSessionApi,
  getTodayAttendanceSessionApi,
  getTodayAttendanceSummaryApi,
} from '../../api/attendance.api'

const buildAttendanceUrl = accessToken =>
  `${window.location.origin}/student/attendance?attendanceToken=${encodeURIComponent(accessToken)}`

const qrImageUrl = value =>
  `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=18&data=${encodeURIComponent(value)}`

const formatTime = value =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(value))
    : ''

export default function PrincipalAttendanceQr() {
  const { token } = useAuth()
  const [session, setSession] = useState(null)
  const [present, setPresent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const attendanceUrl = useMemo(
    () => session?.accessToken ? buildAttendanceUrl(session.accessToken) : '',
    [session],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [sessionResult, summaryResult] = await Promise.all([
        getTodayAttendanceSessionApi(token).catch(error => {
          if (error.message.includes('has not been created')) return null
          throw error
        }),
        getTodayAttendanceSummaryApi(token),
      ])

      setSession(sessionResult?.session || null)
      setPresent(summaryResult.present || 0)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!session) return undefined

    const interval = window.setInterval(async () => {
      try {
        const summary = await getTodayAttendanceSummaryApi(token)
        setPresent(summary.present || 0)
      } catch {
        // Keep the existing count if a background refresh fails.
      }
    }, 5000)

    return () => window.clearInterval(interval)
  }, [session, token])

  const createQr = async () => {
    setCreating(true)
    setError('')

    try {
      const result = await createTodayAttendanceSessionApi(token)
      setSession(result.session)
      const summary = await getTodayAttendanceSummaryApi(token)
      setPresent(summary.present || 0)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = async () => {
    if (!attendanceUrl) return

    try {
      await navigator.clipboard.writeText(attendanceUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the attendance link.')
    }
  }

  if (loading) {
    return <div className="attendance-admin-state">Loading today's attendance...</div>
  }

  return (
    <div className="principal-attendance">
      <div className="attendance-admin-head">
        <div>
          <span className="eyebrow">DAILY ATTENDANCE</span>
          <h2>Today's student attendance</h2>
          <p>Create one QR code for today's attendance. Students scan this QR from their own accounts to mark themselves present.</p>
        </div>
        <button className="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="attendance-admin-error">{error}</div>}

      {!session ? (
        <section className="attendance-create-card">
          <div className="attendance-create-icon"><QrCode size={28} /></div>
          <div>
            <h3>No attendance QR created yet</h3>
            <p>Create today's QR and display it in the classroom. The same QR remains valid for today's attendance.</p>
          </div>
          <button className="primary" onClick={createQr} disabled={creating}>
            <QrCode size={16} /> {creating ? 'Creating...' : 'Create today’s QR'}
          </button>
        </section>
      ) : (
        <div className="attendance-admin-grid">
          <section className="attendance-qr-card">
            <div className="attendance-qr-image-wrap">
              <img
                src={qrImageUrl(attendanceUrl)}
                alt="Today's student attendance QR code"
                className="attendance-qr-image"
              />
            </div>
            <div className="attendance-qr-meta">
              <span>ACTIVE TODAY</span>
              <strong>{session.date}</strong>
              <p>Created at {formatTime(session.createdAt)} · Students can scan this QR to mark attendance.</p>
            </div>
          </section>

          <section className="attendance-live-card">
            <div className="attendance-live-icon"><Users size={20} /></div>
            <span>STUDENTS PRESENT</span>
            <strong>{present}</strong>
            <p>Updates automatically while students scan.</p>
            <div className="attendance-live-status">
              <i /> Attendance QR is active
            </div>
            <div className="attendance-admin-actions">
              <button className="secondary" onClick={copyLink}>
                <Copy size={15} /> {copied ? 'Copied' : 'Copy attendance link'}
              </button>
              <button className="secondary" onClick={load}>
                <RefreshCw size={15} /> Refresh count
              </button>
            </div>
            <div className="attendance-note">
              <CheckCircle2 size={16} />
              <span>Students can only mark themselves once for this attendance session.</span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

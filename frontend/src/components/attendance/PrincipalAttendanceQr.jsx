import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Copy, QrCode, RefreshCw, Search, UserCheck, UserX, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createTodayAttendanceSessionApi, getPrincipalAttendanceDashboardApi, getPrincipalAttendanceHistoryApi, getPrincipalStudentAttendanceApi, getTodayAttendanceSessionApi } from '../../api/attendance.api'

const todayIndia = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const v = Object.fromEntries(parts.map(x => [x.type, x.value]))
  return v.year + '-' + v.month + '-' + v.day
}
const offset = (value, days) => {
  const d = new Date(value + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const monthRange = (value, previous = true) => {
  const d = new Date(value + 'T00:00:00Z')
  if (previous) d.setUTCMonth(d.getUTCMonth() - 1)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return { from: y + '-' + String(m + 1).padStart(2, '0') + '-01', to: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(new Date(Date.UTC(y, m + 1, 0)).getUTCDate()).padStart(2, '0') }
}
const dateLabel = value => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00'))
const timeLabel = value => value ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)) : ''
const qrUrl = token => 'https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=18&data=' + encodeURIComponent(window.location.origin + '/student/attendance?attendanceToken=' + encodeURIComponent(token))

export default function PrincipalAttendanceQr() {
  const { token } = useAuth()
  const today = useMemo(todayIndia, [])
  const [date, setDate] = useState(today)
  const [dashboard, setDashboard] = useState(null)
  const [history, setHistory] = useState([])
  const [historyMeta, setHistoryMeta] = useState({ recordedDays: 0, averagePercentage: 0, totalPresent: 0 })
  const [from, setFrom] = useState(offset(today, -29))
  const [to, setTo] = useState(today)
  const [range, setRange] = useState('30')
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('present')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [detail, setDetail] = useState(null)

  const loadDashboard = useCallback(async selected => {
    setLoading(true)
    setError('')
    try {
      const result = await getPrincipalAttendanceDashboardApi(token, selected)
      setDashboard(result)
      if (selected === today) {
        const qr = await getTodayAttendanceSessionApi(token).catch(() => null)
        setSession(qr?.session || null)
      } else setSession(null)
    } catch (e) { setError(e.message || 'Unable to load attendance.') }
    finally { setLoading(false) }
  }, [token, today])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const result = await getPrincipalAttendanceHistoryApi(token, from, to)
      setHistory(result.days || [])
      setHistoryMeta({ recordedDays: result.recordedDays || 0, averagePercentage: result.averagePercentage || 0, totalPresent: result.totalPresent || 0 })
    } catch (e) { setError(e.message || 'Unable to load attendance history.') }
    finally { setHistoryLoading(false) }
  }, [token, from, to])

  useEffect(() => { loadDashboard(date) }, [loadDashboard, date])
  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (date !== today || !session) return
    const id = setInterval(() => { loadDashboard(today); loadHistory() }, 5000)
    return () => clearInterval(id)
  }, [date, today, session, loadDashboard, loadHistory])

  const createQr = async () => {
    setCreating(true); setError('')
    try {
      const result = await createTodayAttendanceSessionApi(token)
      setSession(result.session)
      await loadDashboard(today)
    } catch (e) { setError(e.message || 'Unable to create QR.') }
    finally { setCreating(false) }
  }

  const setRangeState = next => {
    setRange(next)
    if (next === 'month') {
      const r = monthRange(today)
      setFrom(r.from); setTo(r.to)
    } else {
      setFrom(offset(today, -29)); setTo(today)
    }
  }

  const students = tab === 'present' ? dashboard?.presentStudents || [] : dashboard?.absentStudents || []
  const filtered = students.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))

  const openStudent = async student => {
    try {
      const result = await getPrincipalStudentAttendanceApi(token, student.id, from, to)
      setDetail(result)
    } catch (e) { setError(e.message || 'Unable to load student history.') }
  }

  const copyQr = async () => {
    if (!session?.accessToken) return
    try {
      await navigator.clipboard.writeText(window.location.origin + '/student/attendance?attendanceToken=' + encodeURIComponent(session.accessToken))
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { setError('Could not copy QR link.') }
  }

  if (loading && !dashboard) return <div className="attendance-admin-state">Loading attendance dashboard...</div>

  return <div className="principal-attendance-dashboard">
    <div className="attendance-admin-head">
      <div><span className="eyebrow">ATTENDANCE MANAGEMENT</span><h2>Student attendance</h2><p>See who is present, who is absent, and review attendance for previous days and months.</p></div>
      <button className="secondary" onClick={() => { loadDashboard(date); loadHistory() }}><RefreshCw size={15}/> Refresh</button>
    </div>

    {error && <div className="attendance-admin-error">{error}</div>}

    <section className="attendance-date-bar">
      <button className="icon-button" onClick={() => setDate(offset(date, -1))}><ChevronLeft size={17}/></button>
      <div className="attendance-selected-date"><CalendarDays size={17}/><div><span>ATTENDANCE FOR</span><strong>{dateLabel(date)}{date === today ? ' · Today' : ''}</strong></div></div>
      <button className="icon-button" disabled={date >= today} onClick={() => setDate(offset(date, 1))}><ChevronRight size={17}/></button>
      <button className="secondary" onClick={() => setDate(today)}>Today</button>
    </section>

    <div className="attendance-stat-grid">
      <div className="attendance-stat-card"><span>TOTAL STUDENTS</span><strong>{dashboard?.totalStudents || 0}</strong><Users size={18}/></div>
      <div className="attendance-stat-card present"><span>PRESENT</span><strong>{dashboard?.presentCount || 0}</strong><UserCheck size={18}/></div>
      <div className="attendance-stat-card absent"><span>ABSENT</span><strong>{dashboard?.absentCount || 0}</strong><UserX size={18}/></div>
      <div className="attendance-stat-card percentage"><span>ATTENDANCE RATE</span><strong>{dashboard?.attendancePercentage || 0}%</strong><CheckCircle2 size={18}/></div>
    </div>

    {date === today && !session && <section className="attendance-create-card"><div className="attendance-create-icon"><QrCode size={28}/></div><div><h3>Today's QR is not active</h3><p>Create today's QR and students will appear here immediately after scanning it.</p></div><button className="primary" onClick={createQr} disabled={creating}><QrCode size={16}/> {creating ? 'Creating...' : 'Create today’s QR'}</button></section>}

    {date === today && session && <section className="attendance-live-banner"><div className="attendance-live-banner-icon"><QrCode size={20}/></div><div><strong>Today's QR is active</strong><span>Created at {timeLabel(session.createdAt)} · Present count refreshes automatically.</span></div><button className="secondary" onClick={copyQr}><Copy size={15}/> {copied ? 'Copied' : 'Copy QR link'}</button><div className="attendance-mini-qr"><img src={qrUrl(session.accessToken)} alt="Today's attendance QR"/></div></section>}

    <section className="attendance-people-card">
      <div className="attendance-people-head"><div><span className="eyebrow">{tab === 'present' ? 'PRESENT STUDENTS' : 'ABSENT STUDENTS'}</span><h3>{tab === 'present' ? 'Who is present' : 'Who is absent'}</h3></div><div className="attendance-list-switch"><button className={tab === 'present' ? 'active' : ''} onClick={() => setTab('present')}>Present {dashboard?.presentCount || 0}</button><button className={tab === 'absent' ? 'active' : ''} onClick={() => setTab('absent')}>Absent {dashboard?.absentCount || 0}</button></div></div>
      <div className="attendance-people-tools"><div className="attendance-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..."/></div><span>{filtered.length} students</span></div>
      <div className="attendance-student-list">
        {filtered.length ? filtered.map(student => <button className="attendance-student-row" key={student.id} onClick={() => openStudent(student)}>{student.avatarUrl ? <img src={student.avatarUrl} alt=""/> : <span className="attendance-student-avatar">{student.name?.[0] || '?'}</span>}<div><strong>{student.name}</strong><span>{student.email}</span></div><div className="attendance-student-time">{student.markedAt ? 'Present · ' + timeLabel(student.markedAt) : 'Not marked'}</div><ChevronRight size={16}/></button>) : <div className="attendance-empty">{dashboard?.session ? 'No students match your search.' : 'No attendance session exists for this date.'}</div>}
      </div>
    </section>

    <section className="attendance-history-card">
      <div className="attendance-people-head"><div><span className="eyebrow">HISTORY</span><h3>Previous attendance</h3></div><div className="attendance-history-switch"><button className={range === '30' ? 'active' : ''} onClick={() => setRangeState('30')}>Last 30 days</button><button className={range === 'month' ? 'active' : ''} onClick={() => setRangeState('month')}>Last month</button></div></div>
      <div className="attendance-history-range">{dateLabel(from)} — {dateLabel(to)}</div>
      <div className="attendance-history-summary">
        <div><span>RECORDED DAYS</span><strong>{historyMeta.recordedDays}</strong></div>
        <div><span>TOTAL PRESENT MARKS</span><strong>{historyMeta.totalPresent}</strong></div>
        <div><span>AVERAGE ATTENDANCE</span><strong>{historyMeta.averagePercentage}%</strong></div>
      </div>
      <div className="attendance-history-table"><div className="attendance-history-row header"><span>Date</span><span>Status</span><span>Present</span><span>Absent</span><span>Rate</span></div>{historyLoading ? <div className="attendance-empty">Loading history...</div> : history.map(day => <button key={day.date} className={'attendance-history-row ' + (day.date === date ? 'selected' : '')} onClick={() => setDate(day.date)}><strong>{dateLabel(day.date)}</strong><span className={day.hasSession ? 'history-session-active' : 'history-session-none'}>{day.hasSession ? 'Recorded' : 'No session'}</span><span>{day.hasSession ? day.present : '—'}</span><span>{day.hasSession ? day.absent : '—'}</span><span>{day.hasSession ? day.percentage + '%' : '—'}</span></button>)}</div>
    </section>

    {detail && <div className="attendance-detail-backdrop" onMouseDown={() => setDetail(null)}><section className="attendance-detail-modal" onMouseDown={e => e.stopPropagation()}><button className="attendance-detail-close" onClick={() => setDetail(null)}><X size={17}/></button><div className="attendance-detail-profile">{detail.student.avatarUrl ? <img src={detail.student.avatarUrl} alt=""/> : <span>{detail.student.name?.[0] || '?'}</span>}<div><span className="eyebrow">STUDENT ATTENDANCE</span><h3>{detail.student.name}</h3><p>{detail.student.email}</p></div></div><div className="attendance-detail-stats"><div><span>PRESENT</span><strong>{detail.present}</strong></div><div><span>ABSENT</span><strong>{detail.absent}</strong></div><div><span>RATE</span><strong>{detail.percentage}%</strong></div></div><div className="attendance-detail-days">{detail.days.length ? detail.days.map(day => <div key={day.date} className={day.present ? 'present' : 'absent'}><span>{dateLabel(day.date)}</span><strong>{day.present ? 'Present' : 'Absent'}</strong>{day.markedAt && <small>{timeLabel(day.markedAt)}</small>}</div>) : <div className="attendance-empty">No attendance sessions in this period.</div>}</div></section></div>}
  </div>
}

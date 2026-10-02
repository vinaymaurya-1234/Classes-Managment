import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ClipboardPaste, LoaderCircle, QrCode, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getStudentAttendanceSummaryApi, markAttendanceApi } from '../../api/attendance.api'

const getTokenFromValue = value => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    return url.searchParams.get('attendanceToken') || ''
  } catch {
    return raw
  }
}

const formatTime = value =>
  value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

export default function StudentAttendanceScanner() {
  const { token } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const frameRef = useRef(null)
  const busyRef = useRef(false)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerSupported, setScannerSupported] = useState(true)
  const [manualValue, setManualValue] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) videoRef.current.srcObject = null
    detectorRef.current = null
    setScannerOpen(false)
  }, [])

  const loadSummary = useCallback(async () => {
    if (!token) return
    try {
      const data = await getStudentAttendanceSummaryApi(token)
      setSummary(data)
    } catch {
      // The scanner remains usable even if the historical summary is temporarily unavailable.
    }
  }, [token])

  const mark = useCallback(async value => {
    const attendanceToken = getTokenFromValue(value)
    if (!attendanceToken || busyRef.current) return

    busyRef.current = true
    setLoading(true)
    setError('')
    setStatus(null)
    stopCamera()

    try {
      const data = await markAttendanceApi(token, attendanceToken)
      setStatus({
        type: data.alreadyMarked ? 'already' : 'success',
        message: data.message,
        markedAt: data.attendance?.markedAt,
      })

      const params = new URLSearchParams(window.location.search)
      if (params.has('attendanceToken')) {
        window.history.replaceState({}, '', window.location.pathname)
      }

      await loadSummary()
    } catch (err) {
      setError(err.message || 'Unable to mark attendance. Please scan today’s QR again.')
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }, [loadSummary, stopCamera, token])

  const scanFrame = useCallback(async () => {
    if (!scannerOpen || !videoRef.current || !detectorRef.current || busyRef.current) return

    const video = videoRef.current
    if (video.readyState < 2) {
      frameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const codes = await detectorRef.current.detect(canvas)
      if (codes.length) {
        const value = codes[0].rawValue
        if (value) {
          await mark(value)
          return
        }
      }
    } catch {
      // Keep scanning; camera frames can occasionally fail while the video is starting.
    }

    frameRef.current = requestAnimationFrame(scanFrame)
  }, [mark, scannerOpen])

  const openCamera = async () => {
    setError('')
    setStatus(null)

    if (!('BarcodeDetector' in window)) {
      setScannerSupported(false)
      setScannerOpen(true)
      return
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      detectorRef.current = detector

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })

      streamRef.current = stream
      setScannerOpen(true)

      requestAnimationFrame(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        frameRef.current = requestAnimationFrame(scanFrame)
      })
    } catch (err) {
      stopCamera()
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : 'Unable to open the camera on this device.'
      )
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryToken = params.get('attendanceToken')
    if (queryToken) mark(queryToken)
    loadSummary()

    return () => stopCamera()
  }, [loadSummary, mark, stopCamera])

  return (
    <section className="student-attendance">
      <div className="student-attendance-hero">
        <div>
          <span className="eyebrow">ATTENDANCE</span>
          <h2>Mark today’s attendance</h2>
          <p>Scan the QR displayed by your principal. Your attendance is recorded immediately after a valid scan.</p>
        </div>
        {summary?.today?.marked && (
          <div className="attendance-marked-chip">
            <CheckCircle2 size={16} />
            Marked {formatTime(summary.today.markedAt)}
          </div>
        )}
      </div>

      {error && <div className="attendance-scanner-error">{error}</div>}

      {status && (
        <div className={`attendance-scan-result ${status.type}`}>
          <CheckCircle2 size={20} />
          <div>
            <strong>{status.message}</strong>
            {status.markedAt && <span>Recorded at {formatTime(status.markedAt)}</span>}
          </div>
        </div>
      )}

      <div className="attendance-grid">
        <section className="scanner-card student-scanner-card">
          <div className="scanner-frame">
            {scannerOpen ? (
              <div className="camera-preview">
                <video ref={videoRef} playsInline muted />
                <div className="camera-guide" />
              </div>
            ) : (
              <>
                <QrCode size={88} />
                <span>READY TO SCAN</span>
              </>
            )}
          </div>

          {scannerOpen ? (
            <button className="secondary primary-big-secondary" onClick={stopCamera}>
              <X size={16} />
              Close scanner
            </button>
          ) : (
            <button className="primary big" onClick={openCamera} disabled={loading}>
              <Camera size={17} />
              Open camera & scan
            </button>
          )}

          {!scannerSupported && (
            <p className="scanner-help">
              QR camera scanning is not available in this browser. Paste the QR link below instead.
            </p>
          )}

          <div className="manual-attendance">
            <div className="manual-attendance-label">
              <ClipboardPaste size={14} />
              <span>Use QR link manually</span>
            </div>
            <div className="manual-attendance-row">
              <input
                value={manualValue}
                onChange={event => setManualValue(event.target.value)}
                placeholder="Paste attendance QR link or token"
                onKeyDown={event => {
                  if (event.key === 'Enter') mark(manualValue)
                }}
              />
              <button className="secondary" onClick={() => mark(manualValue)} disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={15} /> : 'Submit'}
              </button>
            </div>
          </div>

          <p className="scanner-help">
            The QR is valid only for today’s active attendance session and only for student accounts.
          </p>
        </section>

        <div className="student-attendance-side">
          <div className="attendance-summary-card">
            <div className="attendance-summary-icon"><ShieldCheck size={19} /></div>
            <span>YOUR ATTENDANCE</span>
            <strong>{summary?.percentage ?? 0}%</strong>
            <p>{summary?.present ?? 0} present · {summary?.absent ?? 0} absent · {summary?.totalSessions ?? 0} sessions</p>
            <div className="progress">
              <i style={{ width: `${Math.min(summary?.percentage ?? 0, 100)}%` }} />
            </div>
          </div>

          <div className="attendance-today-card">
            <div>
              <span>TODAY</span>
              <strong>
                {summary?.today?.marked
                  ? 'Attendance marked'
                  : summary?.today?.active
                    ? 'Waiting for your scan'
                    : 'QR not active yet'}
              </strong>
            </div>
            <RotateCcw size={17} />
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="scanner-canvas" />
    </section>
  )
}

import crypto from 'crypto'
import AttendanceRecord from '../models/AttendanceRecord.js'
import AttendanceSession from '../models/AttendanceSession.js'

const INDIA_TIME_ZONE = 'Asia/Kolkata'

const getIndiaDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const hashToken = token =>
  crypto.createHash('sha256').update(token).digest('hex')

const requireRole = (req, role) => req.user?.role === role

export const getTodayAttendanceSession = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can manage attendance sessions' })
    }

    const session = await AttendanceSession.findOne({
      date: getIndiaDate(),
      active: true,
    }).select('+accessToken')

    if (!session) {
      return res.status(404).json({ success: false, message: "Today's attendance QR has not been created yet" })
    }

    return res.json({
      success: true,
      session: {
        id: session._id.toString(),
        date: session.date,
        accessToken: session.accessToken,
        createdAt: session.createdAt,
        active: session.active,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const createTodayAttendanceSession = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can create attendance QR codes' })
    }

    const date = getIndiaDate()
    const existing = await AttendanceSession.findOne({ date, active: true }).select('+accessToken')

    if (existing) {
      return res.json({
        success: true,
        message: "Today's attendance QR already exists",
        session: {
          id: existing._id.toString(),
          date: existing.date,
          accessToken: existing.accessToken,
          createdAt: existing.createdAt,
          active: existing.active,
        },
      })
    }

    const accessToken = crypto.randomBytes(32).toString('hex')
    const session = await AttendanceSession.create({
      date,
      accessToken,
      tokenHash: hashToken(accessToken),
      createdBy: req.user._id,
      active: true,
    })

    return res.status(201).json({
      success: true,
      message: "Today's attendance QR created",
      session: {
        id: session._id.toString(),
        date: session.date,
        accessToken,
        createdAt: session.createdAt,
        active: session.active,
      },
    })
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await AttendanceSession.findOne({ date: getIndiaDate(), active: true }).select('+accessToken')
      if (existing) {
        return res.json({
          success: true,
          message: "Today's attendance QR already exists",
          session: {
            id: existing._id.toString(),
            date: existing.date,
            accessToken: existing.accessToken,
            createdAt: existing.createdAt,
            active: existing.active,
          },
        })
      }
    }
    next(error)
  }
}

export const markStudentAttendance = async (req, res, next) => {
  try {
    if (!requireRole(req, 'student')) {
      return res.status(403).json({ success: false, message: 'Only student accounts can mark student attendance' })
    }

    const accessToken = String(req.body.accessToken || '').trim()
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Attendance QR token is required' })
    }

    const session = await AttendanceSession.findOne({
      date: getIndiaDate(),
      active: true,
      tokenHash: hashToken(accessToken),
    })

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "This attendance QR is invalid or today's attendance is not active",
      })
    }

    const existing = await AttendanceRecord.findOne({
      session: session._id,
      student: req.user._id,
    })

    if (existing) {
      return res.json({
        success: true,
        alreadyMarked: true,
        message: 'Your attendance has already been marked for today',
        attendance: {
          id: existing._id.toString(),
          markedAt: existing.markedAt,
          status: existing.status,
        },
      })
    }

    const record = await AttendanceRecord.create({
      session: session._id,
      student: req.user._id,
      status: 'present',
    })

    return res.status(201).json({
      success: true,
      alreadyMarked: false,
      message: 'Attendance marked successfully',
      attendance: {
        id: record._id.toString(),
        markedAt: record.markedAt,
        status: record.status,
      },
    })
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await AttendanceRecord.findOne({
        session: await AttendanceSession.findOne({ date: getIndiaDate(), active: true }).then(s => s?._id),
        student: req.user._id,
      })
      return res.json({
        success: true,
        alreadyMarked: true,
        message: 'Your attendance has already been marked for today',
        attendance: existing ? {
          id: existing._id.toString(),
          markedAt: existing.markedAt,
          status: existing.status,
        } : null,
      })
    }
    next(error)
  }
}

export const getTodayAttendanceSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can view attendance' })
    }

    const session = await AttendanceSession.findOne({ date: getIndiaDate(), active: true })
    const present = session
      ? await AttendanceRecord.countDocuments({ session: session._id, status: 'present' })
      : 0

    return res.json({
      success: true,
      date: getIndiaDate(),
      active: Boolean(session),
      present,
      sessionId: session?._id?.toString() || null,
    })
  } catch (error) {
    next(error)
  }
}


export const getStudentAttendanceSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, 'student')) {
      return res.status(403).json({ success: false, message: 'Only student accounts can view student attendance' })
    }

    const totalSessions = await AttendanceSession.countDocuments({ active: true })
    const present = await AttendanceRecord.countDocuments({
      student: req.user._id,
      status: 'present',
    })
    const todaySession = await AttendanceSession.findOne({
      date: getIndiaDate(),
      active: true,
    })

    const todayRecord = todaySession
      ? await AttendanceRecord.findOne({
          session: todaySession._id,
          student: req.user._id,
        })
      : null

    const percentage = totalSessions > 0
      ? Math.round((present / totalSessions) * 100)
      : 0

    return res.json({
      success: true,
      date: getIndiaDate(),
      totalSessions,
      present,
      absent: Math.max(totalSessions - present, 0),
      percentage,
      today: {
        active: Boolean(todaySession),
        marked: Boolean(todayRecord),
        markedAt: todayRecord?.markedAt || null,
        status: todayRecord?.status || null,
      },
    })
  } catch (error) {
    next(error)
  }
}

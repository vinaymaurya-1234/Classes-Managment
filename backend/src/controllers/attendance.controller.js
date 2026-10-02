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


const isValidDateString = value => /^\d{4}-\d{2}-\d{2}$/.test(value)

const getDateOffset = (dateString, days) => {
  const date = new Date(dateString + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const getPrincipalAttendanceDashboard = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can view attendance details' })
    }

    const date = String(req.query.date || getIndiaDate())
    if (!isValidDateString(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD.' })
    }

    const [students, session] = await Promise.all([
      User.find({ role: 'student' }).select('name email phone avatarUrl').sort({ name: 1 }).lean(),
      AttendanceSession.findOne({ date, active: true }),
    ])

    const records = session
      ? await AttendanceRecord.find({ session: session._id, status: 'present' })
          .populate('student', 'name email phone avatarUrl')
          .sort({ markedAt: 1 }).lean()
      : []

    const presentIds = new Set(records.map(record => String(record.student?._id)))
    const presentStudents = records.filter(record => record.student).map(record => ({
      id: record.student._id.toString(),
      name: record.student.name,
      email: record.student.email,
      phone: record.student.phone || '',
      avatarUrl: record.student.avatarUrl || '',
      markedAt: record.markedAt,
      status: record.status,
    }))

    const absentStudents = students.filter(student => !presentIds.has(String(student._id))).map(student => ({
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      avatarUrl: student.avatarUrl || '',
    }))

    return res.json({
      success: true, date,
      session: session ? { id: session._id.toString(), date: session.date, createdAt: session.createdAt, active: session.active } : null,
      totalStudents: students.length,
      presentCount: presentStudents.length,
      absentCount: absentStudents.length,
      attendancePercentage: students.length ? Math.round((presentStudents.length / students.length) * 100) : 0,
      presentStudents,
      absentStudents,
    })
  } catch (error) {
    next(error)
  }
}

export const getPrincipalAttendanceHistory = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can view attendance history' })
    }

    const today = getIndiaDate()
    const from = String(req.query.from || getDateOffset(today, -29))
    const to = String(req.query.to || today)

    if (!isValidDateString(from) || !isValidDateString(to) || from > to) {
      return res.status(400).json({ success: false, message: 'Invalid date range. Use YYYY-MM-DD.' })
    }

    const [students, sessions] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      AttendanceSession.find({ date: { $gte: from, $lte: to }, active: true }).sort({ date: -1 }).lean(),
    ])

    const records = sessions.length
      ? await AttendanceRecord.find({ session: { $in: sessions.map(session => session._id) }, status: 'present' })
          .select('session student markedAt').lean()
      : []

    const presentBySession = new Map()
    records.forEach(record => {
      const key = String(record.session)
      presentBySession.set(key, (presentBySession.get(key) || 0) + 1)
    })

    const sessionByDate = new Map(sessions.map(session => [session.date, session]))
    const days = []
    for (let current = to; current >= from; current = getDateOffset(current, -1)) {
      const session = sessionByDate.get(current)
      const present = session ? (presentBySession.get(String(session._id)) || 0) : 0
      days.push({
        date: current,
        hasSession: Boolean(session),
        present,
        absent: session ? Math.max(students - present, 0) : 0,
        totalStudents: students,
        percentage: session && students ? Math.round((present / students) * 100) : 0,
      })
    }

    return res.json({ success: true, from, to, totalStudents: students, days })
  } catch (error) {
    next(error)
  }
}

export const getPrincipalStudentAttendance = async (req, res, next) => {
  try {
    if (!requireRole(req, 'principal')) {
      return res.status(403).json({ success: false, message: 'Only the principal can view student attendance' })
    }

    const student = await User.findOne({ _id: req.params.studentId, role: 'student' })
      .select('name email phone avatarUrl').lean()

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' })

    const today = getIndiaDate()
    const from = String(req.query.from || getDateOffset(today, -29))
    const to = String(req.query.to || today)

    if (!isValidDateString(from) || !isValidDateString(to) || from > to) {
      return res.status(400).json({ success: false, message: 'Invalid date range. Use YYYY-MM-DD.' })
    }

    const sessions = await AttendanceSession.find({ date: { $gte: from, $lte: to }, active: true })
      .sort({ date: -1 }).lean()

    const records = sessions.length
      ? await AttendanceRecord.find({
          session: { $in: sessions.map(session => session._id) },
          student: student._id,
          status: 'present',
        }).select('session markedAt status').lean()
      : []

    const recordBySession = new Map(records.map(record => [String(record.session), record]))
    const days = sessions.map(session => ({
      date: session.date,
      present: Boolean(recordBySession.get(String(session._id))),
      markedAt: recordBySession.get(String(session._id))?.markedAt || null,
    }))
    const present = days.filter(day => day.present).length

    return res.json({
      success: true,
      student: {
        id: student._id.toString(), name: student.name, email: student.email,
        phone: student.phone || '', avatarUrl: student.avatarUrl || '',
      },
      from, to, totalSessions: sessions.length, present,
      absent: Math.max(sessions.length - present, 0),
      percentage: sessions.length ? Math.round((present / sessions.length) * 100) : 0,
      days,
    })
  } catch (error) {
    next(error)
  }
}

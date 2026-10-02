import TimetableEntry from '../models/TimetableEntry.js'
import User from '../models/User.js'

const requirePrincipal = req => req.user?.role === 'principal'
const isValidDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isValidTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const publicEntry = entry => ({
  id: entry._id.toString(),
  date: entry.date,
  startTime: entry.startTime,
  endTime: entry.endTime,
  subject: entry.subject,
  className: entry.className,
  room: entry.room || '',
  notes: entry.notes || '',
  teacher: entry.teacher ? {
    id: entry.teacher._id.toString(),
    name: entry.teacher.name,
    email: entry.teacher.email,
    avatarUrl: entry.teacher.avatarUrl || '',
  } : null,
})

export const listTimetable = async (req, res, next) => {
  try {
    const date = String(req.query.date || '')
    if (!isValidDate(date)) return res.status(400).json({ success: false, message: 'A valid date is required.' })

    const entries = await TimetableEntry.find({ date })
      .populate('teacher', 'name email avatarUrl')
      .sort({ startTime: 1, endTime: 1 })

    return res.json({ success: true, date, entries: entries.map(publicEntry) })
  } catch (error) { next(error) }
}

export const listTimetableRange = async (req, res, next) => {
  try {
    const from = String(req.query.from || '')
    const to = String(req.query.to || '')
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return res.status(400).json({ success: false, message: 'Valid from and to dates are required.' })
    }

    const entries = await TimetableEntry.find({ date: { $gte: from, $lte: to } })
      .populate('teacher', 'name email avatarUrl')
      .sort({ date: 1, startTime: 1 })

    return res.json({ success: true, from, to, entries: entries.map(publicEntry) })
  } catch (error) { next(error) }
}

export const createTimetableEntry = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can manage the timetable.' })

    const date = String(req.body.date || '').trim()
    const startTime = String(req.body.startTime || '').trim()
    const endTime = String(req.body.endTime || '').trim()
    const subject = String(req.body.subject || '').trim()
    const className = String(req.body.className || '').trim()
    const room = String(req.body.room || '').trim()
    const notes = String(req.body.notes || '').trim()
    const teacherId = String(req.body.teacherId || '').trim()

    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime) || !subject || !className) {
      return res.status(400).json({ success: false, message: 'Date, time, subject and class are required.' })
    }
    if (startTime >= endTime) return res.status(400).json({ success: false, message: 'End time must be after start time.' })

    let teacher = null
    if (teacherId) {
      teacher = await User.findOne({ _id: teacherId, role: 'teacher' })
      if (!teacher) return res.status(400).json({ success: false, message: 'Selected teacher was not found.' })
    }

    const entry = await TimetableEntry.create({ date, startTime, endTime, subject, className, room, notes, teacher: teacher?._id || null, createdBy: req.user._id })
    await entry.populate('teacher', 'name email avatarUrl')

    return res.status(201).json({ success: true, message: 'Lecture added to the timetable.', entry: publicEntry(entry) })
  } catch (error) { next(error) }
}

export const updateTimetableEntry = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can manage the timetable.' })

    const entry = await TimetableEntry.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Lecture not found.' })

    const fields = ['date', 'startTime', 'endTime', 'subject', 'className', 'room', 'notes']
    for (const field of fields) if (req.body[field] !== undefined) entry[field] = String(req.body[field]).trim()

    if (!isValidDate(entry.date) || !isValidTime(entry.startTime) || !isValidTime(entry.endTime) || !entry.subject || !entry.className) {
      return res.status(400).json({ success: false, message: 'Date, time, subject and class are required.' })
    }
    if (entry.startTime >= entry.endTime) return res.status(400).json({ success: false, message: 'End time must be after start time.' })

    if (req.body.teacherId !== undefined) {
      const teacherId = String(req.body.teacherId || '').trim()
      entry.teacher = teacherId ? (await User.findOne({ _id: teacherId, role: 'teacher' }))?._id || null : null
      if (teacherId && !entry.teacher) return res.status(400).json({ success: false, message: 'Selected teacher was not found.' })
    }

    await entry.save()
    await entry.populate('teacher', 'name email avatarUrl')
    return res.json({ success: true, message: 'Lecture updated.', entry: publicEntry(entry) })
  } catch (error) { next(error) }
}

export const deleteTimetableEntry = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can manage the timetable.' })
    const entry = await TimetableEntry.findByIdAndDelete(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Lecture not found.' })
    return res.json({ success: true, message: 'Lecture removed from the timetable.' })
  } catch (error) { next(error) }
}

export const listTimetableTeachers = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can view timetable teachers.' })
    const teachers = await User.find({ role: 'teacher' }).select('name email avatarUrl').sort({ name: 1 }).lean()
    return res.json({ success: true, teachers: teachers.map(t => ({ id: t._id.toString(), name: t.name, email: t.email, avatarUrl: t.avatarUrl || '' })) })
  } catch (error) { next(error) }
}

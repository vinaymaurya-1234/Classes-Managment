import { Router } from 'express'
import Chapter from '../models/Chapter.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const divisions = ['A', 'B', 'C']
const getStd = value => {
  const match = String(value ?? '').match(/\d+/)
  const std = match ? Number(match[0]) : NaN
  return [10, 11, 12].includes(std) ? std : null
}
const getDivision = value => {
  const match = String(value ?? '').match(/(?:-|\s)([ABC])$/i)
  return match ? match[1].toUpperCase() : null
}
const label = (std, division) => `Class ${std} - ${division}`

router.get('/classes', async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') return res.status(403).json({ success: false, message: 'Only teachers can access teaching classes.' })
    const chapters = await Chapter.find({ teacher: req.user._id }).select('className subject').lean()
    const configured = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const assignments = new Map()
    for (const value of [...configured, ...chapters.map(item => item.className)]) {
      const std = getStd(value)
      if (!std) continue
      const division = getDivision(value)
      const targetDivisions = division ? [division] : ['A', 'B', 'C']
      for (const div of targetDivisions) {
        const key = label(std, div)
        if (!assignments.has(key)) assignments.set(key, { std, division: div, className: key, subjects: [] })
        const found = chapters.filter(item => getStd(item.className) === std && (!getDivision(item.className) || getDivision(item.className) === div)).map(item => item.subject).filter(Boolean)
        assignments.get(key).subjects.push(...found)
      }
    }
    const requested = String(req.query.className || '').trim()
    const chosen = [...assignments.values()].filter(item => !requested || item.className === requested || item.std === Number(req.query.std))
    const classes = await Promise.all(chosen.map(async item => {
      item.subjects = [...new Set(item.subjects)].sort()
      const students = await User.find({ role: 'student', std: item.std, division: item.division }).select('name email phone avatarUrl std division className').sort({ name: 1 }).lean()
      return { ...item, studentCount: students.length, students: students.map(student => ({ id: student._id.toString(), name: student.name, email: student.email, phone: student.phone || '', avatarUrl: student.avatarUrl || '', std: student.std, division: student.division, className: student.className })) }
    }))
    res.json({ success: true, classes })
  } catch (error) { next(error) }
})

export default router

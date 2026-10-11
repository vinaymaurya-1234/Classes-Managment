import { Router } from 'express'
import Chapter from '../models/Chapter.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const parseClass = value => {
  const text = String(value ?? '').trim()
  const match = text.match(/(?:class\s*)?(10|11|12)(?:\s*[-/]\s*([a-z]))?/i)
  return match ? { std: Number(match[1]), division: (match[2] || '').toUpperCase() } : null
}

router.get('/classes', async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') return res.status(403).json({ success: false, message: 'Only teachers can access teaching classes.' })
    const chapters = await Chapter.find({ teacher: req.user._id }).select('className subject').lean()
    const configuredClasses = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const classMap = new Map()
    const classSources = configuredClasses.length ? configuredClasses : chapters.map(item => item.className)
    for (const value of classSources) {
      const parsed = parseClass(value)
      if (!parsed) continue
      const key = `${parsed.std}-${parsed.division}`
      if (!classMap.has(key)) classMap.set(key, { ...parsed, className: `Class ${parsed.std}`, division: parsed.division, subjects: [] })
    }
    const classes = await Promise.all([...classMap.values()].map(async item => {
      const studentFilter = { role: 'student', std: item.std }
      if (item.division) studentFilter.division = item.division
      const students = await User.find(studentFilter).select('name email phone avatarUrl std division').sort({ name: 1 }).lean()
      const subjects = [...new Set(chapters.filter(ch => {
        const parsed = parseClass(ch.className)
        return parsed && parsed.std === item.std && (!parsed.division || parsed.division === item.division)
      }).map(ch => ch.subject).filter(Boolean))].sort()
      return {
        std: item.std, className: item.className, division: item.division,
        label: item.division ? `Class ${item.std} - ${item.division}` : item.className,
        subjects, studentCount: students.length,
        students: students.map(student => ({
          id: student._id.toString(), name: student.name, email: student.email,
          phone: student.phone || '', avatarUrl: student.avatarUrl || '', std: student.std,
          division: student.division || '',
        })),
      }
    }))
    const requested = String(req.query.className || '').trim()
    res.json({ success: true, classes: requested ? classes.filter(item => item.label === requested || item.className === requested) : classes })
  } catch (error) { next(error) }
})

export default router

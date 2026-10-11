import { Router } from 'express'
import Chapter from '../models/Chapter.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

// Class labels may come from older chapter records (for example "11-A" or
// "Class 11"). Student membership itself is determined only by User.std.
const getStd = value => {
  const match = String(value ?? '').match(/\d+/)
  const std = match ? Number(match[0]) : NaN
  return [10, 11, 12].includes(std) ? std : null
}

router.get('/classes', async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can access teaching classes.' })
    }

    const chapters = await Chapter.find({ teacher: req.user._id }).select('className subject').lean()
    const configuredClasses = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const assignedStds = [...new Set(
      [...configuredClasses, ...chapters.map(item => item.className)]
        .map(getStd)
        .filter(Boolean)
    )].sort((a, b) => a - b)

    const requestedStd = req.query.std ? getStd(req.query.std) : null
    const selectedStds = requestedStd
      ? assignedStds.filter(std => std === requestedStd)
      : assignedStds

    const classes = await Promise.all(selectedStds.map(async std => {
      const students = await User.find({ role: 'student', std })
        .select('name email phone avatarUrl std')
        .sort({ name: 1 })
        .lean()

      const subjects = [...new Set(
        chapters
          .filter(item => getStd(item.className) === std)
          .map(item => item.subject)
          .filter(Boolean)
      )].sort()

      return {
        std,
        className: `Class ${std}`,
        subjects,
        studentCount: students.length,
        students: students.map(student => ({
          id: student._id.toString(),
          name: student.name,
          email: student.email,
          phone: student.phone || '',
          avatarUrl: student.avatarUrl || '',
          std: student.std,
        })),
      }
    }))

    res.json({ success: true, classes })
  } catch (error) {
    next(error)
  }
})

export default router

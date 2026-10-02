import { Router } from 'express'
import Chapter from '../models/Chapter.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/classes', async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can access teaching classes.' })
    }

    const chapters = await Chapter.find({ teacher: req.user._id }).select('className subject').lean()
    const configuredClasses = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const classNames = [...new Set([...configuredClasses, ...chapters.map(item => item.className)].filter(Boolean))].sort()

    const requestedClass = String(req.query.className || '').trim()
    const selectedClasses = requestedClass ? classNames.filter(name => name === requestedClass) : classNames

    const classes = await Promise.all(selectedClasses.map(async className => {
      const students = await User.find({ role: 'student', className })
        .select('name email phone avatarUrl className')
        .sort({ name: 1 })
        .lean()

      const subjects = [...new Set(
        chapters.filter(item => item.className === className).map(item => item.subject).filter(Boolean)
      )].sort()

      return {
        className,
        subjects,
        studentCount: students.length,
        students: students.map(student => ({
          id: student._id.toString(),
          name: student.name,
          email: student.email,
          phone: student.phone || '',
          avatarUrl: student.avatarUrl || '',
          className: student.className,
        })),
      }
    }))

    res.json({ success: true, classes })
  } catch (error) {
    next(error)
  }
})

export default router

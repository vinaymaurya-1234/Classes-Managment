import { Router } from 'express'
import Homework from '../models/Homework.js'
import User from '../models/User.js'
import Chapter from '../models/Chapter.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)
const role = (req, res, allowed) => allowed.includes(req.user?.role) || res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' })

// Teacher assignments are stored as section labels such as "11-A", while
// homework's class selector sends labels such as "Class 11". Compare the
// standard number so both supported formats resolve to the same class.
const getStd = value => {
  const match = String(value ?? '').match(/\d+/)
  const std = match ? Number(match[0]) : NaN
  return [10, 11, 12].includes(std) ? std : null
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user
    if (user.role === 'teacher') {
      const data = await Homework.find({ teacher: user._id }).sort({ createdAt: -1 }).populate('submissions.student', 'name className').lean()
      return res.json({ success: true, data })
    }
    if (user.role === 'student') {
      const data = user.className ? await Homework.find({ className: user.className, status: 'published' }).sort({ dueDate: 1, createdAt: -1 }).lean() : []
      return res.json({ success: true, data })
    }
    if (user.role === 'parent') {
      const parent = await User.findById(user._id).populate('children', 'className').lean()
      const classes = [...new Set((parent?.children || []).map(child => child.className).filter(Boolean))]
      const data = classes.length ? await Homework.find({ className: { $in: classes }, status: 'published' }).sort({ dueDate: 1, createdAt: -1 }).lean() : []
      return res.json({ success: true, data, message: classes.length ? '' : 'No students are linked to this parent account yet. Ask the principal to link the child account.' })
    }
    return res.json({ success: true, data: await Homework.find({}).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    if (!role(req, res, ['teacher'])) return
    const className = String(req.body.className || '').trim()
    const subject = String(req.body.subject || '').trim()
    const title = String(req.body.title || '').trim()
    if (!className || !subject || !title) return res.status(400).json({ success: false, message: 'Class, subject and title are required.' })

    const requestedStd = getStd(className)
    if (!requestedStd) return res.status(400).json({ success: false, message: 'Choose a valid class.' })

    const assignedClasses = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const teachesClass = assignedClasses.some(assigned => getStd(assigned) === requestedStd)
    const hasChapterForClass = teachesClass
      ? false
      : Boolean(await Chapter.exists({
          teacher: req.user._id,
          className: { $in: [className, `Class ${requestedStd}`, String(requestedStd), `11-${requestedStd}`] },
        }))

    if (!teachesClass && !hasChapterForClass) {
      return res.status(403).json({ success: false, message: 'You can only assign homework to a class assigned to you.' })
    }

    const item = await Homework.create({ teacher: req.user._id, className, subject, title, instructions: String(req.body.instructions || '').trim(), dueDate: req.body.dueDate || null, status: req.body.status === 'draft' ? 'draft' : 'published' })
    res.status(201).json({ success: true, data: item })
  } catch (error) { next(error) }
})

router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!role(req, res, ['student'])) return
    const item = await Homework.findOne({ _id: req.params.id, className: req.user.className, status: 'published' })
    if (!item) return res.status(404).json({ success: false, message: 'Homework not found for your class.' })
    const text = String(req.body.text || '').trim()
    if (!text) return res.status(400).json({ success: false, message: 'Write a submission before sending.' })
    const existing = item.submissions.find(entry => String(entry.student) === String(req.user._id))
    if (existing) { existing.text = text; existing.submittedAt = new Date() }
    else item.submissions.push({ student: req.user._id, text, submittedAt: new Date() })
    await item.save()
    res.json({ success: true, message: 'Homework submitted.', data: item })
  } catch (error) { next(error) }
})

export default router

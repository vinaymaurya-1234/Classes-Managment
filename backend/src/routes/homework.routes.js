import { Router } from 'express'
import Homework from '../models/Homework.js'
import User from '../models/User.js'
import Chapter from '../models/Chapter.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)
const role = (req, res, allowed) => {
  if (!allowed.includes(req.user?.role)) {
    res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' })
    return false
  }
  return true
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user
    if (user.role === 'teacher') {
      const data = await Homework.find({ teacher: user._id }).sort({ createdAt: -1 }).populate('submissions.student', 'name className std division').lean()
      return res.json({ success: true, data })
    }
    if (user.role === 'student') {
      const className = user.className || (user.std ? `Class ${user.std}` : '')
      const filter = { className, status: 'published' }
      filter.division = user.division || ''
      const data = className ? await Homework.find(filter).sort({ dueDate: 1, createdAt: -1 }).lean() : []
      return res.json({ success: true, data })
    }
    if (user.role === 'parent') {
      const parent = await User.findById(user._id).populate('children', 'className std division').lean()
      const filters = (parent?.children || []).map(child => ({
        className: child.className || (child.std ? `Class ${child.std}` : ''),
        division: child.division || '',
        status: 'published',
      })).filter(item => item.className)
      const data = filters.length ? await Homework.find({ $or: filters }).sort({ dueDate: 1, createdAt: -1 }).lean() : []
      return res.json({ success: true, data, message: filters.length ? '' : 'No students are linked to this parent account yet. Ask the principal to link the child account.' })
    }
    return res.json({ success: true, data: await Homework.find({}).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    if (!role(req, res, ['teacher'])) return
    const className = String(req.body.className || '').trim()
    const division = String(req.body.division || '').trim().toUpperCase()
    const subject = String(req.body.subject || '').trim()
    const title = String(req.body.title || '').trim()
    if (!className || !subject || !title) return res.status(400).json({ success: false, message: 'Class, subject and title are required.' })
    const teacherClasses = Array.isArray(req.user.teachingClasses) ? req.user.teachingClasses : []
    const taught = teacherClasses.some(value => value === className || value.startsWith(className + ' - ')) || await Chapter.exists({ teacher: req.user._id, className: { $in: [className, ...teacherClasses] } })
    if (!taught) return res.status(403).json({ success: false, message: 'You can only assign homework to a class assigned to you.' })
    const item = await Homework.create({ teacher: req.user._id, className, division, subject, title, instructions: String(req.body.instructions || '').trim(), dueDate: req.body.dueDate || null, status: req.body.status === 'draft' ? 'draft' : 'published' })
    res.status(201).json({ success: true, data: item })
  } catch (error) { next(error) }
})

router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!role(req, res, ['student'])) return
    const className = req.user.className || (req.user.std ? `Class ${req.user.std}` : '')
    const item = await Homework.findOne({ _id: req.params.id, className, division: req.user.division || '', status: 'published' })
    if (!item) return res.status(404).json({ success: false, message: 'Homework not found for your class and division.' })
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

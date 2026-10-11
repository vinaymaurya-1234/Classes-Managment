import { Router } from 'express'
import Assessment from '../models/Assessment.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)
const forbidden = (res) => res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' })

router.get('/', async (req, res, next) => {
  try {
    const user = req.user
    if (user.role === 'teacher') {
      const data = await Assessment.find({ teacher: user._id }).sort({ createdAt: -1 }).populate('marks.student', 'name className').lean()
      return res.json({ success: true, data })
    }
    if (user.role === 'principal') {
      const data = await Assessment.find({}).sort({ status: 1, createdAt: -1 }).populate('teacher', 'name').populate('marks.student', 'name className').lean()
      return res.json({ success: true, data })
    }
    if (user.role === 'student') {
      const data = user.className ? await Assessment.find({ className: user.className, status: 'published' }).sort({ publishedAt: -1 }).populate('marks.student', 'name').lean() : []
      return res.json({ success: true, data: data.map(test => ({ ...test, marks: test.marks.filter(mark => String(mark.student?._id || mark.student) === String(user._id)) })) })
    }
    if (user.role === 'parent') {
      const parent = await User.findById(user._id).populate('children', 'className').lean()
      const children = parent?.children || []
      const childIds = new Set(children.map(child => String(child._id)))
      const classes = [...new Set(children.map(child => child.className).filter(Boolean))]
      const tests = classes.length ? await Assessment.find({ className: { $in: classes }, status: 'published' }).sort({ publishedAt: -1 }).populate('marks.student', 'name className').lean() : []
      const data = tests.map(test => ({ ...test, marks: test.marks.filter(mark => childIds.has(String(mark.student?._id || mark.student))) }))
      return res.json({ success: true, data, message: classes.length ? '' : 'No students are linked to this parent account yet. Ask the principal to link the child account.' })
    }
    return res.json({ success: true, data: [] })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') return forbidden(res)
    const className = String(req.body.className || '').trim(), subject = String(req.body.subject || '').trim(), title = String(req.body.title || '').trim()
    const maxMarks = Number(req.body.maxMarks)
    if (!className || !subject || !title || !Number.isFinite(maxMarks) || maxMarks < 1) return res.status(400).json({ success: false, message: 'Class, subject, test title and valid maximum marks are required.' })
    const students = await User.find({ role: 'student', className }).select('_id').lean()
    const item = await Assessment.create({ teacher: req.user._id, className, subject, title, examDate: req.body.examDate || null, maxMarks, marks: students.map(student => ({ student: student._id, marks: 0, entered: false })), status: 'draft' })
    const data = await Assessment.findById(item._id).populate('marks.student', 'name className')
    res.status(201).json({ success: true, data })
  } catch (error) { next(error) }
})

router.put('/:id/marks', async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') return forbidden(res)
    const item = await Assessment.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!item) return res.status(404).json({ success: false, message: 'Test not found.' })
    if (item.status === 'published') return res.status(409).json({ success: false, message: 'Published marks are locked. Ask the principal to return the test for correction.' })
    if (!Array.isArray(req.body.marks)) return res.status(400).json({ success: false, message: 'Marks must be an array.' })
    const allowed = new Set((await User.find({ role: 'student', className: item.className }).select('_id').lean()).map(s => String(s._id)))
    const nextMarks = []
    for (const entry of req.body.marks) {
      const studentId = String(entry.student || ''), marks = Number(entry.marks)
      if (!allowed.has(studentId) || !Number.isFinite(marks) || marks < 0 || marks > item.maxMarks) return res.status(400).json({ success: false, message: 'Each mark must belong to a student in this class and be within the test maximum.' })
      nextMarks.push({ student: studentId, marks, entered: entry.entered === true })
    }
    if (req.body.submitForReview && (nextMarks.length !== allowed.size || nextMarks.some(entry => !entry.entered))) return res.status(400).json({ success: false, message: 'Enter marks for every student before submitting this test for review.' })
    item.marks = nextMarks
    item.status = req.body.submitForReview ? 'review' : 'draft'
    await item.save()
    const data = await Assessment.findById(item._id).populate('marks.student', 'name className')
    res.json({ success: true, data })
  } catch (error) { next(error) }
})

router.put('/:id/review', async (req, res, next) => {
  try {
    if (req.user.role !== 'principal') return forbidden(res)
    const item = await Assessment.findById(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Test not found.' })
    const action = String(req.body.action || '')
    if (action === 'publish') {
      if (item.status !== 'review') return res.status(409).json({ success: false, message: 'Only tests submitted for review can be published.' })
      item.status = 'published'; item.reviewedBy = req.user._id; item.publishedAt = new Date()
    } else if (action === 'return') {
      if (item.status !== 'review') return res.status(409).json({ success: false, message: 'Only tests under review can be returned.' })
      item.status = 'draft'; item.reviewedBy = req.user._id; item.publishedAt = null
    } else return res.status(400).json({ success: false, message: 'Action must be publish or return.' })
    await item.save()
    const data = await Assessment.findById(item._id).populate('teacher', 'name').populate('marks.student', 'name className')
    res.json({ success: true, data })
  } catch (error) { next(error) }
})

export default router

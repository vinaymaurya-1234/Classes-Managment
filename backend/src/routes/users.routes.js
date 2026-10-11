import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { createUser, listUsers } from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listUsers)
router.post('/', createUser)

router.put('/:id/teaching-classes', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can update teacher assignments.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid teacher ID.' })
    const teachingClasses = Array.isArray(req.body.teachingClasses) ? [...new Set(req.body.teachingClasses.map(value => String(value).trim()))] : []
    const valid = teachingClasses.every(value => /^Class (10|11|12) - [ABC]$/.test(value))
    if (!teachingClasses.length || !valid) return res.status(400).json({ success: false, message: 'Select at least one valid class and division.' })
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found.' })
    teacher.teachingClasses = teachingClasses
    await teacher.save()
    res.json({ success: true, user: { id: teacher._id.toString(), name: teacher.name, teachingClasses: teacher.teachingClasses } })
  } catch (error) { next(error) }
})

router.put('/:id/class-placement', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can update class placement.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid student ID.' })
    const std = Number(req.body.std), division = String(req.body.division || '').toUpperCase()
    if (![10, 11, 12].includes(std) || !['A', 'B', 'C'].includes(division)) return res.status(400).json({ success: false, message: 'Choose Class 10, 11 or 12 and division A, B or C.' })
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' })
    student.std = std; student.division = division; student.className = `Class ${std}`
    await student.save()
    res.json({ success: true, user: { id: student._id.toString(), name: student.name, className: student.className, std: student.std, division: student.division } })
  } catch (error) { next(error) }
})

export default router

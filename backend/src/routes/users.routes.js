import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { createUser, listUsers, updateTeacherAssignments } from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listUsers)
router.post('/', createUser)
router.put('/:id/teaching-classes', updateTeacherAssignments)

router.put('/:id/children', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can link students to parents.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid parent ID.' })
    const childIds = Array.isArray(req.body.childIds) ? [...new Set(req.body.childIds.map(id => String(id).trim()).filter(Boolean))] : []
    if (!childIds.length || childIds.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ success: false, message: 'Choose at least one valid student.' })
    const parent = await User.findOne({ _id: req.params.id, role: 'parent' })
    if (!parent) return res.status(404).json({ success: false, message: 'Parent account not found.' })
    const students = await User.find({ _id: { $in: childIds }, role: 'student' }).select('_id')
    if (students.length !== childIds.length) return res.status(400).json({ success: false, message: 'Only existing student accounts can be linked.' })
    const existing = new Set(parent.children.map(id => id.toString()))
    childIds.forEach(id => existing.add(id))
    parent.children = [...existing]
    await parent.save()
    await parent.populate('children', 'name email std division className')
    res.json({ success: true, message: 'Students linked to parent successfully.', children: parent.children.map(student => ({ id: student._id.toString(), name: student.name, email: student.email, std: student.std ?? null, division: student.division || '', className: student.className || '' })) })
  } catch (error) { next(error) }
})

router.put('/:id/class-placement', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can update class placement.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid student ID.' })
    const std = Number(req.body.std), division = String(req.body.division || 'A').trim().toUpperCase()
    if (![10, 11, 12].includes(std) || (division && !['A', 'B', 'C'].includes(division))) return res.status(400).json({ success: false, message: 'Choose Class 10, 11 or 12 and optionally division A, B or C.' })
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' })
    student.std = std; student.division = division || 'A'; student.className = `Class ${std}`
    await student.save()
    res.json({ success: true, user: { id: student._id.toString(), name: student.name, className: student.className, std: student.std, division: student.division || 'A' } })
  } catch (error) { next(error) }
})

export default router

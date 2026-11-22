import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import ClassDivision from '../models/ClassDivision.js'
import { createUser, listUsers, updateTeacherAssignments } from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listUsers)
router.post('/', createUser)
router.get('/parent-lookup', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can look up parent accounts.' })
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ success: false, message: 'Enter a parent Gmail address.' })
    const parent = await User.findOne({ email, role: 'parent' }).select('name email')
    return res.json({ success: true, parent: parent ? { id: parent._id.toString(), name: parent.name, email: parent.email } : null })
  } catch (error) { next(error) }
})
router.put('/:id/teaching-classes', updateTeacherAssignments)

router.put('/:id/class-placement', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can update class placement.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid student ID.' })
    const classDivisionId = String(req.body.classDivisionId || '')
    if (!mongoose.isValidObjectId(classDivisionId)) return res.status(400).json({ success: false, message: 'Select a valid class division.' })
    const division = await ClassDivision.findOne({ _id: classDivisionId, active: true })
    if (!division) return res.status(400).json({ success: false, message: 'This class division is not active in Class Structure.' })
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' })
    student.std = division.standard
    student.division = division.division
    student.className = division.displayName
    student.classDivision = division._id
    await student.save()
    res.json({ success: true, user: { id: student._id.toString(), name: student.name, className: student.className, std: student.std, division: student.division, classDivisionId: student.classDivision.toString() } })
  } catch (error) { next(error) }
})

export default router

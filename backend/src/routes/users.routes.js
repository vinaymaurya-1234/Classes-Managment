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
router.put('/:id/profile', async (req, res, next) => {
  try {
    if (req.user?.role !== 'principal') return res.status(403).json({ success: false, message: 'Only the principal can edit profiles.' })
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user ID.' })
    const user = await User.findOne({ _id: req.params.id, role: { $in: ['student', 'parent'] } })
    if (!user) return res.status(404).json({ success: false, message: 'Student or parent not found.' })
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const phone = String(req.body.phone || '').trim()
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required.' })
    const duplicate = await User.findOne({ email, _id: { $ne: user._id } }).select('_id')
    if (duplicate) return res.status(409).json({ success: false, message: 'This email is already used by another account.' })
    user.name = name
    user.email = email
    user.phone = phone
    await user.save()
    const populated = await User.findById(user._id).populate('classDivision').populate({ path: 'children', select: 'name email std division className classDivision', populate: { path: 'classDivision' } })
    res.json({ success: true, user: {
      id: user._id.toString(), name: user.name, email: user.email, phone: user.phone || '', role: user.role,
      className: populated.classDivision?.displayName || user.className || '', std: user.std ?? null, division: user.division || '',
      classDivisionId: user.classDivision?.toString() || '',
      children: (populated.children || []).map(child => ({ id: child._id.toString(), name: child.name, email: child.email, std: child.std ?? null, division: child.division || '', className: child.classDivision?.displayName || child.className || '', classDivisionId: child.classDivision?._id?.toString() || '' }))
    } })
  } catch (error) { if (error?.code === 11000) return res.status(409).json({ success: false, message: 'This email is already used by another account.' }); next(error) }
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

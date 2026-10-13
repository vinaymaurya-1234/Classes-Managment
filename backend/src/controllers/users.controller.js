import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const MANAGED_ROLES = ['teacher', 'student', 'parent']
const normalizeTeachingClass = value => { const match = String(value ?? '').trim().match(/^(?:Class\\s*)?(11|12)\\s*-\\s*([ABC])$/i); return match ? `Class ${match[1]} - ${match[2].toUpperCase()}` : '' }\nconst ALLOWED_TEACHING_CLASSES = new Set([11, 12].flatMap(classNumber => ['A', 'B', 'C'].map(section => `Class ${classNumber} - ${section}`)))
const publicUser = user => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  avatarUrl: user.avatarUrl || '',
  className: user.className || '',
  std: user.std ?? null,
  division: user.division || '',
  teachingClasses: user.teachingClasses || [],
  createdAt: user.createdAt,
})
const requirePrincipal = req => req.user?.role === 'principal'

export const listUsers = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can manage users' })
    const role = String(req.query.role || '').trim().toLowerCase()
    const filter = role ? { role } : { role: { $in: MANAGED_ROLES } }
    if (role && !MANAGED_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Invalid user role' })
    const users = await User.find(filter).sort({ createdAt: -1 })
    return res.json({ success: true, users: users.map(publicUser) })
  } catch (error) { next(error) }
}

export const createUser = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success: false, message: 'Only the principal can create users' })
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const role = String(req.body.role || '').trim().toLowerCase()
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : ''
    const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.trim() : ''
    const std = req.body.std === '' || req.body.std == null ? null : Number(req.body.std)
    const division = String(req.body.division || '').trim().toUpperCase()
    const teachingClasses = Array.isArray(req.body.teachingClasses) ? [...new Set(req.body.teachingClasses.map(normalizeTeachingClass))] : []
    const childIds = Array.isArray(req.body.childIds)
      ? [...new Set(req.body.childIds.map(id => String(id).trim()).filter(Boolean))]
      : []

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and role are required',
      })
    }

    if (!MANAGED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Only teacher, student or parent accounts can be created here',
      })
    }

    if (role === 'student' && (![10, 11, 12].includes(std) || !['A', 'B', 'C'].includes(division))) {
      return res.status(400).json({ success: false, message: 'Choose a valid standard (10, 11 or 12) and division (A, B or C).' })
    }

    if (role === 'teacher' && !teachingClasses.length) {
      return res.status(400).json({ success: false, message: 'Assign the teacher to at least one class and division.' })
    }

    if (role === 'teacher' && teachingClasses.some(value => !ALLOWED_TEACHING_CLASSES.has(value.toUpperCase()))) {
      return res.status(400).json({ success: false, message: 'Select at least one valid Class 11 or 12 section (A, B or C) for the teacher.' })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      })
    }

    if (role !== 'parent' && childIds.length) {
      return res.status(400).json({ success: false, message: 'Only parent accounts can be linked to children.' })
    }

    if (role === 'parent' && childIds.length) {
      const linkedStudents = await User.find({ _id: { $in: childIds }, role: 'student' }).select('_id').lean()
      if (linkedStudents.length !== childIds.length) return res.status(400).json({ success: false, message: 'Choose valid student accounts only.' })
    }
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role,
      phone,
      avatarUrl,
      ...(role === 'student' ? { std, division, className: `Class ${std}` } : {}),
      ...(role === 'teacher' ? { teachingClasses } : {}),
      ...(role === 'parent' ? { children: childIds } : {}),
    })
    return res.status(201).json({ success: true, message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`, user: publicUser(user) })
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'A user with this email already exists' })
    next(error)
  }
}


export const updateTeacherAssignments = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can manage users' })
    }

    const teachingClasses = Array.isArray(req.body.teachingClasses)
      ? [...new Set(req.body.teachingClasses.map(normalizeTeachingClass))]
      : []
    if (!teachingClasses.length || teachingClasses.some(value => !ALLOWED_TEACHING_CLASSES.has(value))) {
      return res.status(400).json({ success: false, message: 'Provide at least one valid Class 11 or 12 division (A, B or C).' })
    }

    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' })
    }

    teacher.teachingClasses = teachingClasses
    await teacher.save()

    return res.json({
      success: true,
      message: 'Teacher assignments updated successfully',
      user: publicUser(teacher),
    })
  } catch (error) {
    next(error)
  }
}

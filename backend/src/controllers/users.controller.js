import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const MANAGED_ROLES = ['teacher', 'student', 'parent']

const publicUser = user => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  avatarUrl: user.avatarUrl || '',
  className: user.className || '',
  createdAt: user.createdAt,
})

const requirePrincipal = req => req.user?.role === 'principal'

export const listUsers = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can manage users' })
    }

    const role = String(req.query.role || '').trim().toLowerCase()
    const filter = role ? { role } : { role: { $in: MANAGED_ROLES } }

    if (role && !MANAGED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid user role' })
    }

    const users = await User.find(filter).sort({ createdAt: -1 })
    return res.json({
      success: true,
      users: users.map(publicUser),
    })
  } catch (error) {
    next(error)
  }
}

export const createUser = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can create users' })
    }

    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const role = String(req.body.role || '').trim().toLowerCase()
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : ''
    const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.trim() : ''

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

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role,
      phone,
      avatarUrl,
    })

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      user: publicUser(user),
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      })
    }
    next(error)
  }
}

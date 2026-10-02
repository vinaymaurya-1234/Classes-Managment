import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { signToken } from '../utils/auth.js'

const publicUser = user => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  avatarUrl: user.avatarUrl || '',
})

export const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const matches = await bcrypt.compare(password, user.password)
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    return res.json({
      success: true,
      message: 'Login successful',
      token: signToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    next(error)
  }
}

export const createPrincipal = async (req, res, next) => {
  try {
    const setupKey = String(req.headers['x-principal-setup-key'] || '')
    const configuredKey = String(process.env.PRINCIPAL_SETUP_KEY || '')

    if (!configuredKey || setupKey !== configuredKey) {
      return res.status(401).json({ success: false, message: 'Invalid principal setup key' })
    }

    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : ''
    const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.trim() : ''

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
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

    const principalExists = await User.exists({ role: 'principal' })
    if (principalExists) {
      return res.status(409).json({
        success: false,
        message: 'A principal already exists',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const principal = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'principal',
      phone,
      avatarUrl,
    })

    return res.status(201).json({
      success: true,
      message: 'Principal created successfully',
      user: publicUser(principal),
    })
  } catch (error) {
    next(error)
  }
}

export const me = async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) })
}

export const updateProfile = async (req, res, next) => {
  try {
    const updates = {}
    if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim()
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone.trim()
    if (typeof req.body.avatarUrl === 'string') updates.avatarUrl = req.body.avatarUrl.trim()

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No profile changes were provided' })
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
    return res.json({ success: true, message: 'Profile updated', user: publicUser(user) })
  } catch (error) {
    next(error)
  }
}

export const changePassword = async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '')
    const newPassword = String(req.body.newPassword || '')

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' })
    }

    const user = await User.findById(req.user._id).select('+password')
    const matches = await bcrypt.compare(currentPassword, user.password)

    if (!matches) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }

    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()

    return res.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    next(error)
  }
}

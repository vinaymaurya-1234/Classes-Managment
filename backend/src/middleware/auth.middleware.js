import User from '../models/User.js'
import { verifyToken } from '../utils/auth.js'

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const payload = verifyToken(token)
    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' })
  }
}

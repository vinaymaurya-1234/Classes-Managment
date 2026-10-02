import jwt from 'jsonwebtoken'

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in the environment')
  }
  return process.env.JWT_SECRET
}

export const signToken = user => jwt.sign(
  { sub: user._id.toString(), role: user.role },
  getJwtSecret(),
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
)

export const verifyToken = token => jwt.verify(token, getJwtSecret())

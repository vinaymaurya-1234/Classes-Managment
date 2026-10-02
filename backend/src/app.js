import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import chapterRoutes from './routes/chapter.routes.js'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/users.routes.js'
import attendanceRoutes from './routes/attendance.routes.js'
import timetableRoutes from './routes/timetable.routes.js'
import noticesRoutes from './routes/notices.routes.js'

const app = express()

const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(','),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://10.22.194.69:5173',
]
  .map(origin => origin.trim())
  .filter(Boolean)
  .filter((origin, index, origins) => origins.indexOf(origin) === index)

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Classes Management API is running' })
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/chapters', chapterRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/timetable', timetableRoutes)
app.use('/api/notices', noticesRoutes)

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

export default app

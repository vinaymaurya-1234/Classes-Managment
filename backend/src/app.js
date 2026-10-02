import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './routes/auth.routes.js'

const app = express()

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

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

app.use('/api/auth', authRoutes)

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

import 'dotenv/config'
import app from './src/app.js'
import connectDB from './src/config/db.js'
import Chapter from './src/models/Chapter.js'

const PORT = Number(process.env.PORT) || 5000
const HOST = process.env.HOST || '0.0.0.0'

const startServer = async () => {
  try {
    await connectDB()
    await Chapter.syncIndexes()

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
      console.log(`LAN access: http://<your-pc-ip>:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

startServer()

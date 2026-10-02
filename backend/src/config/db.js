import mongoose from 'mongoose'

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in the environment')
  }

  mongoose.connection.on('connected', () => console.log('MongoDB connected'))
  mongoose.connection.on('error', error => console.error('MongoDB connection error:', error.message))
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'))

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
}

export default connectDB

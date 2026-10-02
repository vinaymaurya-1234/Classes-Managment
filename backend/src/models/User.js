import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['teacher', 'student', 'principal', 'parent'],
    required: true,
  },
  phone: { type: String, trim: true, default: '' },
  avatarUrl: { type: String, trim: true, default: '' },
  className: { type: String, trim: true, default: '' },
  teachingClasses: { type: [String], default: [] },
}, { timestamps: true })

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    return ret
  },
})

userSchema.index({ role: 1, className: 1 })

export default mongoose.model('User', userSchema)

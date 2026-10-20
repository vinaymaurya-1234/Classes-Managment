import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['teacher', 'student', 'principal', 'parent'], required: true },
  phone: { type: String, trim: true, default: '' },
  avatarUrl: { type: String, trim: true, default: '' },
  className: { type: String, trim: true, default: '' },
  std: { type: Number, enum: [10, 11, 12] },
  division: { type: String, enum: ['', 'A', 'B', 'C'], default: '' },
  teachingClasses: { type: [String], default: [] },
  children: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
}, { timestamps: true })

userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; return ret },
})
userSchema.index({ role: 1, className: 1 })
userSchema.index({ role: 1, std: 1, division: 1 })

export default mongoose.model('User', userSchema)

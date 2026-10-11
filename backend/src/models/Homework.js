import mongoose from 'mongoose'

const homeworkSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  className: { type: String, required: true, trim: true, index: true },
  subject: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  instructions: { type: String, default: '', trim: true },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['published', 'draft'], default: 'published', index: true },
  submissions: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: { type: String, trim: true }, submittedAt: { type: Date, default: Date.now } }],
}, { timestamps: true })

homeworkSchema.index({ className: 1, status: 1, createdAt: -1 })
export default mongoose.model('Homework', homeworkSchema)

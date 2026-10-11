import mongoose from 'mongoose'

const markSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  marks: { type: Number, min: 0, required: true },
  entered: { type: Boolean, default: false },
}, { _id: false })
const assessmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  className: { type: String, required: true, trim: true, index: true },
  subject: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  examDate: { type: Date, default: null },
  maxMarks: { type: Number, required: true, min: 1 },
  marks: { type: [markSchema], default: [] },
  status: { type: String, enum: ['draft', 'review', 'published'], default: 'draft', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  publishedAt: { type: Date, default: null },
}, { timestamps: true })
assessmentSchema.index({ className: 1, status: 1, createdAt: -1 })
export default mongoose.model('Assessment', assessmentSchema)

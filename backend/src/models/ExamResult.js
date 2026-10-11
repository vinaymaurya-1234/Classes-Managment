import mongoose from 'mongoose'

const examResultSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  className: { type: String, required: true, trim: true },
  division: { type: String, enum: ['A', 'B', 'C'], required: true },
  totalMarks: { type: Number, required: true },
  score: { type: Number, default: 0 },
  autoScore: { type: Number, default: 0 },
  manualScore: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  unansweredCount: { type: Number, default: 0 },
  pendingManualCount: { type: Number, default: 0 },
  published: { type: Boolean, default: false, index: true },
}, { timestamps: true })

examResultSchema.index({ exam: 1, className: 1, division: 1 })
export default mongoose.model('ExamResult', examResultSchema)

import mongoose from 'mongoose'

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: String, default: '' },
  flagged: { type: Boolean, default: false },
  marksAwarded: { type: Number, default: 0 },
  reviewed: { type: Boolean, default: false },
}, { _id: false })

const examAttemptSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answers: { type: [answerSchema], default: [] },
  status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress', index: true },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  autoScore: { type: Number, default: 0 },
  manualScore: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  unansweredCount: { type: Number, default: 0 },
  pendingManualCount: { type: Number, default: 0 },
}, { timestamps: true })

examAttemptSchema.index({ exam: 1, student: 1 }, { unique: true })
export default mongoose.model('ExamAttempt', examAttemptSchema)

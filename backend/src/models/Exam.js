import mongoose from 'mongoose'

const examSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paper: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionPaper', required: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['weekly', 'unit', 'midterm', 'final', 'practice', 'other'], default: 'unit' },
  className: { type: String, required: true, trim: true, index: true },
  std: { type: Number, enum: [10, 11, 12], required: true },
  division: { type: String, enum: ['', 'A', 'B', 'C'], default: '' },
  subject: { type: String, required: true, trim: true },
  startsAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, required: true, min: 1 },
  totalMarks: { type: Number, required: true, min: 1 },
  instructions: { type: String, default: '' },
  status: { type: String, enum: ['scheduled', 'live', 'completed', 'cancelled'], default: 'scheduled', index: true },
  resultsPublished: { type: Boolean, default: false },
  answerReviewEnabled: { type: Boolean, default: false },
  attemptsAllowed: { type: Number, default: 1, min: 1, max: 5 },
}, { timestamps: true })

examSchema.index({ className: 1, division: 1, startsAt: 1 })
export default mongoose.model('Exam', examSchema)

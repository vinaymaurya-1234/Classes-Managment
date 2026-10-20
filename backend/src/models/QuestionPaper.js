import mongoose from 'mongoose'

const paperQuestionSchema = new mongoose.Schema({
  questionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: ['mcq', 'short', 'long', 'true_false'], default: 'mcq' },
  options: [{ key: String, text: String }],
  correctAnswer: { type: String, default: '' },
  explanation: { type: String, default: '' },
  marks: { type: Number, required: true, min: 0.5 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  chapter: { type: String, default: '' },
}, { _id: true })

const questionPaperSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true, index: true },
  std: { type: Number, enum: [10, 11, 12], required: true },
  division: { type: String, enum: ['', 'A', 'B', 'C'], default: '' },
  subject: { type: String, required: true, trim: true },
  instructions: { type: String, default: '' },
  questions: { type: [paperQuestionSchema], default: [] },
  totalMarks: { type: Number, required: true, min: 1 },
  durationMinutes: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['draft', 'review', 'approved', 'returned'], default: 'draft', index: true },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true })

questionPaperSchema.index({ className: 1, division: 1, subject: 1, status: 1 })
export default mongoose.model('QuestionPaper', questionPaperSchema)

import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true },
}, { _id: false })

const questionSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  className: { type: String, required: true, trim: true, index: true },
  division: { type: String, enum: ['A', 'B', 'C'], required: true, index: true },
  subject: { type: String, required: true, trim: true, index: true },
  chapter: { type: String, trim: true, default: '' },
  topic: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['mcq', 'short', 'long', 'true_false'], default: 'mcq' },
  text: { type: String, required: true, trim: true },
  options: { type: [optionSchema], default: [] },
  correctAnswer: { type: String, trim: true, default: '' },
  explanation: { type: String, trim: true, default: '' },
  marks: { type: Number, required: true, min: 0.5, default: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags: { type: [String], default: [] },
}, { timestamps: true })

questionSchema.index({ teacher: 1, className: 1, division: 1, subject: 1, chapter: 1 })
questionSchema.index({ text: 1, teacher: 1 })
export default mongoose.model('Question', questionSchema)

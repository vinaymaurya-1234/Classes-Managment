import mongoose from 'mongoose'

const sessionNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
)

const chapterSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    chapterNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    sessions: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['not-started', 'started', 'completed'],
      default: 'not-started',
    },
    sessionNotes: { type: [sessionNoteSchema], default: [] },
  },
  { timestamps: true }
)

chapterSchema.index(
  { teacher: 1, subject: 1, className: 1, chapterNumber: 1 },
  { unique: true }
)

export default mongoose.model('Chapter', chapterSchema)

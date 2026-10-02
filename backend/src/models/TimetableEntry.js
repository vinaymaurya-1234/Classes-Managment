import mongoose from 'mongoose'

const timetableEntrySchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true },
  room: { type: String, trim: true, default: '' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

timetableEntrySchema.index({ date: 1, startTime: 1 })

export default mongoose.model('TimetableEntry', timetableEntrySchema)

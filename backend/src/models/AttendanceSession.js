import mongoose from 'mongoose'

const attendanceSessionSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  accessToken: { type: String, required: true, select: false, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true })

attendanceSessionSchema.index({ date: 1 }, { unique: true })

export default mongoose.model('AttendanceSession', attendanceSessionSchema)

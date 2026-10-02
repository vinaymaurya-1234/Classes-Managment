import mongoose from 'mongoose'

const attendanceRecordSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  markedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['present'], default: 'present' },
}, { timestamps: true })

attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true })
attendanceRecordSchema.index({ student: 1, markedAt: -1 })

export default mongoose.model('AttendanceRecord', attendanceRecordSchema)

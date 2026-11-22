import mongoose from 'mongoose'

const teacherAttendanceRecordSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  markedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['present'], default: 'present' },
}, { timestamps: true })

teacherAttendanceRecordSchema.index({ session: 1, teacher: 1 }, { unique: true })
teacherAttendanceRecordSchema.index({ teacher: 1, markedAt: -1 })

export default mongoose.model('TeacherAttendanceRecord', teacherAttendanceRecordSchema)

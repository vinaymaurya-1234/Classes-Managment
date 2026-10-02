import mongoose from 'mongoose'

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  audienceType: {
    type: String,
    enum: ['all', 'role', 'users'],
    required: true,
  },
  audienceRole: {
    type: String,
    enum: ['teacher', 'student', 'parent'],
    default: null,
  },
  recipientIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true })

noticeSchema.index({ createdAt: -1 })
noticeSchema.index({ recipientIds: 1, createdAt: -1 })
noticeSchema.index({ audienceType: 1, audienceRole: 1, createdAt: -1 })

export default mongoose.model('Notice', noticeSchema)

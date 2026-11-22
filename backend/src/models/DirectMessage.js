import mongoose from 'mongoose'

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
}, { _id: false })

const directMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  attachment: { type: attachmentSchema, default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true })

directMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 })
directMessageSchema.index({ recipient: 1, sender: 1, createdAt: -1 })

export default mongoose.model('DirectMessage', directMessageSchema)

import mongoose from 'mongoose'

const installmentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paidOn: { type: Date, required: true },
  method: {
    type: String,
    enum: ['cash', 'upi', 'bank', 'card', 'other'],
    default: 'cash',
  },
  reference: { type: String, trim: true, default: '' },
  note: { type: String, trim: true, default: '' },
}, { _id: true })

const studentFeeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  academicYear: { type: String, required: true, trim: true },
  totalFee: { type: Number, required: true, min: 0 },
  installments: { type: [installmentSchema], default: [] },
  notes: { type: String, trim: true, default: '' },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true })

studentFeeSchema.index({ academicYear: 1, student: 1 })

export default mongoose.model('StudentFee', studentFeeSchema)

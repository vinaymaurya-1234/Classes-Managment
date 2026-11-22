import mongoose from 'mongoose'

const classDivisionSchema = new mongoose.Schema({
  standard: { type: Number, required: true, min: 1, max: 12, index: true },
  standardLabel: { type: String, required: true, trim: true },
  division: { type: String, required: true, trim: true, uppercase: true },
  displayName: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

classDivisionSchema.index({ standard: 1, division: 1 }, { unique: true })

export default mongoose.model('ClassDivision', classDivisionSchema)

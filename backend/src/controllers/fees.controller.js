import mongoose from 'mongoose'
import StudentFee from '../models/StudentFee.js'
import User from '../models/User.js'

const requirePrincipal = req => req.user?.role === 'principal'
const CURRENT_ACADEMIC_YEAR = '2026-27'

const cleanInstallment = item => ({
  amount: Number(item.amount),
  paidOn: item.paidOn,
  method: item.method || 'cash',
  reference: typeof item.reference === 'string' ? item.reference.trim() : '',
  note: typeof item.note === 'string' ? item.note.trim() : '',
})

const serializeFee = (fee, student) => {
  const installments = (fee?.installments || []).map(item => ({
    id: item._id.toString(),
    amount: item.amount,
    paidOn: item.paidOn,
    method: item.method,
    reference: item.reference || '',
    note: item.note || '',
  }))
  const paidAmount = installments.reduce((sum, item) => sum + item.amount, 0)
  const totalFee = Number(fee?.totalFee || 0)
  return {
    id: fee?._id?.toString() || null,
    student: {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      avatarUrl: student.avatarUrl || '',
      className: student.className || '',
    },
    academicYear: fee?.academicYear || CURRENT_ACADEMIC_YEAR,
    totalFee,
    paidAmount,
    pendingAmount: Math.max(totalFee - paidAmount, 0),
    installments,
    installmentCount: installments.length,
    status: paidAmount >= totalFee && totalFee > 0 ? 'Paid' : paidAmount > 0 ? 'Partially paid' : 'Pending',
    notes: fee?.notes || '',
    updatedAt: fee?.updatedAt || null,
  }
}

export const listStudentFees = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can manage student fees' })
    }

    const students = await User.find({ role: 'student' }).sort({ name: 1 })
    const feeRecords = await StudentFee.find({
      student: { $in: students.map(student => student._id) },
      academicYear: String(req.query.academicYear || CURRENT_ACADEMIC_YEAR).trim(),
    })
    const byStudent = new Map(feeRecords.map(fee => [fee.student.toString(), fee]))

    return res.json({
      success: true,
      academicYear: String(req.query.academicYear || CURRENT_ACADEMIC_YEAR).trim(),
      fees: students.map(student => serializeFee(byStudent.get(student._id.toString()), student)),
    })
  } catch (error) {
    next(error)
  }
}

export const upsertStudentFee = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can manage student fees' })
    }

    const { studentId } = req.params
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' })
    }

    const student = await User.findOne({ _id: studentId, role: 'student' })
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' })
    }

    const academicYear = String(req.body.academicYear || CURRENT_ACADEMIC_YEAR).trim()
    const totalFee = Number(req.body.totalFee)
    const installments = Array.isArray(req.body.installments) ? req.body.installments.map(cleanInstallment) : []

    if (!academicYear) return res.status(400).json({ success: false, message: 'Academic year is required' })
    if (!Number.isFinite(totalFee) || totalFee < 0) return res.status(400).json({ success: false, message: 'Total fee must be a valid non-negative amount' })

    for (const installment of installments) {
      if (!Number.isFinite(installment.amount) || installment.amount <= 0) {
        return res.status(400).json({ success: false, message: 'Every installment must have a valid amount' })
      }
      if (!installment.paidOn || Number.isNaN(new Date(installment.paidOn).getTime())) {
        return res.status(400).json({ success: false, message: 'Every installment must have a valid payment date' })
      }
      if (!['cash', 'upi', 'bank', 'card', 'other'].includes(installment.method)) {
        return res.status(400).json({ success: false, message: 'Invalid payment method' })
      }
    }

    const paidAmount = installments.reduce((sum, item) => sum + item.amount, 0)
    if (paidAmount > totalFee) {
      return res.status(400).json({ success: false, message: 'Paid amount cannot be greater than total fee' })
    }

    const fee = await StudentFee.findOneAndUpdate(
      { student: student._id, academicYear },
      {
        $set: {
          totalFee,
          installments,
          notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '',
          updatedBy: req.user._id,
        },
        $setOnInsert: { student: student._id, academicYear },
      },
      { new: true, upsert: true, runValidators: true }
    )

    return res.json({
      success: true,
      message: 'Student fee details saved successfully',
      fee: serializeFee(fee, student),
    })
  } catch (error) {
    next(error)
  }
}

import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import DirectMessage from '../models/DirectMessage.js'
import Chapter from '../models/Chapter.js'
import TimetableEntry from '../models/TimetableEntry.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const validId = value => mongoose.isValidObjectId(value)

const parseClass = value => {
  const match = String(value || '').match(/(?:class\\s*)?(1[0-2]|[1-9])(?:\\s*[-/]\\s*([a-z]))?/i)
  return match ? { std: Number(match[1]), division: (match[2] || '').toUpperCase() } : null
}

const parentTeacherIds = async parent => {
  const children = await User.find({ _id: { $in: parent.children || [] }, role: 'student' })
    .select('_id std division className').lean()
  if (!children.length) return []
  const childIds = new Set(children.map(child => String(child._id)))
  const teacherIds = new Set()
  const chapters = await Chapter.find({ teacher: { $ne: null } }).select('teacher className').lean()
  for (const chapter of chapters) {
    const assignedClass = parseClass(chapter.className)
    if (!assignedClass) continue
    if (children.some(child => child.std === assignedClass.std &&
      (!assignedClass.division || assignedClass.division === String(child.division || '').toUpperCase()))) {
      teacherIds.add(String(chapter.teacher))
    }
  }
  const timetableRows = await TimetableEntry.find({
    teacher: { $ne: null },
    standard: { $in: children.map(child => child.std).filter(Boolean) },
  }).select('teacher standard division').lean()
  for (const row of timetableRows) {
    if (children.some(child => child.std === row.standard &&
      String(child.division || 'A').toUpperCase() === String(row.division || 'A').toUpperCase())) {
      teacherIds.add(String(row.teacher))
    }
  }
  return [...teacherIds].filter(id => !childIds.has(id))
}

const canParentContact = async (parent, recipient) => {
  if (recipient.role === 'principal') return true
  if (recipient.role !== 'teacher') return false
  const allowedTeacherIds = await parentTeacherIds(parent)
  return allowedTeacherIds.includes(String(recipient._id))
}

const getAllowedContacts = async user => {
  if (user.role !== 'parent') return User.find({ _id: { $ne: user._id } })
    .select('name email role avatarUrl std division').sort({ name: 1 }).lean()
  const allowedTeacherIds = await parentTeacherIds(user)
  return User.find({
    _id: { $ne: user._id },
    $or: [
      { role: 'principal' },
      { role: 'teacher', _id: { $in: allowedTeacherIds } },
    ],
  }).select('name email role avatarUrl std division').sort({ role: 1, name: 1 }).lean()
}
const serialize = message => ({
  id: message._id.toString(),
  senderId: message.sender.toString(),
  recipientId: message.recipient.toString(),
  text: message.deletedAt ? '' : message.text,
  attachment: message.deletedAt || !message.attachment ? null : {
    name: message.attachment.name,
    mimeType: message.attachment.mimeType,
    size: message.attachment.size,
    dataUrl: `data:${message.attachment.mimeType};base64,${message.attachment.data.toString('base64')}`,
  },
  edited: Boolean(message.editedAt),
  deleted: Boolean(message.deletedAt),
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
})

router.get('/contacts', async (req, res, next) => {
  try {
    const users = await getAllowedContacts(req.user)
    res.json({ success: true, contacts: users.map(user => ({
      id: user._id.toString(), name: user.name, email: user.email, role: user.role,
      avatarUrl: user.avatarUrl || '', std: user.std ?? null, division: user.division || '',
    })) })
  } catch (error) { next(error) }
})

router.get('/:userId', async (req, res, next) => {
  try {
    if (!validId(req.params.userId)) return res.status(400).json({ success: false, message: 'Invalid contact.' })
    const contact = await User.findById(req.params.userId).select('_id role')
    if (!contact) return res.status(404).json({ success: false, message: 'User not found.' })
    if (req.user.role === 'parent' && !(await canParentContact(req.user, contact))) {
      return res.status(403).json({ success: false, message: 'You can only chat with your child’s teachers or the principal.' })
    }
    const messages = await DirectMessage.find({
      $or: [
        { sender: req.user._id, recipient: contact._id },
        { sender: contact._id, recipient: req.user._id },
      ],
    }).sort({ createdAt: 1 }).limit(300).lean()
    res.json({ success: true, messages: messages.map(serialize) })
  } catch (error) { next(error) }
})

router.post('/:userId', async (req, res, next) => {
  try {
    if (!validId(req.params.userId)) return res.status(400).json({ success: false, message: 'Invalid recipient.' })
    if (String(req.user._id) === req.params.userId) return res.status(400).json({ success: false, message: 'You cannot message yourself.' })
    const recipient = await User.findById(req.params.userId).select('_id role')
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found.' })
    if (req.user.role === 'parent' && !(await canParentContact(req.user, recipient))) {
      return res.status(403).json({ success: false, message: 'You can only message your child’s teachers or the principal.' })
    }

    const text = String(req.body.text || '').trim()
    let attachment = null
    if (req.body.attachment) {
      const { name, mimeType, dataUrl } = req.body.attachment
      const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+|application\/pdf);base64,([A-Za-z0-9+/=]+)$/) : null
      if (!match || match[1] !== mimeType) return res.status(400).json({ success: false, message: 'Only image and PDF attachments are supported.' })
      const data = Buffer.from(match[2], 'base64')
      if (!data.length || data.length > 3 * 1024 * 1024) return res.status(400).json({ success: false, message: 'Attachment must be 3 MB or smaller.' })
      attachment = { name: String(name || 'attachment').slice(0, 180), mimeType, size: data.length, data }
    }
    if (!text && !attachment) return res.status(400).json({ success: false, message: 'Write a message or attach a file.' })
    if (text.length > 5000) return res.status(400).json({ success: false, message: 'Message is too long.' })

    const message = await DirectMessage.create({ sender: req.user._id, recipient: recipient._id, text, attachment })
    res.status(201).json({ success: true, message: serialize(message) })
  } catch (error) { next(error) }
})

router.patch('/message/:messageId', async (req, res, next) => {
  try {
    if (!validId(req.params.messageId)) return res.status(400).json({ success: false, message: 'Invalid message.' })
    const text = String(req.body.text || '').trim()
    if (!text || text.length > 5000) return res.status(400).json({ success: false, message: 'Message must contain 1 to 5000 characters.' })
    const message = await DirectMessage.findOne({ _id: req.params.messageId, sender: req.user._id, deletedAt: null })
    if (!message) return res.status(404).json({ success: false, message: 'Message not found or you cannot edit it.' })
    message.text = text
    message.editedAt = new Date()
    await message.save()
    res.json({ success: true, message: serialize(message) })
  } catch (error) { next(error) }
})

router.delete('/message/:messageId', async (req, res, next) => {
  try {
    if (!validId(req.params.messageId)) return res.status(400).json({ success: false, message: 'Invalid message.' })
    const message = await DirectMessage.findOne({ _id: req.params.messageId, sender: req.user._id, deletedAt: null })
    if (!message) return res.status(404).json({ success: false, message: 'Message not found or you cannot delete it.' })
    message.text = ''
    message.attachment = null
    message.deletedAt = new Date()
    await message.save()
    res.json({ success: true, message: serialize(message) })
  } catch (error) { next(error) }
})

export default router

import Notice from '../models/Notice.js'
import User from '../models/User.js'

const MANAGED_ROLES = ['teacher', 'student', 'parent']

const publicNotice = notice => ({
  id: notice._id.toString(),
  title: notice.title,
  message: notice.message,
  audienceType: notice.audienceType,
  audienceRole: notice.audienceRole || null,
  recipientIds: (notice.recipientIds || []).map(id => id.toString()),
  createdBy: notice.createdBy?._id ? {
    id: notice.createdBy._id.toString(),
    name: notice.createdBy.name,
  } : null,
  createdAt: notice.createdAt,
})

const requirePrincipal = req => req.user?.role === 'principal'

export const listNotices = async (req, res, next) => {
  try {
    const user = req.user
    const query = user.role === 'principal'
      ? { createdBy: user._id }
      : {
          $or: [
            { audienceType: 'all' },
            { audienceType: 'role', audienceRole: user.role },
            { audienceType: 'users', recipientIds: user._id },
          ],
        }

    const notices = await Notice.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })

    return res.json({
      success: true,
      notices: notices.map(publicNotice),
    })
  } catch (error) {
    next(error)
  }
}

export const createNotice = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) {
      return res.status(403).json({ success: false, message: 'Only the principal can send notices' })
    }

    const title = String(req.body.title || '').trim()
    const message = String(req.body.message || '').trim()
    const audienceType = String(req.body.audienceType || '').trim().toLowerCase()
    const audienceRole = String(req.body.audienceRole || '').trim().toLowerCase()
    const rawRecipientIds = Array.isArray(req.body.recipientIds) ? req.body.recipientIds : []

    if (!title || !message || !audienceType) {
      return res.status(400).json({
        success: false,
        message: 'Title, message and audience are required',
      })
    }

    if (title.length > 160 || message.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Notice title or message is too long',
      })
    }

    if (!['all', 'role', 'users'].includes(audienceType)) {
      return res.status(400).json({ success: false, message: 'Invalid notice audience' })
    }

    if (audienceType === 'role' && !MANAGED_ROLES.includes(audienceRole)) {
      return res.status(400).json({ success: false, message: 'Select a valid recipient group' })
    }

    let recipientIds = []
    if (audienceType === 'users') {
      recipientIds = [...new Set(rawRecipientIds.map(id => String(id).trim()).filter(Boolean))]

      if (!recipientIds.length) {
        return res.status(400).json({ success: false, message: 'Select at least one user' })
      }

      const users = await User.find({
        _id: { $in: recipientIds },
        role: { $in: MANAGED_ROLES },
      }).select('_id')

      if (users.length !== recipientIds.length) {
        return res.status(400).json({ success: false, message: 'One or more selected users are invalid' })
      }
    }

    const notice = await Notice.create({
      title,
      message,
      audienceType,
      audienceRole: audienceType === 'role' ? audienceRole : null,
      recipientIds,
      createdBy: req.user._id,
    })

    await notice.populate('createdBy', 'name')

    return res.status(201).json({
      success: true,
      message: 'Notice sent successfully',
      notice: publicNotice(notice),
    })
  } catch (error) {
    next(error)
  }
}

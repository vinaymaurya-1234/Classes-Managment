import express from 'express'
import Chapter from '../models/Chapter.js'

const router = express.Router()

const normalisePayload = body => ({
  subject: body.subject?.trim(),
  className: body.className?.trim(),
  chapterNumber: Number(body.chapterNumber),
  title: body.title?.trim(),
})

router.get('/', async (_req, res, next) => {
  try {
    const chapters = await Chapter.find().sort({ status: 1, updatedAt: -1, chapterNumber: 1 })
    res.json({ success: true, data: chapters })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const payload = normalisePayload(req.body)
    if (!payload.subject || !payload.className || !payload.chapterNumber || !payload.title) {
      return res.status(400).json({ success: false, message: 'Subject, class, chapter number and title are required.' })
    }

    const chapter = await Chapter.create(payload)
    res.status(201).json({ success: true, data: chapter })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This chapter number already exists for this subject and class.' })
    }
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const chapter = await Chapter.findById(req.params.id)
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found.' })

    if (req.body.action === 'start') {
      chapter.status = 'started'
      chapter.startedAt = chapter.startedAt || new Date()
      if (chapter.progress === 100) chapter.progress = 0
    } else if (req.body.action === 'complete') {
      chapter.status = 'completed'
      chapter.progress = 100
      chapter.completedAt = new Date()
    } else if (req.body.action === 'session') {
      const note = String(req.body.note || '').trim()
      if (!note) return res.status(400).json({ success: false, message: 'Session note is required.' })
      chapter.sessionNotes.push({ note })
      chapter.sessions += 1
      if (chapter.status === 'not-started') {
        chapter.status = 'started'
        chapter.startedAt = new Date()
      }
    } else {
      const allowed = normalisePayload(req.body)
      Object.assign(chapter, allowed)
    }

    await chapter.save()
    res.json({ success: true, data: chapter })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This chapter number already exists for this subject and class.' })
    }
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id)
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found.' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router

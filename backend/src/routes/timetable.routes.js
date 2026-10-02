import { Router } from 'express'
import {
  createTimetableEntry,
  deleteTimetableEntry,
  listTimetable,
  listTimetableRange,
  listTimetableTeachers,
  updateTimetableEntry,
} from '../controllers/timetable.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)

router.get('/', listTimetable)
router.get('/range', listTimetableRange)
router.get('/teachers', listTimetableTeachers)
router.post('/', createTimetableEntry)
router.patch('/:id', updateTimetableEntry)
router.delete('/:id', deleteTimetableEntry)

export default router

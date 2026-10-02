import { Router } from 'express'
import {
  createTodayAttendanceSession,
  getTodayAttendanceSession,
  getTodayAttendanceSummary,
  markStudentAttendance,
} from '../controllers/attendance.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/today', getTodayAttendanceSession)
router.post('/today', createTodayAttendanceSession)
router.get('/today/summary', getTodayAttendanceSummary)
router.post('/mark', markStudentAttendance)

export default router

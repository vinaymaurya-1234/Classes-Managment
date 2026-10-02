import { Router } from 'express'
import {
  createTodayAttendanceSession,
  getTodayAttendanceSession,
  getTodayAttendanceSummary,
  getStudentAttendanceSummary,
  getPrincipalAttendanceDashboard,
  getPrincipalAttendanceHistory,
  getPrincipalStudentAttendance,
  markStudentAttendance,
} from '../controllers/attendance.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/today', getTodayAttendanceSession)
router.post('/today', createTodayAttendanceSession)
router.get('/today/summary', getTodayAttendanceSummary)
router.get('/my', getStudentAttendanceSummary)
router.get('/principal/dashboard', getPrincipalAttendanceDashboard)
router.get('/principal/history', getPrincipalAttendanceHistory)
router.get('/principal/student/:studentId', getPrincipalStudentAttendance)
router.post('/mark', markStudentAttendance)

export default router

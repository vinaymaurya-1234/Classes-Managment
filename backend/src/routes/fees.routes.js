import { Router } from 'express'
import { listStudentFees, upsertStudentFee } from '../controllers/fees.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/students', listStudentFees)
router.put('/students/:studentId', upsertStudentFee)

export default router

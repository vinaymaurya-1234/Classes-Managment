import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { listClassDivisions, saveClassStructure } from '../controllers/classes.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', listClassDivisions)
router.put('/structure', saveClassStructure)
export default router

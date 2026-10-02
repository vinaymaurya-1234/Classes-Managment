import { Router } from 'express'
import { createNotice, listNotices } from '../controllers/notices.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listNotices)
router.post('/', createNotice)

export default router

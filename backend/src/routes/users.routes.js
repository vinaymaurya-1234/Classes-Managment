import { Router } from 'express'
import { createUser, listUsers } from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listUsers)
router.post('/', createUser)

export default router

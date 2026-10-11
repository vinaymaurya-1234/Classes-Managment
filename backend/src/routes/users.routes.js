import { Router } from 'express'
import { createUser, listUsers, updateTeacherAssignments } from '../controllers/users.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listUsers)
router.post('/', createUser)
router.put('/:id/teaching-classes', updateTeacherAssignments)

export default router

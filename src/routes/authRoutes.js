import express from 'express';
const router = express.Router();
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/profile', requireAuth, authController.getProfile);
export default router;
//# sourceMappingURL=authRoutes.js.map
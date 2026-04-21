import express from 'express';
const router = express.Router();
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/profile', requireAuth, authController.getProfile);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
export default router;
//# sourceMappingURL=authRoutes.js.map
import express from 'express';
const router = express.Router();
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

router.get('/', requireAuth, notificationController.getMyNotifications);
router.patch('/:id/read', requireAuth, notificationController.markAsRead);

export default router;

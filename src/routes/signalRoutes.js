import express from 'express';
const router = express.Router();
import * as signalController from '../controllers/signalController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
router.get('/dashboard', requireAuth, signalController.getSignalsDashboard);
router.post('/create', [requireAuth, requireAdmin], signalController.createSignal);
router.post('/take', requireAuth, signalController.takeSignal);
router.get('/user/:user_id/history', requireAuth, signalController.getUserSignalHistory);
router.post('/:id/extend-timer', [requireAuth, requireAdmin], signalController.extendTimer);
export default router;
//# sourceMappingURL=signalRoutes.js.map
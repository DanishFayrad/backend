import express from 'express';
const router = express.Router();
import * as signalController from '../controllers/signalController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
router.get('/dashboard', requireAuth, signalController.getSignalsDashboard);
router.post('/create', [requireAuth, requireAdmin, upload.single('signal_image')], signalController.createSignal);
router.post('/take', requireAuth, signalController.takeSignal);
router.get('/user/:user_id/history', requireAuth, signalController.getUserSignalHistory);
router.post('/:id/extend-timer', [requireAuth, requireAdmin], signalController.extendTimer);
router.delete('/:id', requireAuth, signalController.deleteSignal);

// Global Timer Routes
router.post('/global-timer', [requireAuth, requireAdmin], signalController.setGlobalTimer);
router.get('/global-timer', requireAuth, signalController.getGlobalTimer);
router.delete('/global-timer', [requireAuth, requireAdmin], signalController.clearGlobalTimer);

// Signal Request Routes
router.post('/request-access', requireAuth, signalController.requestSignalAccess);
router.get('/requests', [requireAuth, requireAdmin], signalController.getSignalRequests);
router.post('/requests/:id/approve', [requireAuth, requireAdmin], signalController.approveSignalRequest);
export default router;
//# sourceMappingURL=signalRoutes.js.map
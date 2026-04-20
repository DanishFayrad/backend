import express from 'express';
const router = express.Router();
import * as transactionController from '../controllers/transactionController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

// User routes
router.post('/deposit', [requireAuth, upload.single('proof_image')], transactionController.requestDeposit);
router.get('/my', requireAuth, transactionController.getMyTransactions);

// Admin routes
router.get('/pending', [requireAuth, requireAdmin], transactionController.getPendingTransactions);
router.get('/all', [requireAuth, requireAdmin], transactionController.getAllTransactions);
router.post('/:id/approve', [requireAuth, requireAdmin], transactionController.approveTransaction);
router.post('/:id/reject', [requireAuth, requireAdmin], transactionController.rejectTransaction);
router.delete('/:id', [requireAuth, requireAdmin], transactionController.deleteTransaction);
router.get('/admin-stats', [requireAuth, requireAdmin], transactionController.getAdminStats);
router.get('/wallet-stats', requireAuth, transactionController.getUserWalletStats);

export default router;

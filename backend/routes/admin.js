import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  getAllUsers,
  getUserDetails,
  deactivateUser,
  reactivateUser,
  getPendingDoctors,
  approveDoctor,
  rejectDoctor,
  getPlatformStatistics,
  getAdminLogs,
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require admin role
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

// User Management Routes
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.patch('/users/:userId/deactivate', deactivateUser);
router.patch('/users/:userId/reactivate', reactivateUser);

// Doctor Approval Routes
router.get('/doctors/pending', getPendingDoctors);
router.patch('/doctors/:doctorId/approve', approveDoctor);
router.patch('/doctors/:doctorId/reject', rejectDoctor);

// Statistics Routes
router.get('/statistics', getPlatformStatistics);
router.get('/logs', getAdminLogs);

export default router;

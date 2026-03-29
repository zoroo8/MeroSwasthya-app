import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { getPatientProfile, updatePatientProfile } from '../controllers/patientController.js';

const router = express.Router();

router.get('/profile', authMiddleware, roleMiddleware('patient'), getPatientProfile);
router.patch('/profile', authMiddleware, roleMiddleware('patient'), updatePatientProfile);

export default router;

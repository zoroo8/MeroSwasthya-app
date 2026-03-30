import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { createDoctorProfile, getDoctorById, getDoctors } from '../controllers/doctorController.js';

const router = express.Router();

// Doctor discovery
router.get('/', getDoctors);
router.get('/:id', getDoctorById);

// Doctor creates professional profile
router.post('/create-profile', authMiddleware, roleMiddleware('doctor'), createDoctorProfile);

export default router;
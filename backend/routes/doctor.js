import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { createDoctorProfile } from '../controllers/doctorController.js';
import { getDoctorSlots } from '../controllers/slotController.js';

const router = express.Router();

// Doctor creates professional profile
router.post('/create-profile', authMiddleware, roleMiddleware('doctor'), createDoctorProfile);
// Doctor slot listing
router.get('/:id/slots', getDoctorSlots);

export default router;
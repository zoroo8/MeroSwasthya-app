import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { createPrescription, getPrescriptionByAppointmentId } from '../controllers/prescriptionController.js';

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware('doctor'), createPrescription);
router.get('/:appointmentId', authMiddleware, getPrescriptionByAppointmentId);

export default router;

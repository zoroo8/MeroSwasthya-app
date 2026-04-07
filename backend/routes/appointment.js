import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { bookAppointment, getAppointments, updateAppointmentStatus } from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware('patient'), bookAppointment);
router.get('/', authMiddleware, getAppointments);
router.patch('/:id', authMiddleware, updateAppointmentStatus);

export default router;

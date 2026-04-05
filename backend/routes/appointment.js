const express = require('express');
const { getAvailableSlots, bookSlot, getDoctorAppointments } = require('../controllers/appointmentController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

const router = express.Router();

// Allow anyone (public/patient) to view available doctor slots by Doctor's ID and Date
router.get('/slots', getAvailableSlots);

// Allows a patient to actually book the slot
router.post('/book', auth, role('patient'), bookSlot);

// Allows the doctor to fetch their own appointment lists
router.get('/mine', auth, role('doctor'), getDoctorAppointments);

module.exports = router;

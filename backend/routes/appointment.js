const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  bookAppointment,
  bookFromHospital,
  getMyAppointments,
  updateAppointmentStatus,
} = require('../controllers/appointmentController');

const router = express.Router();

router.post('/book', auth, role('patient'), bookAppointment);
router.post('/book-from-hospital', auth, role('patient'), bookFromHospital);
router.get('/my', auth, role('patient', 'doctor'), getMyAppointments);
router.patch('/:id/status', auth, role('doctor', 'admin'), updateAppointmentStatus);

module.exports = router;

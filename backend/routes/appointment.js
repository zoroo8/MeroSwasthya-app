const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  bookAppointment,
  bookFromHospital,
  bookBySpecialty,
  getMyAppointments,
  updateAppointmentStatus,
} = require('../controllers/appointmentController');

const router = express.Router();

router.post('/book', auth, role('patient'), bookAppointment);
router.post('/book-from-hospital', auth, role('patient'), bookFromHospital);
router.post('/book-by-specialty', auth, role('patient'), bookBySpecialty);
router.get('/my', auth, role('patient', 'doctor', 'hospital'), getMyAppointments);
router.patch('/:id/status', auth, role('doctor', 'admin'), updateAppointmentStatus);

module.exports = router;

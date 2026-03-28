const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createHospital,
  getHospitals,
  getHospitalDoctors,
  assignDoctorToHospital,
} = require('../controllers/hospitalController');

const router = express.Router();

router.get('/', getHospitals);
router.get('/:hospitalId/doctors', getHospitalDoctors);
router.post('/', auth, role('admin', 'hospital'), createHospital);
router.patch('/:hospitalId/doctors/:doctorId', auth, role('admin', 'hospital'), assignDoctorToHospital);

module.exports = router;
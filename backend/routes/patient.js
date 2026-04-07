const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getMyProfile,
  upsertMyProfile,
  getMyPastAppointmentsWithReports,
} = require('../controllers/patientController');

const router = express.Router();

router.get('/me', auth, role('patient'), getMyProfile);
router.put('/me', auth, role('patient'), upsertMyProfile);
router.get('/me/history', auth, role('patient'), getMyPastAppointmentsWithReports);

module.exports = router;

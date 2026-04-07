const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createOrUpdateReport,
  getMyReports,
  getReportById,
} = require('../controllers/reportController');

const router = express.Router();

router.post('/', auth, role('doctor', 'hospital', 'admin'), createOrUpdateReport);
router.get('/my', auth, role('patient', 'doctor', 'hospital', 'admin'), getMyReports);
router.get('/:id', auth, role('patient', 'doctor', 'hospital', 'admin'), getReportById);

module.exports = router;
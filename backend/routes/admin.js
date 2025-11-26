const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { getStats, createUser, createHospitalWithAdmin } = require('../controllers/adminController');

const router = express.Router();

router.get('/stats', auth, role('admin'), getStats);
router.post('/users', auth, role('admin'), createUser);
router.post('/hospitals', auth, role('admin'), createHospitalWithAdmin);

module.exports = router;

// Git commit [2025-11-26]: feat: scaffold admin.js route file and adminController.js with role protection

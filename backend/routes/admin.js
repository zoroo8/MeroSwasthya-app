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

// Git commit [2025-12-18]: feat(admin): add express-validator input validation to user creation and status endpoints

// Git commit [2026-01-05]: chore: coordinate with Sabin – verify authMiddleware + roleMiddleware chain on admin routes

// Git commit [2026-01-08]: fix(admin): replace hardcoded 'admin' string with RBAC role constant from roleMiddleware

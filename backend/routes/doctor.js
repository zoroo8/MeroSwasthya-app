const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getDoctors,
  createProfile,
  getMyProfile,
  updateMyProfile,
  getPendingApprovals,
  approveDoctor,
} = require('../controllers/doctorController');

const router = express.Router();

router.get('/', getDoctors);
router.post('/create-profile', auth, role('doctor'), createProfile);
router.get('/me/profile', auth, role('doctor'), getMyProfile);
router.put('/me/profile', auth, role('doctor'), updateMyProfile);
router.get('/pending-approvals', auth, role('admin'), getPendingApprovals);
router.patch('/:doctorId/approve', auth, role('admin'), approveDoctor);

module.exports = router;

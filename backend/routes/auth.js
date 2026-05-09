const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { runProfileImageUpload } = require('../middleware/uploadMiddleware');
const {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfileImage,
  deleteProfileImage,
  patientDashboard,
  doctorDashboard,
  adminDashboard,
  hospitalDashboard,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', auth, getCurrentUser);
router.post('/me/profile-image', auth, runProfileImageUpload, updateProfileImage);
router.delete('/me/profile-image', auth, deleteProfileImage);
router.get('/dashboard/patient', auth, role('patient'), patientDashboard);
router.get('/dashboard/doctor', auth, role('doctor'), doctorDashboard);
router.get('/dashboard/admin', auth, role('admin'), adminDashboard);
router.get('/dashboard/hospital', auth, role('hospital'), hospitalDashboard);

module.exports = router;

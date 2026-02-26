import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  patientDashboard,
  doctorDashboard,
  adminDashboard,
  hospitalDashboard
} from '../controllers/authController.js';

const router = express.Router();

// Register
router.post('/register', register);

// Login
router.post('/login', login);

// OTP Verification
router.post('/verify-otp', verifyOtp);

// OTP Resend
router.post('/resend-otp', resendOtp);

// Forgot Password
router.post('/forgot-password', forgotPassword);

// Reset Password
router.post('/reset-password', resetPassword);

// Current User
router.get('/me', authMiddleware, getCurrentUser);

// role-based dashboard access
router.get('/dashboard/patient', authMiddleware, roleMiddleware('patient'), patientDashboard);

router.get('/dashboard/doctor', authMiddleware, roleMiddleware('doctor'), doctorDashboard);

router.get('/dashboard/admin', authMiddleware, roleMiddleware('admin'), adminDashboard);

router.get('/dashboard/hospital', authMiddleware, roleMiddleware('hospital'), hospitalDashboard);

export default router;
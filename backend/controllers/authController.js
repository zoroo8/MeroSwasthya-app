const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getDashboardPathByRole } = require('../utils/dashboardByRole');
const { isEmailServiceConfigured, sendOtpEmail } = require('../utils/emailService');

const OTP_EXPIRY_MINUTES = 10;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const getEmailNotConfiguredMessage = () => 'Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env';

const createToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const buildAuthResponse = (user, token, message) => {
  return {
    message,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    redirectTo: getDashboardPathByRole(user.role),
  };
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!isEmailServiceConfigured()) {
      return res.status(500).json({ message: getEmailNotConfiguredMessage() });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let selectedRole = 'patient';

    if (role === 'doctor') {
      selectedRole = 'doctor';
    }

    if (role === 'admin' && req.body.adminSecret === process.env.ADMIN_SECRET) {
      selectedRole = 'admin';
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole,
    });

    const verificationOtp = generateOtp();
    user.verificationOtp = verificationOtp;
    user.verificationOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    await sendOtpEmail({
      to: user.email,
      otp: verificationOtp,
      purpose: 'verification',
      name: user.name,
    });

    res.status(201).json({
      message: 'Registered successfully. OTP has been sent to your email.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Account not verified. Please verify OTP first.',
        requiresVerification: true,
      });
    }

    const token = createToken(user);
    res.json(buildAuthResponse(user, token, 'Login successful'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: 'Invalid OTP or email' });
    }

    if (!user.verificationOtp || !user.verificationOtpExpiresAt) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    if (user.verificationOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP or email' });
    }

    if (user.verificationOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpiresAt = undefined;
    await user.save();

    const token = createToken(user);
    res.json(buildAuthResponse(user, token, 'Account verified successfully'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!isEmailServiceConfigured()) {
      return res.status(500).json({ message: getEmailNotConfiguredMessage() });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account already verified' });
    }

    const verificationOtp = generateOtp();
    user.verificationOtp = verificationOtp;
    user.verificationOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    await sendOtpEmail({
      to: user.email,
      otp: verificationOtp,
      purpose: 'verification',
      name: user.name,
    });

    res.json({ message: 'OTP resent successfully to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!isEmailServiceConfigured()) {
      return res.status(500).json({ message: getEmailNotConfiguredMessage() });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({ message: 'If this email exists, a reset OTP has been sent.' });
    }

    const resetOtp = generateOtp();
    user.resetOtp = resetOtp;
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save();

    await sendOtpEmail({
      to: user.email,
      otp: resetOtp,
      purpose: 'reset',
      name: user.name,
    });

    res.json({ message: 'If this email exists, a reset OTP has been sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.resetOtp || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: 'Invalid reset request' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid reset OTP' });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Reset OTP expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user,
      redirectTo: getDashboardPathByRole(user.role),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const patientDashboard = (req, res) => res.json({ message: 'Patient dashboard access granted', role: req.user.role });
const doctorDashboard = (req, res) => res.json({ message: 'Doctor dashboard access granted', role: req.user.role });
const adminDashboard = (req, res) => res.json({ message: 'Admin dashboard access granted', role: req.user.role });
const hospitalDashboard = (req, res) => res.json({ message: 'Hospital dashboard access granted', role: req.user.role });

module.exports = {
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
  hospitalDashboard,
};
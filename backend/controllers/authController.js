import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getDashboardPathByRole } from '../utils/dashboardByRole.js';
import { isEmailServiceConfigured, sendOtpEmail } from '../utils/emailService.js';

const OTP_EXPIRY_MINUTES = 10;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Helper functions
const generateOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const getEmailNotConfiguredMessage = () => {
  return 'Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env';
};

const getAccessTokenSecret = () => process.env.JWT_SECRET;

const getRefreshTokenSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const createAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    getAccessTokenSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

const createRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, tokenType: 'refresh' },
    getRefreshTokenSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

const persistRefreshToken = async (user, refreshToken) => {
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);
  await user.save();
};

const ensureJwtSecretsConfigured = () => {
  if (!getAccessTokenSecret()) {
    throw new Error('JWT_SECRET is not configured');
  }

  if (!getRefreshTokenSecret()) {
    throw new Error('JWT_REFRESH_SECRET or JWT_SECRET is not configured');
  }
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

// Controller methods
export const register = async (req, res) => {
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
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole
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

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    ensureJwtSecretsConfigured();

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Account not verified. Please verify OTP first.',
        requiresVerification: true,
      });
    }

    const token = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    await persistRefreshToken(user, refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    res.json(buildAuthResponse(user, token, 'Login successful'));

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    ensureJwtSecretsConfigured();

    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is missing' });
    }

    const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    const incomingRefreshTokenHash = hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingRefreshTokenHash) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ message: 'Refresh token expired. Please login again.' });
    }

    const nextAccessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);
    await persistRefreshToken(user, nextRefreshToken);
    setRefreshTokenCookie(res, nextRefreshToken);

    res.json(buildAuthResponse(user, nextAccessToken, 'Access token refreshed'));
  } catch (err) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshTokenHash = undefined;
          user.refreshTokenExpiresAt = undefined;
          await user.save();
        }
      } catch (err) {
        // Ignore token parsing errors during logout and always clear cookie.
      }
    }

    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    ensureJwtSecretsConfigured();

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

    const token = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    await persistRefreshToken(user, refreshToken);
    setRefreshTokenCookie(res, refreshToken);

    res.json(buildAuthResponse(user, token, 'Account verified successfully'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const resendOtp = async (req, res) => {
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

    res.json({
      message: 'OTP resent successfully to your email',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const forgotPassword = async (req, res) => {
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

    res.json({
      message: 'If this email exists, a reset OTP has been sent.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
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

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokenHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    res.json({
      user,
      redirectTo: getDashboardPathByRole(user.role),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const patientDashboard = (req, res) => {
  res.json({ message: 'Patient dashboard access granted', role: req.user.role });
};

export const doctorDashboard = (req, res) => {
  res.json({ message: 'Doctor dashboard access granted', role: req.user.role });
};

export const adminDashboard = (req, res) => {
  res.json({ message: 'Admin dashboard access granted', role: req.user.role });
};

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationOtp: String,
    verificationOtpExpiresAt: Date,

    resetOtp: String,
    resetOtpExpiresAt: Date,

    refreshTokenHash: String,
    refreshTokenExpiresAt: Date,

    phone: String,
    profileImage: String,

  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
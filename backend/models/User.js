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
      enum: ['patient', 'doctor', 'admin', 'hospital'],
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

    age: Number,

    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },

    phone: String,
    profileImage: String,

  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
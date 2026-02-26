import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    specialty: {
      type: String,
      required: true,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
    },

    experienceYears: {
      type: Number,
      default: 0,
    },

    hospital: {
      type: String,
    },

    bio: String,

    consultationFee: {
      type: Number,
      default: 0,
    },

    availability: [
      {
        day: String,
        startTime: String,
        endTime: String,
      }
    ],

    isApproved: {
      type: Boolean,
      default: false,
    }

  },
  { timestamps: true }
);

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
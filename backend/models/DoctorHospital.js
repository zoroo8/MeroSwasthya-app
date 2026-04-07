const mongoose = require('mongoose');

const doctorHospitalSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    maxDailyBookings: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

doctorHospitalSchema.index({ doctor: 1, hospital: 1 }, { unique: true });

doctorHospitalSchema.index({ hospital: 1, isActive: 1 });

module.exports = mongoose.model('DoctorHospital', doctorHospitalSchema);
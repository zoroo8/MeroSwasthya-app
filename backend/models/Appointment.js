const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    notes: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);

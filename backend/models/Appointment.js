const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointmentDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    startTime: {
      type: String, // HH:mm
      required: true,
    },
    endTime: {
      type: String, // HH:mm
      required: true,
    },
    status: {
      type: String,
      enum: ['UPCOMING', 'IN_PROGRESS', 'PAST', 'CANCELLED'],
      default: 'UPCOMING',
    },
  },
  { timestamps: true }
);

// Concurrency control: Unique index to prevent double bookings
// If a second patient tries to book the exact same slot, MongoDB throws Error 11000
appointmentSchema.index({ doctor: 1, appointmentDate: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);

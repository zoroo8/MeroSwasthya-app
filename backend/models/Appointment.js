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
    queueDate: {
      type: String,
      required: true,
      trim: true,
    },
    queueNumber: {
      type: Number,
      required: true,
      min: 1,
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

appointmentSchema.index({ doctor: 1, hospitalId: 1, queueDate: 1, queueNumber: 1 }, { unique: true });
appointmentSchema.index({ doctor: 1, hospitalId: 1, queueDate: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

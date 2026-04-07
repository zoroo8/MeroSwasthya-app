const mongoose = require('mongoose');

const medicalReportSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },
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
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    prescription: [String],
    testRecommendations: [String],
    followUpDate: Date,
    notes: String,
    attachments: [String],
    createdByRole: {
      type: String,
      enum: ['doctor', 'hospital', 'admin'],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalReport', medicalReportSchema);
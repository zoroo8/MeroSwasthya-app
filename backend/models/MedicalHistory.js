import mongoose from 'mongoose';

const medicalHistorySchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    entryType: {
      type: String,
      enum: ['prescription', 'document', 'note'],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    sourceType: {
      type: String,
      enum: ['prescription', 'appointment', 'manual'],
      default: 'manual',
    },

    sourceId: {
      type: String,
      default: '',
      trim: true,
    },

    documentUrl: {
      type: String,
      default: '',
      trim: true,
    },

    documentName: {
      type: String,
      default: '',
      trim: true,
    },

    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

medicalHistorySchema.index({ patient: 1, createdAt: -1 });

const MedicalHistory = mongoose.model('MedicalHistory', medicalHistorySchema);

export default MedicalHistory;

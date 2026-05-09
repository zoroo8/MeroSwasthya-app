const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    patientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ patientUser: 1, doctor: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

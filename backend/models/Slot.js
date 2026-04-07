import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    isBooked: {
      type: Boolean,
      default: false,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  { timestamps: true }
);

slotSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true });

const Slot = mongoose.model('Slot', slotSchema);

export default Slot;

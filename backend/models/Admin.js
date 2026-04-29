import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          'manage_users',
          'manage_doctors',
          'view_statistics',
          'approve_doctors',
          'deactivate_users',
          'manage_appointments',
          'view_all_records',
          'manage_payments',
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    actionLogs: [
      {
        action: String,
        targetUser: mongoose.Schema.Types.ObjectId,
        targetRole: String,
        changeDescription: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);

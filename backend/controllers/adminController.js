import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';

// Helper: Check if user has admin permission
export const checkAdminPermission = async (userId, requiredPermission) => {
  const admin = await Admin.findOne({ user: userId });
  if (!admin || !admin.isActive) {
    return false;
  }
  return admin.permissions.includes(requiredPermission);
};

// Helper: Log admin action
const logAdminAction = async (adminId, action, targetUser, targetRole, changeDescription) => {
  try {
    await Admin.findByIdAndUpdate(
      adminId,
      {
        $push: {
          actionLogs: {
            action,
            targetUser,
            targetRole,
            changeDescription,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
};

// Get all users with pagination and filters
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;
    const skip = (page - 1) * limit;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'manage_users');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Get user details by ID
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'manage_users');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user is doctor, get doctor details too
    let doctorInfo = null;
    if (user.role === 'doctor') {
      doctorInfo = await Doctor.findOne({ user: userId });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        doctorInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user details', error: error.message });
  }
};

// Deactivate user
export const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'deactivate_users');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Prevent self-deactivation
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    const admin = await Admin.findOne({ user: req.user.id });
    await logAdminAction(
      admin._id,
      'deactivate_user',
      userId,
      user.role,
      `User deactivated. Reason: ${reason || 'No reason provided'}`
    );

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating user', error: error.message });
  }
};

// Reactivate user
export const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'manage_users');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    const admin = await Admin.findOne({ user: req.user.id });
    await logAdminAction(
      admin._id,
      'reactivate_user',
      userId,
      user.role,
      'User reactivated'
    );

    res.status(200).json({
      success: true,
      message: 'User reactivated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error reactivating user', error: error.message });
  }
};

// Get pending doctor approvals
export const getPendingDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'approve_doctors');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const doctors = await Doctor.find({ isApproved: false })
      .populate('user', '-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Doctor.countDocuments({ isApproved: false });

    res.status(200).json({
      success: true,
      data: doctors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending doctors', error: error.message });
  }
};

// Approve doctor
export const approveDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { approvalNotes } = req.body;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'approve_doctors');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        isApproved: true,
        approvalDate: new Date(),
        approvalNotes,
      },
      { new: true }
    ).populate('user', '-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Log action
    const admin = await Admin.findOne({ user: req.user.id });
    await logAdminAction(
      admin._id,
      'approve_doctor',
      doctor.user._id,
      'doctor',
      `Doctor approved. Notes: ${approvalNotes || 'No notes'}`
    );

    res.status(200).json({
      success: true,
      message: 'Doctor approved successfully',
      data: doctor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving doctor', error: error.message });
  }
};

// Reject doctor
export const rejectDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { rejectionReason } = req.body;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'approve_doctors');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        isApproved: false,
        rejectionReason,
      },
      { new: true }
    ).populate('user', '-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Log action
    const admin = await Admin.findOne({ user: req.user.id });
    await logAdminAction(
      admin._id,
      'reject_doctor',
      doctor.user._id,
      'doctor',
      `Doctor rejected. Reason: ${rejectionReason || 'No reason provided'}`
    );

    res.status(200).json({
      success: true,
      message: 'Doctor rejected',
      data: doctor,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting doctor', error: error.message });
  }
};

// Get platform statistics
export const getPlatformStatistics = async (req, res) => {
  try {
    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'view_statistics');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const totalUsers = await User.countDocuments({ isActive: true });
    const totalDoctors = await Doctor.countDocuments({ isApproved: true });
    const pendingDoctors = await Doctor.countDocuments({ isApproved: false });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const doctorsBySpecialty = await Doctor.aggregate([
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalDoctors,
          pendingDoctors,
          inactiveUsers,
        },
        usersByRole,
        doctorsBySpecialty,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
};

// Get admin activity logs
export const getAdminLogs = async (req, res) => {
  try {
    const { adminId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check admin permission
    const hasPermission = await checkAdminPermission(req.user.id, 'view_statistics');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const filter = adminId ? { _id: adminId } : {};
    const admins = await Admin.find(filter)
      .populate('user', 'name email role')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Admin.countDocuments(filter);

    // Flatten action logs from all admins
    const allLogs = admins.flatMap(admin =>
      admin.actionLogs.map(log => ({
        ...log,
        adminName: admin.user.name,
        adminId: admin._id,
      }))
    );

    res.status(200).json({
      success: true,
      data: allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin logs', error: error.message });
  }
};

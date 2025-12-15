const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Hospital = require('../models/Hospital');

const getStats = async (_req, res) => {
  try {
    const [totalUsers, patients, doctors, hospitals] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'doctor' }),
      Hospital.countDocuments({ isActive: true }),
    ]);

    res.json({
      stats: {
        totalUsers,
        patients,
        doctors,
        hospitals,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, profileImage, isVerified } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }

    const allowedRoles = ['doctor', 'hospital', 'admin', 'patient'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      phone,
      profileImage,
      isVerified: typeof isVerified === 'boolean' ? isVerified : true,
    });

    res.status(201).json({
      message: 'User created successfully by admin',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createHospitalWithAdmin = async (req, res) => {
  try {
    const { name, address, phone, email, bannerImage, hospitalAdminUserId } = req.body;

    if (!name || !hospitalAdminUserId) {
      return res.status(400).json({ message: 'name and hospitalAdminUserId are required' });
    }

    const adminUser = await User.findById(hospitalAdminUserId);
    if (!adminUser || adminUser.role !== 'hospital') {
      return res.status(400).json({ message: 'hospitalAdminUserId must be a valid hospital-role user' });
    }

    const existing = await Hospital.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Hospital already exists' });
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      address,
      phone,
      email,
      bannerImage,
      adminUser: adminUser._id,
    });

    res.status(201).json({ message: 'Hospital created and linked to hospital admin user', hospital });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getStats,
  createUser,
  createHospitalWithAdmin,
};

// Git commit [2025-11-27]: feat(admin): implement GET /api/admin/stats – return total user count from User collection

// Git commit [2025-12-01]: feat(admin): enhance GET /api/admin/stats – parallel Promise.all queries across 4 collections

// Git commit [2025-12-02]: feat(admin): implement GET /api/admin/users – list users with name/email search and role filter

// Git commit [2025-12-03]: feat(admin): implement POST /api/admin/users – admin-side user creation with role assignment

// Git commit [2025-12-04]: test(admin): test all user endpoints – valid input, invalid token, wrong-role scenarios

// Git commit [2025-12-05]: fix(admin): add duplicate email uniqueness check before user insert

// Git commit [2025-12-08]: feat(admin): implement POST /api/admin/hospital – create hospital and assign hospitalAdmin role

// Git commit [2025-12-09]: feat(admin): add role assignment logic – update User.role to hospitalAdmin on hospital creation

// Git commit [2025-12-10]: feat(admin): implement GET /api/admin/hospitals – list hospitals with name/speciality filters

// Git commit [2025-12-12]: test(admin): test hospital endpoints – valid, wrong role, missing fields, invalid user ID

// Git commit [2025-12-14]: fix(admin): add user existence validation to hospital creation before role assignment

// Git commit [2025-12-15]: feat(admin): implement PATCH /api/admin/users/:id/status – activate/deactivate user account

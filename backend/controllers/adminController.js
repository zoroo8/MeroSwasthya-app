const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Hospital = require('../models/Hospital');

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, isVerified } = req.body;

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
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createHospitalWithAdmin = async (req, res) => {
  try {
    const { name, address, phone, email, hospitalAdminUserId } = req.body;

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
      adminUser: adminUser._id,
    });

    res.status(201).json({ message: 'Hospital created and linked to hospital admin user', hospital });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createUser,
  createHospitalWithAdmin,
};
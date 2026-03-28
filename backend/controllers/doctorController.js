const Doctor = require('../models/Doctor');

const createProfile = async (req, res) => {
  try {
    const {
      specialty,
      licenseNumber,
      experienceYears,
      hospital,
      hospitalId,
      bio,
      consultationFee,
      availability,
    } = req.body;

    const existing = await Doctor.findOne({ user: req.user.id });
    if (existing) {
      return res.status(400).json({ message: 'Doctor profile already exists' });
    }

    const doctor = await Doctor.create({
      user: req.user.id,
      specialty,
      licenseNumber,
      experienceYears,
      hospital,
      hospitalId,
      bio,
      consultationFee,
      availability,
    });

    res.status(201).json({
      message: 'Doctor profile created. Waiting for admin approval.',
      doctor,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user.id }).populate('user', 'name email phone');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ doctor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const updates = {};
    const fields = ['specialty', 'licenseNumber', 'experienceYears', 'hospital', 'hospitalId', 'bio', 'consultationFee', 'availability'];

    fields.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') {
        updates[field] = req.body[field];
      }
    });

    const doctor = await Doctor.findOneAndUpdate({ user: req.user.id }, updates, {
      new: true,
      runValidators: true,
    }).populate('user', 'name email phone');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ message: 'Doctor profile updated successfully', doctor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPendingApprovals = async (_req, res) => {
  try {
    const doctors = await Doctor.find({ isApproved: false }).populate('user', 'name email phone');
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const approveDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.doctorId, { isApproved: true }, { new: true }).populate('user', 'name email phone');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ message: 'Doctor approved successfully', doctor });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProfile,
  getMyProfile,
  updateMyProfile,
  getPendingApprovals,
  approveDoctor,
};
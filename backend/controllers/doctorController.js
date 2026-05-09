const Doctor = require('../models/Doctor');
const DoctorHospital = require('../models/DoctorHospital');
const User = require('../models/User');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDoctors = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const specialty = String(req.query.specialty || '').trim();
    const hospitalId = req.query.hospitalId;
    const filter = { isApproved: true };

    if (specialty) {
      filter.specialty = new RegExp(escapeRegex(specialty), 'i');
    }

    if (hospitalId) {
      const links = await DoctorHospital.find({ hospital: hospitalId, isActive: true }).select('doctor');
      filter._id = { $in: links.map((link) => link.doctor) };
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      const users = await User.find({
        role: 'doctor',
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
      }).select('_id');

      filter.$or = [
        { specialty: searchRegex },
        { licenseNumber: searchRegex },
        { user: { $in: users.map((user) => user._id) } },
      ];
    }

    const doctors = await Doctor.find(filter)
      .populate('user', 'name email phone profileImage')
      .sort({ specialty: 1, experienceYears: -1 });

    const links = await DoctorHospital.find({
      doctor: { $in: doctors.map((doctor) => doctor._id) },
      isActive: true,
    }).populate('hospital', 'name address phone email bannerImage');

    const hospitalByDoctorId = new Map();
    links.forEach((link) => {
      const key = String(link.doctor);
      const current = hospitalByDoctorId.get(key) || [];
      if (link.hospital) {
        current.push({
          id: link.hospital._id,
          name: link.hospital.name,
          address: link.hospital.address,
          phone: link.hospital.phone,
          email: link.hospital.email,
          bannerImage: link.hospital.bannerImage,
          availabilitySlots: link.availabilitySlots,
          availableDates: link.availableDates,
          maxDailyBookings: link.maxDailyBookings,
        });
      }
      hospitalByDoctorId.set(key, current);
    });

    res.json({
      doctors: doctors.map((doctor) => ({
        ...doctor.toObject(),
        hospitals: hospitalByDoctorId.get(String(doctor._id)) || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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
      maxDailyBookings,
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
      maxDailyBookings,
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
    const fields = ['specialty', 'licenseNumber', 'experienceYears', 'hospital', 'hospitalId', 'bio', 'consultationFee', 'availability', 'maxDailyBookings'];

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
  getDoctors,
  createProfile,
  getMyProfile,
  updateMyProfile,
  getPendingApprovals,
  approveDoctor,
};

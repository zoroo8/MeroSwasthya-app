import Doctor from '../models/Doctor.js';
import mongoose from 'mongoose';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const normalizeAvailability = (availability = []) => {
  if (!Array.isArray(availability)) {
    return [];
  }

  return availability
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
    }));
};

const mapDoctorCard = (doctor) => ({
  id: doctor._id,
  name: doctor.user?.name,
  profileImage: doctor.user?.profileImage,
  specialization: doctor.specialty,
  experience: doctor.experienceYears,
  location: doctor.hospital,
  rating: null,
  availableSlots: normalizeAvailability(doctor.availability),
});

export const getDoctors = async (req, res) => {
  try {
    const { specialization, location, availability, minExperience, page = '1', limit = '10' } = req.query;

    const filters = { isApproved: true };

    if (specialization?.trim()) {
      filters.specialty = { $regex: specialization.trim(), $options: 'i' };
    }

    if (location?.trim()) {
      filters.hospital = { $regex: location.trim(), $options: 'i' };
    }

    if (availability?.trim()) {
      filters['availability.day'] = { $regex: `^${availability.trim()}$`, $options: 'i' };
    }

    if (minExperience !== undefined) {
      const minYears = toPositiveInt(minExperience);
      if (minYears === null) {
        return res.status(400).json({ message: 'minExperience must be a positive integer' });
      }
      filters.experienceYears = { $gte: minYears };
    }

    const pageNumber = Math.max(toPositiveInt(page) || 1, 1);
    const limitNumber = Math.min(Math.max(toPositiveInt(limit) || 10, 1), 50);
    const skip = (pageNumber - 1) * limitNumber;

    const [doctors, total] = await Promise.all([
      Doctor.find(filters)
        .populate('user', 'name profileImage')
        .sort({ experienceYears: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Doctor.countDocuments(filters),
    ]);

    return res.json({
      doctors: doctors.map(mapDoctorCard),
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const doctor = await Doctor.findOne({
      _id: req.params.id,
      isApproved: true,
    }).populate('user', 'name profileImage');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.json({ doctor: mapDoctorCard(doctor) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Controller method for creating doctor profile
export const createDoctorProfile = async (req, res) => {
  try {
    const {
      specialty,
      licenseNumber,
      experienceYears,
      hospital,
      bio,
      consultationFee,
      availability
    } = req.body;

    const existing = await Doctor.findOne({ user: req.user.id });
    if (existing) {
      return res.status(400).json({ message: "Doctor profile already exists" });
    }

    const doctor = await Doctor.create({
      user: req.user.id,
      specialty,
      licenseNumber,
      experienceYears,
      hospital,
      bio,
      consultationFee,
      availability
    });

    res.status(201).json({
      message: "Doctor profile created. Waiting for admin approval.",
      doctor
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

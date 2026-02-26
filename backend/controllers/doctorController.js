import Doctor from '../models/Doctor.js';

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

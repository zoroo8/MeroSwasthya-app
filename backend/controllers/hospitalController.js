const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');

const createHospital = async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Hospital name is required' });
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
      adminUser: req.user.role === 'hospital' ? req.user.id : undefined,
    });

    res.status(201).json({ message: 'Hospital created successfully', hospital });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHospitals = async (_req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
    res.json({ hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHospitalDoctors = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    const doctors = await Doctor.find({ hospitalId: hospital._id, isApproved: true })
      .populate('user', 'name email phone')
      .sort({ specialty: 1, experienceYears: -1 });

    res.json({ hospital, doctors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const assignDoctorToHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId } = req.params;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    if (req.user.role === 'hospital' && String(hospital.adminUser) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Access denied for this hospital' });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        hospitalId: hospital._id,
        hospital: hospital.name,
      },
      { new: true }
    ).populate('user', 'name email phone');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ message: 'Doctor assigned to hospital successfully', doctor, hospital });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createHospital,
  getHospitals,
  getHospitalDoctors,
  assignDoctorToHospital,
};
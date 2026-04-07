const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const MedicalReport = require('../models/MedicalReport');

const assertDoctorAccessToAppointment = async (appointment, userId) => {
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return { error: { status: 404, message: 'Doctor profile not found' } };
  }

  if (String(appointment.doctor) !== String(doctor._id)) {
    return { error: { status: 403, message: 'Access denied for this appointment' } };
  }

  return { doctor };
};

const assertHospitalAccessToAppointment = async (appointment, userId) => {
  if (!appointment.hospitalId) {
    return { error: { status: 400, message: 'Appointment is not linked to any hospital' } };
  }

  const hospital = await Hospital.findById(appointment.hospitalId);
  if (!hospital) {
    return { error: { status: 404, message: 'Hospital not found' } };
  }

  if (String(hospital.adminUser) !== String(userId)) {
    return { error: { status: 403, message: 'Access denied for this hospital appointment' } };
  }

  return { hospital };
};

const createOrUpdateReport = async (req, res) => {
  try {
    const {
      appointmentId,
      diagnosis,
      prescription,
      testRecommendations,
      followUpDate,
      notes,
      attachments,
    } = req.body;

    if (!appointmentId || !diagnosis) {
      return res.status(400).json({ message: 'appointmentId and diagnosis are required' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (!['confirmed', 'completed'].includes(appointment.status)) {
      return res.status(400).json({ message: 'Report can be created only for confirmed/completed appointments' });
    }

    if (req.user.role === 'doctor') {
      const { error } = await assertDoctorAccessToAppointment(appointment, req.user.id);
      if (error) {
        return res.status(error.status).json({ message: error.message });
      }
    }

    if (req.user.role === 'hospital') {
      const { error } = await assertHospitalAccessToAppointment(appointment, req.user.id);
      if (error) {
        return res.status(error.status).json({ message: error.message });
      }
    }

    const payload = {
      appointment: appointment._id,
      patientUser: appointment.patientUser,
      doctor: appointment.doctor,
      hospitalId: appointment.hospitalId,
      diagnosis: diagnosis.trim(),
      prescription: Array.isArray(prescription) ? prescription : [],
      testRecommendations: Array.isArray(testRecommendations) ? testRecommendations : [],
      followUpDate,
      notes,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdByRole: req.user.role,
    };

    const report = await MedicalReport.findOneAndUpdate(
      { appointment: appointment._id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate('patientUser', 'name email phone')
      .populate('hospitalId', 'name address phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } })
      .populate('appointment');

    res.json({ message: 'Medical report saved successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyReports = async (req, res) => {
  try {
    let filter;

    if (req.user.role === 'patient') {
      filter = { patientUser: req.user.id };
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }
      filter = { doctor: doctor._id };
    } else if (req.user.role === 'hospital') {
      const hospitals = await Hospital.find({ adminUser: req.user.id }).select('_id');
      filter = { hospitalId: { $in: hospitals.map((h) => h._id) } };
    } else {
      filter = {};
    }

    const reports = await MedicalReport.find(filter)
      .populate('patientUser', 'name email phone')
      .populate('hospitalId', 'name address phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } })
      .populate('appointment')
      .sort({ createdAt: -1 });

    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getReportById = async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id)
      .populate('patientUser', 'name email phone')
      .populate('hospitalId', 'name address phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } })
      .populate('appointment');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (req.user.role === 'patient' && String(report.patientUser._id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (!doctor || String(report.doctor._id) !== String(doctor._id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    if (req.user.role === 'hospital') {
      const hospital = await Hospital.findOne({ _id: report.hospitalId?._id, adminUser: req.user.id });
      if (!hospital) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createOrUpdateReport,
  getMyReports,
  getReportById,
};
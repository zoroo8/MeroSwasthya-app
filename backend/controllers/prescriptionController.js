import mongoose from 'mongoose';
import Prescription from '../models/Prescription.js';

const normalizeMedicines = (medicines) => {
  if (Array.isArray(medicines)) {
    return medicines.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof medicines === 'string') {
    return medicines
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const formatPrescription = (prescription) => ({
  id: prescription._id,
  appointmentId: prescription.appointmentId,
  doctorId: prescription.doctor?._id || prescription.doctor,
  patientId: prescription.patient?._id || prescription.patient,
  diagnosis: prescription.diagnosis,
  medicines: prescription.medicines,
  notes: prescription.notes,
  createdAt: prescription.createdAt,
  updatedAt: prescription.updatedAt,
});

const canAccessPrescription = (user, prescription) => {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'doctor') {
    return prescription.doctor._id.toString() === user.id;
  }

  if (user.role === 'patient') {
    return prescription.patient._id.toString() === user.id;
  }

  return false;
};

export const createPrescription = async (req, res) => {
  try {
    const { appointmentId, patientId, diagnosis, medicines, notes } = req.body;

    if (!appointmentId || !patientId || !diagnosis) {
      return res.status(400).json({ message: 'appointmentId, patientId and diagnosis are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patientId' });
    }

    const existing = await Prescription.findOne({ appointmentId: String(appointmentId).trim() });
    if (existing) {
      return res.status(400).json({ message: 'Prescription already exists for this appointment' });
    }

    const prescription = await Prescription.create({
      appointmentId: String(appointmentId).trim(),
      doctor: req.user.id,
      patient: patientId,
      diagnosis: String(diagnosis).trim(),
      medicines: normalizeMedicines(medicines),
      notes: notes ? String(notes).trim() : '',
    });

    return res.status(201).json({
      message: 'Prescription created successfully',
      prescription: formatPrescription(prescription),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'Prescription already exists for this appointment' });
    }

    return res.status(500).json({ message: err.message });
  }
};

export const getPrescriptionByAppointmentId = async (req, res) => {
  try {
    const appointmentId = String(req.params.appointmentId || '').trim();
    if (!appointmentId) {
      return res.status(400).json({ message: 'appointmentId is required' });
    }

    const prescription = await Prescription.findOne({ appointmentId })
      .populate('doctor', 'name email role')
      .populate('patient', 'name email role');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (!canAccessPrescription(req.user, prescription)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      prescription: formatPrescription(prescription),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

import mongoose from 'mongoose';
import Prescription from '../models/Prescription.js';
import MedicalHistory from '../models/MedicalHistory.js';

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const formatEntry = (entry) => ({
  id: entry._id,
  patientId: entry.patient?._id || entry.patient,
  entryType: entry.entryType,
  title: entry.title,
  description: entry.description,
  sourceType: entry.sourceType,
  sourceId: entry.sourceId,
  documentUrl: entry.documentUrl,
  documentName: entry.documentName,
  tags: entry.tags,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const formatPrescriptionAsHistory = (prescription) => ({
  id: prescription._id,
  patientId: prescription.patient?._id || prescription.patient,
  entryType: 'prescription',
  title: `Prescription for ${prescription.diagnosis}`,
  description: prescription.notes || '',
  sourceType: 'prescription',
  sourceId: prescription.appointmentId,
  documentUrl: '',
  documentName: '',
  tags: ['prescription'],
  createdAt: prescription.createdAt,
  updatedAt: prescription.updatedAt,
});

const ensurePatientOwnership = (req, patientId) => {
  if (req.user.role === 'admin') {
    return true;
  }

  return req.user.role === 'patient' && req.user.id === String(patientId);
};

const fetchTimeline = async (patientId) => {
  const [entries, prescriptions] = await Promise.all([
    MedicalHistory.find({ patient: patientId }).sort({ createdAt: -1 }),
    Prescription.find({ patient: patientId }).sort({ createdAt: -1 }).populate('doctor', 'name email'),
  ]);

  const historyEntries = entries.map(formatEntry);
  const prescriptionEntries = prescriptions.map(formatPrescriptionAsHistory);

  return [...historyEntries, ...prescriptionEntries].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
};

export const getMyMedicalHistory = async (req, res) => {
  try {
    const patientId = req.user.id;
    const timeline = await fetchTimeline(patientId);

    return res.json({
      patientId,
      timeline,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const addMedicalDocument = async (req, res) => {
  try {
    const { patientId, title, description, documentUrl, documentName, tags } = req.body;

    if (!patientId || !title || !documentUrl) {
      return res.status(400).json({ message: 'patientId, title and documentUrl are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patientId' });
    }

    if (!ensurePatientOwnership(req, patientId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const entry = await MedicalHistory.create({
      patient: patientId,
      entryType: 'document',
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      sourceType: 'manual',
      sourceId: '',
      documentUrl: String(documentUrl).trim(),
      documentName: documentName ? String(documentName).trim() : '',
      tags: normalizeTags(tags),
    });

    return res.status(201).json({
      message: 'Medical document added successfully',
      entry: formatEntry(entry),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

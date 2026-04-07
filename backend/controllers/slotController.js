import Doctor from '../models/Doctor.js';
import Slot from '../models/Slot.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

const isValidDate = (value) => DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const isValidTime = (value) => TIME_PATTERN.test(value);

const formatSlot = (slot) => ({
  id: slot._id,
  doctorId: slot.doctor?._id || slot.doctor,
  date: slot.date,
  time: slot.time,
  isBooked: slot.isBooked,
  appointmentId: slot.appointment || null,
  createdAt: slot.createdAt,
  updatedAt: slot.updatedAt,
});

export const createSlot = async (req, res) => {
  try {
    const { date, time } = req.body;

    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required' });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({ message: 'Time must be in HH:MM format' });
    }

    const doctor = await Doctor.findOne({ user: req.user.id, isApproved: true });
    if (!doctor) {
      return res.status(403).json({ message: 'Doctor profile is not approved yet' });
    }

    const existingSlot = await Slot.findOne({ doctor: doctor._id, date, time });
    if (existingSlot) {
      return res.status(400).json({ message: 'Slot already exists for this date and time' });
    }

    const slot = await Slot.create({
      doctor: doctor._id,
      date,
      time,
      isBooked: false,
      appointment: null,
    });

    return res.status(201).json({
      message: 'Slot created successfully',
      slot: formatSlot(slot),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'Slot already exists for this date and time' });
    }

    return res.status(500).json({ message: err.message });
  }
};

export const getDoctorSlots = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.id, isApproved: true });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const availableOnly = String(req.query.availableOnly || '').toLowerCase() === 'true';
    const filters = { doctor: doctor._id };

    if (availableOnly) {
      filters.isBooked = false;
    }

    const slots = await Slot.find(filters).sort({ date: 1, time: 1 });

    return res.json({
      doctorId: doctor._id,
      slots: slots.map(formatSlot),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

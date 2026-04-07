import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Slot from '../models/Slot.js';

const VALID_STATUS_TRANSITIONS = ['confirmed', 'completed', 'cancelled'];

const formatAppointment = (appointment) => ({
  id: appointment._id,
  patientId: appointment.patient?._id || appointment.patient,
  patient: appointment.patient
    ? {
        id: appointment.patient._id,
        name: appointment.patient.name,
        email: appointment.patient.email,
        phone: appointment.patient.phone,
      }
    : null,
  doctorId: appointment.doctor?._id || appointment.doctor,
  doctor: appointment.doctor
    ? {
        id: appointment.doctor._id,
        specialty: appointment.doctor.specialty,
        licenseNumber: appointment.doctor.licenseNumber,
        name: appointment.doctor.user?.name,
      }
    : null,
  slotId: appointment.slot?._id || appointment.slot,
  slot: appointment.slot
    ? {
        id: appointment.slot._id,
        date: appointment.slot.date,
        time: appointment.slot.time,
        isBooked: appointment.slot.isBooked,
      }
    : null,
  status: appointment.status,
  paymentStatus: appointment.paymentStatus,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt,
});

const resolveNextStatus = (statusOrAction) => {
  const normalized = String(statusOrAction || '').trim().toLowerCase();

  if (normalized === 'accept' || normalized === 'confirm') {
    return 'confirmed';
  }

  if (normalized === 'reject' || normalized === 'cancel') {
    return 'cancelled';
  }

  if (normalized === 'complete') {
    return 'completed';
  }

  if (VALID_STATUS_TRANSITIONS.includes(normalized)) {
    return normalized;
  }

  return null;
};

const getDoctorProfileForCurrentUser = async (userId) => {
  return Doctor.findOne({ user: userId, isApproved: true });
};

export const bookAppointment = async (req, res) => {
  try {
    const { doctorId, slotId } = req.body;

    if (!doctorId || !slotId) {
      return res.status(400).json({ message: 'doctorId and slotId are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      return res.status(400).json({ message: 'Invalid doctorId or slotId' });
    }

    const doctor = await Doctor.findOne({ _id: doctorId, isApproved: true });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found or not approved' });
    }

    const slot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        doctor: doctor._id,
        isBooked: false,
      },
      {
        $set: {
          isBooked: true,
        },
      },
      {
        new: true,
      }
    );

    if (!slot) {
      return res.status(409).json({ message: 'Slot is already booked or does not belong to this doctor' });
    }

    let appointment;

    try {
      appointment = await Appointment.create({
        patient: req.user.id,
        doctor: doctor._id,
        slot: slot._id,
        status: 'pending',
        paymentStatus: 'pending',
      });

      slot.appointment = appointment._id;
      await slot.save();
    } catch (appointmentError) {
      if (appointment?._id) {
        await Appointment.findByIdAndDelete(appointment._id).catch(() => {});
      }

      await Slot.findByIdAndUpdate(slot._id, {
        $set: {
          isBooked: false,
          appointment: null,
        },
      });
      throw appointmentError;
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patient', 'name email phone')
      .populate('doctor', 'specialty licenseNumber user')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name profileImage' } })
      .populate('slot');

    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: formatAppointment(populatedAppointment),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAppointments = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'patient') {
      filter.patient = req.user.id;
    } else if (req.user.role === 'doctor') {
      const doctor = await getDoctorProfileForCurrentUser(req.user.id);
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found or not approved' });
      }
      filter.doctor = doctor._id;
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email phone')
      .populate({ path: 'doctor', select: 'specialty licenseNumber user', populate: { path: 'user', select: 'name profileImage' } })
      .populate('slot')
      .sort({ createdAt: -1 });

    return res.json({
      appointments: appointments.map(formatAppointment),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid appointment id' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'name email phone')
      .populate({ path: 'doctor', select: 'specialty licenseNumber user', populate: { path: 'user', select: 'name profileImage' } })
      .populate('slot');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    let nextStatus = resolveNextStatus(status || action);
    if (!nextStatus) {
      return res.status(400).json({ message: 'Invalid status or action' });
    }

    if (req.user.role === 'patient') {
      if (appointment.patient._id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (nextStatus !== 'cancelled') {
        return res.status(400).json({ message: 'Patients can only cancel appointments' });
      }
    } else if (req.user.role === 'doctor') {
      const doctor = await getDoctorProfileForCurrentUser(req.user.id);
      if (!doctor || appointment.doctor._id.toString() !== doctor._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return res.status(400).json({ message: 'Completed or cancelled appointments cannot be updated' });
    }

    appointment.status = nextStatus;

    if (nextStatus === 'cancelled') {
      appointment.slot.isBooked = false;
      appointment.slot.appointment = null;
      await appointment.slot.save();
    }

    await appointment.save();

    const refreshedAppointment = await Appointment.findById(appointment._id)
      .populate('patient', 'name email phone')
      .populate({ path: 'doctor', select: 'specialty licenseNumber user', populate: { path: 'user', select: 'name profileImage' } })
      .populate('slot');

    return res.json({
      message: 'Appointment updated successfully',
      appointment: formatAppointment(refreshedAppointment),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
